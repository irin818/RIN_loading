"""
Write-side SQLite helpers: create conversations, append messages, record turns, write
traces.
"""

from __future__ import annotations

import json
import sqlite3
from hashlib import sha256
from pathlib import Path
from uuid import uuid4

from rin.contracts import ConversationMessageRecord, ConversationRecord
from rin.database.readonly import database_path_for
from rin.diagnostics.safety import assert_safe_python_write_data_dir
from rin.mind import (
    ConversationSummary,
    MemoryCandidate,
    MemoryEmbeddingEntry,
    RinGrowthEvent,
    RinMindSnapshot,
    ToolInvocationRequest,
)
from rin.model.usage import ApiUsageAccounting
from rin.storage import RinDataLayout, create_data_layout


def assert_safe_write_layout(layout: RinDataLayout) -> Path:
    """
    Verify the layout's root directory is safe for writes, returning the resolved path.
    """
    return assert_safe_python_write_data_dir(layout.rootDir)


def initialize_temp_database(layout: RinDataLayout) -> Path:
    """
    Create the database file and apply the full schema if it does not already exist.
    """
    assert_safe_write_layout(layout)
    layout.directories["databases"].mkdir(parents=True, exist_ok=True)
    path = database_path_for(layout)
    with sqlite3.connect(path) as connection:
        connection.executescript(SCHEMA_SQL)
        ensure_mind_tables(connection)
        connection.executemany(
            "INSERT OR IGNORE INTO schema_migrations VALUES (?, ?, ?)",
            [
                (1, "initial", "2026-06-05T00:00:00.000Z"),
                (6, "v2", "2026-06-05T00:00:00.000Z"),
            ],
        )
    return path


def create_temp_layout_database(root: Path | str) -> RinDataLayout:
    """
    Create a RinDataLayout and initialize its database in one call (convenience
    wrapper).
    """
    layout = create_data_layout(str(root), cwd="/")
    initialize_temp_database(layout)
    return layout


def create_conversation(
    layout: RinDataLayout,
    title: str,
    now: str,
    conversation_id: str | None = None,
) -> ConversationRecord:
    """Insert a new conversation row and an audit event in a single transaction."""
    assert_safe_write_layout(layout)
    conversation_id = conversation_id or str(uuid4())
    with sqlite3.connect(database_path_for(layout)) as connection:
        try:
            connection.execute("BEGIN")
            connection.execute(
                "INSERT INTO conversations (id, title, created_at, updated_at) "
                "VALUES (?, ?, ?, ?)",
                (conversation_id, title, now, now),
            )
            append_audit_event_in_transaction(
                connection,
                "conversation.created",
                {"conversationId": conversation_id},
                now,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    return ConversationRecord(
        id=conversation_id,
        title=title,
        createdAt=now,
        updatedAt=now,
    )


def append_message(
    layout: RinDataLayout,
    conversation_id: str,
    role: str,
    content: str,
    now: str,
    message_id: str | None = None,
    model_adapter: str | None = None,
) -> ConversationMessageRecord:
    """
    Insert a message row, bump the conversation timestamp, and write an audit event in
    one transaction.
    """
    assert_safe_write_layout(layout)
    message_id = message_id or str(uuid4())
    with sqlite3.connect(database_path_for(layout)) as connection:
        try:
            connection.execute("BEGIN")
            connection.execute(
                "INSERT INTO messages "
                "(id, conversation_id, role, content, model_adapter, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (message_id, conversation_id, role, content, model_adapter, now),
            )
            update_result = connection.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id),
            )
            if update_result.rowcount != 1:
                msg = f"Conversation not found: {conversation_id}"
                raise ValueError(msg)
            append_audit_event_in_transaction(
                connection,
                "conversation.message_appended",
                {
                    "conversationId": conversation_id,
                    "messageId": message_id,
                    "role": role,
                    "modelAdapter": model_adapter,
                },
                now,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    return ConversationMessageRecord(
        id=message_id,
        conversationId=conversation_id,
        role=role,  # type: ignore[arg-type]
        content=content,
        modelAdapter=model_adapter,
        createdAt=now,
        memoryContext=None,
    )


def record_failed_turn(
    layout: RinDataLayout,
    turn_id: str,
    conversation_id: str,
    owner_message_id: str,
    error_code: str,
    now: str,
) -> None:
    """Insert a failed conversation_turns row and an audit event in one transaction."""
    assert_safe_write_layout(layout)
    with sqlite3.connect(database_path_for(layout)) as connection:
        try:
            connection.execute("BEGIN")
            connection.execute(
                """
                INSERT INTO conversation_turns (
                  id, conversation_id, owner_message_id, rin_message_id, status,
                  attempt_count, error_code, created_at, updated_at, completed_at,
                  failed_at
                )
                VALUES (?, ?, ?, NULL, 'failed', 1, ?, ?, ?, NULL, ?)
                """,
                (turn_id, conversation_id, owner_message_id, error_code, now, now, now),
            )
            append_audit_event_in_transaction(
                connection,
                "conversation.turn_failed",
                {"turnId": turn_id, "errorCode": error_code},
                now,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise


def record_completed_turn(
    layout: RinDataLayout,
    turn_id: str,
    conversation_id: str,
    owner_message_id: str,
    rin_message_id: str,
    now: str,
) -> None:
    """
    Insert a completed conversation_turns row and an audit event in one transaction.
    """
    assert_safe_write_layout(layout)
    with sqlite3.connect(database_path_for(layout)) as connection:
        try:
            connection.execute("BEGIN")
            connection.execute(
                """
                INSERT INTO conversation_turns (
                  id, conversation_id, owner_message_id, rin_message_id, status,
                  attempt_count, error_code, created_at, updated_at, completed_at,
                  failed_at
                )
                VALUES (?, ?, ?, ?, 'completed', 1, NULL, ?, ?, ?, NULL)
                """,
                (
                    turn_id,
                    conversation_id,
                    owner_message_id,
                    rin_message_id,
                    now,
                    now,
                    now,
                ),
            )
            append_audit_event_in_transaction(
                connection,
                "conversation.turn_completed",
                {"turnId": turn_id, "rinMessageId": rin_message_id},
                now,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise


def create_memory_trace(
    layout: RinDataLayout,
    trace_id: str,
    source_ref_id: str,
    signal_summary: dict[str, object],
    salience_score: float,
    now: str,
) -> None:
    """Insert a shadow long-term-candidate Memory V2 trace in one transaction."""
    assert_safe_write_layout(layout)
    with sqlite3.connect(database_path_for(layout)) as connection:
        try:
            connection.execute("BEGIN")
            connection.execute(
                """
                INSERT INTO memory_v2_traces (
                  id, source_ref_id, trace_kind, status, signal_summary_json,
                  salience_score, created_at, updated_at
                )
                VALUES (?, ?, 'long_term_candidate', 'shadow', ?, ?, ?, ?)
                """,
                (
                    trace_id,
                    source_ref_id,
                    json.dumps(signal_summary, sort_keys=True),
                    salience_score,
                    now,
                    now,
                ),
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise


def append_audit_event(
    layout: RinDataLayout,
    event_type: str,
    payload: dict[str, object],
    now: str,
) -> str:
    """Insert a single audit event row and return its generated id."""
    assert_safe_write_layout(layout)
    event_id = str(uuid4())
    with sqlite3.connect(database_path_for(layout)) as connection:
        append_audit_event_in_transaction(
            connection,
            event_type,
            payload,
            now,
            event_id,
        )
    return event_id


def create_api_usage_event(
    layout: RinDataLayout,
    *,
    turn_id: str | None,
    conversation_id: str | None,
    accounting: ApiUsageAccounting,
    now: str,
    event_id: str | None = None,
) -> str:
    """Persist a safe API usage event with no raw prompt or response text."""
    assert_safe_write_layout(layout)
    event_id = event_id or str(uuid4())
    with sqlite3.connect(database_path_for(layout)) as connection:
        try:
            connection.execute("BEGIN")
            ensure_api_usage_events_table(connection)
            connection.execute(
                """
                INSERT INTO api_usage_events (
                  id, turn_id, conversation_id, provider_id, model,
                  input_tokens, output_tokens, total_tokens, estimated_cost,
                  currency, estimate_method, context_character_count, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event_id,
                    turn_id,
                    conversation_id,
                    accounting.providerId,
                    accounting.model,
                    accounting.inputTokens,
                    accounting.outputTokens,
                    accounting.totalTokens,
                    accounting.estimatedCost,
                    accounting.currency,
                    accounting.estimateMethod,
                    accounting.contextCharacterCount,
                    now,
                ),
            )
            append_audit_event_in_transaction(
                connection,
                "api.usage_recorded",
                {
                    "turnId": turn_id,
                    "conversationId": conversation_id,
                    "providerId": accounting.providerId,
                    "model": accounting.model,
                    "totalTokens": accounting.totalTokens,
                    "estimateMethod": accounting.estimateMethod,
                    "rawPromptIncluded": False,
                    "rawResponseIncluded": False,
                    "secretValuesIncluded": False,
                },
                now,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    return event_id


def create_mind_turn_snapshot(
    layout: RinDataLayout,
    *,
    turn_id: str,
    conversation_id: str,
    snapshot: RinMindSnapshot,
    now: str,
    snapshot_id: str | None = None,
) -> str:
    """Persist a safe RIN Mind snapshot for one turn."""
    assert_safe_write_layout(layout)
    snapshot_id = snapshot_id or str(uuid4())
    with sqlite3.connect(database_path_for(layout)) as connection:
        try:
            connection.execute("BEGIN")
            ensure_mind_tables(connection)
            connection.execute(
                """
                INSERT INTO mind_turn_snapshots (
                  id, turn_id, conversation_id, created_at,
                  message_understanding_json, owner_state_json, context_plan_json,
                  memory_retrieval_json, memory_candidates_json, response_plan_json,
                  conversation_summary_json, growth_events_json, tool_requests_json,
                  lifecycle_json, policy_json,
                  safe_for_ui
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                """,
                (
                    snapshot_id,
                    turn_id,
                    conversation_id,
                    now,
                    snapshot.messageUnderstanding.model_dump_json(),
                    snapshot.ownerState.model_dump_json(),
                    snapshot.contextPlan.model_dump_json(),
                    snapshot.memoryRetrieval.model_dump_json(),
                    json.dumps(
                        [
                            item.model_dump(mode="json")
                            for item in snapshot.memoryCandidates
                        ],
                        sort_keys=True,
                    ),
                    snapshot.responsePlan.model_dump_json(),
                    snapshot.conversationSummary.model_dump_json()
                    if snapshot.conversationSummary
                    else None,
                    json.dumps(
                        [
                            item.model_dump(mode="json")
                            for item in snapshot.growthEvents
                        ],
                        sort_keys=True,
                    ),
                    json.dumps(
                        [
                            item.model_dump(mode="json")
                            for item in snapshot.toolInvocationRequests
                        ],
                        sort_keys=True,
                    ),
                    snapshot.lifecycle.model_dump_json(),
                    snapshot.policy.model_dump_json(),
                ),
            )
            append_audit_event_in_transaction(
                connection,
                "mind.snapshot_recorded",
                {
                    "turnId": turn_id,
                    "conversationId": conversation_id,
                    "safeForUi": True,
                    "rawTextIncluded": False,
                    "secretValuesIncluded": False,
                },
                now,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    return snapshot_id


def create_memory_candidate_records(
    layout: RinDataLayout,
    *,
    conversation_id: str,
    candidates: list[MemoryCandidate],
    now: str,
) -> list[str]:
    """Persist safe memory candidates generated by local mind rules."""
    if not candidates:
        return []
    assert_safe_write_layout(layout)
    ids: list[str] = []
    with sqlite3.connect(database_path_for(layout)) as connection:
        try:
            connection.execute("BEGIN")
            ensure_mind_tables(connection)
            for item in candidates:
                source_message_id = item.sourceMessageIds[0]
                connection.execute(
                    """
                    INSERT OR IGNORE INTO memory_candidates (
                      id, source_message_id, conversation_id, type, summary,
                      safe_summary, normalized_value, raw_text_included, redacted,
                      source_kind, language,
                      confidence, salience, stability, decay_policy, risk_level,
                      review_status, active, tags_json, evidence_hashes_json,
                      contradiction_of, supersedes, owner_confirmed, auto_promote,
                      reasons_json, created_at, updated_at
                    )
                    VALUES (
                      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                      ?, ?, ?, ?, ?, ?
                    )
                    """,
                    (
                        item.id,
                        source_message_id,
                        conversation_id,
                        item.type,
                        item.summary,
                        item.safeSummary,
                        item.normalizedValue,
                        int(item.rawTextIncluded),
                        int(item.redacted),
                        item.sourceKind,
                        item.language,
                        item.confidence,
                        item.salience,
                        item.stability,
                        item.decayPolicy,
                        item.riskLevel,
                        item.reviewStatus,
                        int(item.active),
                        json.dumps(item.tags, sort_keys=True),
                        json.dumps(item.evidenceHashes, sort_keys=True),
                        item.contradictionOf,
                        item.supersedes,
                        int(item.ownerConfirmed),
                        int(item.autoPromote),
                        json.dumps(item.reasons, sort_keys=True),
                        now,
                        now,
                    ),
                )
                ids.append(item.id)
            append_audit_event_in_transaction(
                connection,
                "mind.memory_candidates_recorded",
                {
                    "conversationId": conversation_id,
                    "candidateCount": len(candidates),
                    "candidateIds": ids,
                    "rawTextIncluded": False,
                    "secretValuesIncluded": False,
                },
                now,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    return ids


def update_memory_candidate_review(
    layout: RinDataLayout,
    *,
    candidate_id: str,
    review_status: str,
    active: bool,
    owner_confirmed: bool,
    now: str,
) -> bool:
    """Approve or reject a memory candidate without exposing or mutating raw text."""
    assert_safe_write_layout(layout)
    with sqlite3.connect(database_path_for(layout)) as connection:
        try:
            connection.execute("BEGIN")
            ensure_mind_tables(connection)
            result = connection.execute(
                """
                UPDATE memory_candidates
                SET review_status = ?, active = ?, owner_confirmed = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    review_status,
                    int(active),
                    int(owner_confirmed),
                    now,
                    candidate_id,
                ),
            )
            if result.rowcount:
                append_audit_event_in_transaction(
                    connection,
                    "mind.memory_candidate_reviewed",
                    {
                        "candidateId": candidate_id,
                        "reviewStatus": review_status,
                        "active": active,
                        "ownerConfirmed": owner_confirmed,
                    },
                    now,
                )
            connection.commit()
            return result.rowcount > 0
        except Exception:
            connection.rollback()
            raise


def update_memory_candidate_safe_fields(
    layout: RinDataLayout,
    *,
    candidate_id: str,
    updates: dict[str, object],
    now: str,
) -> str:
    """
    Edit only display-safe memory candidate fields and write a privacy-safe audit event.

    Returns:
        updated: update was applied.
        missing: candidate id was not found.
        blocked: blocked/high-risk field edit was refused by policy.
        no_changes: no allowed update fields were provided.
    """
    assert_safe_write_layout(layout)
    allowed_fields = {"safe_summary", "normalized_value", "tags"}
    safe_updates = {
        key: value for key, value in updates.items() if key in allowed_fields
    }
    if not safe_updates:
        return "no_changes"
    with sqlite3.connect(database_path_for(layout)) as connection:
        try:
            connection.execute("BEGIN")
            ensure_mind_tables(connection)
            row = connection.execute(
                "SELECT risk_level FROM memory_candidates WHERE id = ?",
                (candidate_id,),
            ).fetchone()
            if row is None:
                connection.rollback()
                return "missing"
            if str(row[0]) == "blocked":
                connection.rollback()
                return "blocked"

            assignments: list[str] = []
            params: list[object] = []
            audit_payload: dict[str, object] = {
                "candidateId": candidate_id,
                "updatedFields": sorted(safe_updates),
            }
            if "safe_summary" in safe_updates:
                value = str(safe_updates["safe_summary"]).strip()
                assignments.append("safe_summary = ?")
                params.append(value)
                audit_payload["safeSummaryLength"] = len(value)
                audit_payload["safeSummaryHash"] = sha256(
                    value.encode("utf-8"),
                ).hexdigest()
            if "normalized_value" in safe_updates:
                raw_value = safe_updates["normalized_value"]
                normalized_value = (
                    str(raw_value).strip() if raw_value is not None else None
                )
                assignments.append("normalized_value = ?")
                params.append(normalized_value)
                audit_payload["normalizedValueLength"] = len(normalized_value or "")
                audit_payload["normalizedValueHash"] = (
                    sha256(normalized_value.encode("utf-8")).hexdigest()
                    if normalized_value
                    else None
                )
            if "tags" in safe_updates:
                raw_tags = safe_updates["tags"]
                tags = (
                    [str(item).strip() for item in raw_tags]
                    if isinstance(raw_tags, list)
                    else []
                )
                assignments.append("tags_json = ?")
                params.append(json.dumps(tags, sort_keys=True))
                audit_payload["tagCount"] = len(tags)

            assignments.append("updated_at = ?")
            params.append(now)
            params.append(candidate_id)
            connection.execute(
                f"""
                UPDATE memory_candidates
                SET {", ".join(assignments)}
                WHERE id = ?
                """,
                params,
            )
            append_audit_event_in_transaction(
                connection,
                "mind.memory_candidate_safe_fields_edited",
                audit_payload,
                now,
            )
            connection.commit()
            return "updated"
        except Exception:
            connection.rollback()
            raise


def upsert_conversation_summary(
    layout: RinDataLayout,
    *,
    summary: ConversationSummary,
) -> str:
    """Insert or update the active deterministic conversation summary."""
    assert_safe_write_layout(layout)
    with sqlite3.connect(database_path_for(layout)) as connection:
        try:
            connection.execute("BEGIN")
            ensure_mind_tables(connection)
            connection.execute(
                """
                INSERT INTO conversation_summaries (
                  id, conversation_id, summary_json, created_at, updated_at,
                  source_turn_id, active
                )
                VALUES (?, ?, ?, ?, ?, ?, 1)
                ON CONFLICT(id) DO UPDATE SET
                  summary_json = excluded.summary_json,
                  updated_at = excluded.updated_at,
                  source_turn_id = excluded.source_turn_id,
                  active = excluded.active
                """,
                (
                    summary.id,
                    summary.conversationId,
                    summary.model_dump_json(),
                    summary.createdAt,
                    summary.updatedAt,
                    summary.lastUpdatedTurnId,
                ),
            )
            append_audit_event_in_transaction(
                connection,
                "mind.conversation_summary_upserted",
                {
                    "conversationId": summary.conversationId,
                    "summaryId": summary.id,
                    "sourceMessageCount": summary.sourceMessageCount,
                    "rawTextIncluded": False,
                },
                summary.updatedAt,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    return summary.id


def create_rin_growth_events(
    layout: RinDataLayout,
    *,
    events: list[RinGrowthEvent],
    now: str,
) -> list[str]:
    if not events:
        return []
    assert_safe_write_layout(layout)
    ids: list[str] = []
    with sqlite3.connect(database_path_for(layout)) as connection:
        try:
            connection.execute("BEGIN")
            ensure_mind_tables(connection)
            for item in events:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO rin_growth_events (
                      id, event_type, summary, source_turn_id, source_message_id,
                      candidate_json, risk_level, review_status, created_at,
                      applied_at, active, raw_text_included
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                    """,
                    (
                        item.id,
                        item.eventType,
                        item.summary,
                        item.sourceTurnId,
                        item.sourceMessageId,
                        json.dumps(item.candidate, sort_keys=True),
                        item.riskLevel,
                        item.reviewStatus,
                        item.createdAt,
                        item.appliedAt,
                        int(item.active),
                    ),
                )
                ids.append(item.id)
            append_audit_event_in_transaction(
                connection,
                "mind.rin_growth_events_recorded",
                {"eventCount": len(events), "rawTextIncluded": False},
                now,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    return ids


def create_tool_invocation_requests(
    layout: RinDataLayout,
    *,
    requests: list[ToolInvocationRequest],
    now: str,
) -> list[str]:
    if not requests:
        return []
    assert_safe_write_layout(layout)
    ids: list[str] = []
    with sqlite3.connect(database_path_for(layout)) as connection:
        try:
            connection.execute("BEGIN")
            ensure_mind_tables(connection)
            for item in requests:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO tool_invocation_requests (
                      id, source_turn_id, intent, tool_name, action_summary,
                      risk_level, requires_owner_approval, status, created_at,
                      raw_input_included, secret_values_included
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
                    """,
                    (
                        item.id,
                        item.sourceTurnId,
                        item.intent,
                        item.toolName,
                        item.actionSummary,
                        item.riskLevel,
                        int(item.requiresOwnerApproval),
                        item.status,
                        item.createdAt,
                    ),
                )
                ids.append(item.id)
            append_audit_event_in_transaction(
                connection,
                "mind.tool_invocation_requests_recorded",
                {"requestCount": len(requests), "secretValuesIncluded": False},
                now,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    return ids


def create_memory_embedding_entries(
    layout: RinDataLayout,
    *,
    entries: list[MemoryEmbeddingEntry],
    now: str,
) -> list[str]:
    if not entries:
        return []
    assert_safe_write_layout(layout)
    ids: list[str] = []
    with sqlite3.connect(database_path_for(layout)) as connection:
        try:
            connection.execute("BEGIN")
            ensure_mind_tables(connection)
            for item in entries:
                connection.execute(
                    """
                    INSERT OR REPLACE INTO memory_embeddings (
                      id, source_kind, source_id, embedding_provider,
                      embedding_model, vector_json, dimensions, content_hash,
                      created_at, active, raw_text_included
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                    """,
                    (
                        item.id,
                        item.sourceKind,
                        item.sourceId,
                        item.embeddingProvider,
                        item.embeddingModel,
                        json.dumps(item.vector),
                        item.dimensions,
                        item.contentHash,
                        item.createdAt,
                        int(item.active),
                    ),
                )
                ids.append(item.id)
            append_audit_event_in_transaction(
                connection,
                "mind.memory_embeddings_recorded",
                {"entryCount": len(entries), "rawTextIncluded": False},
                now,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    return ids


def append_audit_event_in_transaction(
    connection: sqlite3.Connection,
    event_type: str,
    payload: dict[str, object],
    now: str,
    event_id: str | None = None,
) -> str:
    """
    Insert an audit event row within an existing transaction; auto-generates id if not
    given.
    """
    event_id = event_id or str(uuid4())
    connection.execute(
        "INSERT INTO audit_events (id, event_type, payload_json, created_at) "
        "VALUES (?, ?, ?, ?)",
        (event_id, event_type, json.dumps(payload, sort_keys=True), now),
    )
    return event_id


def ensure_api_usage_events_table(connection: sqlite3.Connection) -> None:
    """Create the additive usage ledger table if an existing DB lacks it."""
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS api_usage_events (
          id TEXT PRIMARY KEY,
          turn_id TEXT,
          conversation_id TEXT,
          provider_id TEXT NOT NULL,
          model TEXT NOT NULL,
          input_tokens INTEGER NOT NULL,
          output_tokens INTEGER NOT NULL,
          total_tokens INTEGER NOT NULL,
          estimated_cost REAL NOT NULL,
          currency TEXT NOT NULL,
          estimate_method TEXT NOT NULL,
          context_character_count INTEGER NOT NULL,
          created_at TEXT NOT NULL
        )
        """
    )


def ensure_mind_tables(connection: sqlite3.Connection) -> None:
    """Create additive RIN Mind v1 tables when an existing DB lacks them."""
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS mind_turn_snapshots (
          id TEXT PRIMARY KEY,
          turn_id TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          message_understanding_json TEXT NOT NULL,
          owner_state_json TEXT NOT NULL,
          context_plan_json TEXT NOT NULL,
          memory_retrieval_json TEXT NOT NULL,
          memory_candidates_json TEXT NOT NULL,
          response_plan_json TEXT NOT NULL,
          conversation_summary_json TEXT,
          growth_events_json TEXT,
          tool_requests_json TEXT,
          lifecycle_json TEXT,
          policy_json TEXT,
          safe_for_ui INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memory_candidates (
          id TEXT PRIMARY KEY,
          source_message_id TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          type TEXT NOT NULL,
          summary TEXT NOT NULL,
          safe_summary TEXT NOT NULL DEFAULT '',
          normalized_value TEXT,
          raw_text_included INTEGER NOT NULL DEFAULT 0,
          redacted INTEGER NOT NULL DEFAULT 0,
          source_kind TEXT NOT NULL DEFAULT 'owner_message',
          language TEXT NOT NULL DEFAULT 'unknown',
          confidence REAL NOT NULL,
          salience REAL NOT NULL,
          stability TEXT NOT NULL,
          decay_policy TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          review_status TEXT NOT NULL,
          active INTEGER NOT NULL,
          tags_json TEXT NOT NULL,
          evidence_hashes_json TEXT NOT NULL,
          contradiction_of TEXT,
          supersedes TEXT,
          owner_confirmed INTEGER NOT NULL,
          auto_promote INTEGER NOT NULL,
          reasons_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS conversation_summaries (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          summary_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          source_turn_id TEXT,
          active INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS model_summary_candidates (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          candidate_json TEXT NOT NULL,
          review_status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          raw_model_output_included INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS rin_self_model (
          id TEXT PRIMARY KEY,
          version INTEGER NOT NULL,
          active INTEGER NOT NULL,
          identity_summary TEXT NOT NULL,
          tone_policy_json TEXT NOT NULL,
          relationship_policy_json TEXT NOT NULL,
          memory_policy_json TEXT NOT NULL,
          boundary_policy_json TEXT NOT NULL,
          visual_identity_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          source_event_id TEXT,
          raw_text_included INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS rin_growth_events (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          summary TEXT NOT NULL,
          source_turn_id TEXT NOT NULL,
          source_message_id TEXT NOT NULL,
          candidate_json TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          review_status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          applied_at TEXT,
          active INTEGER NOT NULL,
          raw_text_included INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memory_embeddings (
          id TEXT PRIMARY KEY,
          source_kind TEXT NOT NULL,
          source_id TEXT NOT NULL,
          embedding_provider TEXT NOT NULL,
          embedding_model TEXT NOT NULL,
          vector_json TEXT NOT NULL,
          dimensions INTEGER NOT NULL,
          content_hash TEXT NOT NULL,
          created_at TEXT NOT NULL,
          active INTEGER NOT NULL,
          raw_text_included INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tool_capabilities (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          enabled INTEGER NOT NULL,
          safe_metadata_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS agent_intents (
          id TEXT PRIMARY KEY,
          intent TEXT NOT NULL,
          safe_metadata_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tool_invocation_requests (
          id TEXT PRIMARY KEY,
          source_turn_id TEXT NOT NULL,
          intent TEXT NOT NULL,
          tool_name TEXT NOT NULL,
          action_summary TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          requires_owner_approval INTEGER NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          raw_input_included INTEGER NOT NULL,
          secret_values_included INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tool_invocation_audit (
          id TEXT PRIMARY KEY,
          request_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          safe_metadata_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        """
    )
    ensure_column(
        connection,
        "mind_turn_snapshots",
        "conversation_summary_json",
        "TEXT",
    )
    ensure_column(connection, "mind_turn_snapshots", "growth_events_json", "TEXT")
    ensure_column(connection, "mind_turn_snapshots", "tool_requests_json", "TEXT")
    ensure_column(connection, "mind_turn_snapshots", "lifecycle_json", "TEXT")
    ensure_column(connection, "mind_turn_snapshots", "policy_json", "TEXT")
    ensure_column(
        connection,
        "memory_candidates",
        "safe_summary",
        "TEXT NOT NULL DEFAULT ''",
    )
    ensure_column(connection, "memory_candidates", "normalized_value", "TEXT")
    ensure_column(
        connection,
        "memory_candidates",
        "raw_text_included",
        "INTEGER NOT NULL DEFAULT 0",
    )
    ensure_column(
        connection,
        "memory_candidates",
        "redacted",
        "INTEGER NOT NULL DEFAULT 0",
    )
    ensure_column(
        connection,
        "memory_candidates",
        "source_kind",
        "TEXT NOT NULL DEFAULT 'owner_message'",
    )
    ensure_column(
        connection,
        "memory_candidates",
        "language",
        "TEXT NOT NULL DEFAULT 'unknown'",
    )


def ensure_column(
    connection: sqlite3.Connection,
    table_name: str,
    column_name: str,
    definition: str,
) -> None:
    """Add a column if an older additive table was created before this field."""
    columns = {
        str(row[1])
        for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()
    }
    if column_name not in columns:
        connection.execute(
            f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"
        )


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversation_turns (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  owner_message_id TEXT NOT NULL,
  rin_message_id TEXT,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  failed_at TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model_adapter TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS message_memory_contexts (
  message_id TEXT PRIMARY KEY,
  trace_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_items (
  id TEXT PRIMARY KEY,
  memory_type TEXT NOT NULL,
  content_json TEXT NOT NULL,
  source_message_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_metadata (
  memory_item_id TEXT PRIMARY KEY,
  metadata_json TEXT NOT NULL,
  reviewed_at TEXT,
  accepted_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_v2_trace_sources (
  id TEXT PRIMARY KEY,
  source_type TEXT,
  source_table TEXT,
  source_id TEXT,
  source_created_at TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS memory_v2_traces (
  id TEXT PRIMARY KEY,
  source_ref_id TEXT NOT NULL,
  trace_kind TEXT NOT NULL,
  status TEXT NOT NULL,
  signal_summary_json TEXT NOT NULL,
  salience_score REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_v2_trace_signals (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS memory_v2_retrieval_events (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS api_usage_events (
  id TEXT PRIMARY KEY,
  turn_id TEXT,
  conversation_id TEXT,
  provider_id TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  estimated_cost REAL NOT NULL,
  currency TEXT NOT NULL,
  estimate_method TEXT NOT NULL,
  context_character_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mind_turn_snapshots (
  id TEXT PRIMARY KEY,
  turn_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  message_understanding_json TEXT NOT NULL,
  owner_state_json TEXT NOT NULL,
  context_plan_json TEXT NOT NULL,
  memory_retrieval_json TEXT NOT NULL,
  memory_candidates_json TEXT NOT NULL,
  response_plan_json TEXT NOT NULL,
  safe_for_ui INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_candidates (
  id TEXT PRIMARY KEY,
  source_message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  type TEXT NOT NULL,
  summary TEXT NOT NULL,
  confidence REAL NOT NULL,
  salience REAL NOT NULL,
  stability TEXT NOT NULL,
  decay_policy TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  review_status TEXT NOT NULL,
  active INTEGER NOT NULL,
  tags_json TEXT NOT NULL,
  evidence_hashes_json TEXT NOT NULL,
  contradiction_of TEXT,
  supersedes TEXT,
  owner_confirmed INTEGER NOT NULL,
  auto_promote INTEGER NOT NULL,
  reasons_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  source_turn_id TEXT,
  active INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS raw_events (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS slow_variable_versions (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS state_history (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS tool_invocations (id TEXT PRIMARY KEY);
"""
