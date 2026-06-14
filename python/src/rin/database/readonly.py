"""Read-only SQLite helpers: inspect, list, and map database rows to Pydantic models."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from rin.contracts import (
    ConversationMessageRecord,
    ConversationRecord,
    MemoryInjectionTrace,
)
from rin.mind import (
    ConversationSummary,
    MemoryCandidate,
    MemoryEmbeddingEntry,
    MindLifecycle,
    MindPolicyMetadata,
    RinGrowthEvent,
    RinMindSnapshot,
    ToolInvocationRequest,
)
from rin.storage import RinDataLayout

DATABASE_FILENAME = "rin.sqlite"
DATABASE_TABLES: tuple[str, ...] = (
    "schema_migrations",
    "audit_events",
    "raw_events",
    "conversations",
    "conversation_turns",
    "messages",
    "message_memory_contexts",
    "memory_metadata",
    "memory_items",
    "memory_v2_trace_sources",
    "memory_v2_traces",
    "memory_v2_trace_signals",
    "memory_v2_retrieval_events",
    "api_usage_events",
    "mind_turn_snapshots",
    "memory_candidates",
    "conversation_summaries",
    "model_summary_candidates",
    "rin_self_model",
    "rin_growth_events",
    "memory_embeddings",
    "tool_capabilities",
    "agent_intents",
    "tool_invocation_requests",
    "tool_invocation_audit",
    "slow_variable_versions",
    "state_history",
    "tool_invocations",
)


class DatabaseTableStatus(BaseModel):
    """Status of a single database table: name, existence, and row count."""

    model_config = ConfigDict(extra="forbid")

    name: str
    exists: bool
    rowCount: int


class DatabaseCounts(BaseModel):
    """Row counts for every known database table."""

    model_config = ConfigDict(extra="forbid")

    auditEvents: int
    rawEvents: int
    conversations: int
    conversationTurns: int
    messages: int
    memoryItems: int
    memoryMetadata: int
    memoryV2TraceSources: int
    memoryV2Traces: int
    memoryV2TraceSignals: int
    memoryV2RetrievalEvents: int
    apiUsageEvents: int
    mindTurnSnapshots: int
    memoryCandidates: int
    conversationSummaries: int
    modelSummaryCandidates: int
    rinSelfModel: int
    rinGrowthEvents: int
    memoryEmbeddings: int
    toolCapabilities: int
    agentIntents: int
    toolInvocationRequests: int
    toolInvocationAudit: int
    messageMemoryContexts: int
    slowVariableVersions: int
    stateHistory: int
    toolInvocations: int


class DatabaseStatus(BaseModel):
    """
    Full snapshot of the database: path, schema version, table statuses, and row counts.
    """

    model_config = ConfigDict(extra="forbid")

    path: str
    schemaVersion: int
    appliedMigrations: list[int]
    tables: list[DatabaseTableStatus]
    counts: DatabaseCounts


class MemoryMetadata(BaseModel):
    """
    Metadata for a legacy memory item: tags, importance, confidence, source, review
    timestamps.
    """

    model_config = ConfigDict(extra="forbid")

    tags: list[str]
    importance: Literal["low", "normal", "high"]
    confidence: Literal["low", "medium", "high"]
    source: str | None
    reviewedAt: str | None
    acceptedAt: str | None


class MemoryRecord(BaseModel):
    """A legacy memory item with typed content, metadata, and status."""

    model_config = ConfigDict(extra="forbid")

    id: str
    memoryType: str
    content: dict[str, Any]
    metadata: MemoryMetadata
    sourceMessageId: str | None
    status: Literal["proposal", "accepted", "rejected", "archived"]
    createdAt: str
    updatedAt: str


class MemoryV2TraceRecord(BaseModel):
    """
    A Memory V2 trace record: source, signal summary, salience score, and timestamps.
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    sourceId: str
    traceType: str
    signalSummary: dict[str, Any]
    salienceScore: float
    createdAt: str
    updatedAt: str


class AuditEventSummary(BaseModel):
    """
    Privacy-safe summary of an audit event (type, payload keys, timestamp; no full
    payload text).
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    eventType: str
    payloadKeys: list[str]
    createdAt: str
    fullTextIncluded: Literal[False]


class ApiUsageEventRecord(BaseModel):
    """Safe external API token/cost usage event with no prompt or response text."""

    model_config = ConfigDict(extra="forbid")

    id: str
    turnId: str | None
    conversationId: str | None
    providerId: str
    model: str
    inputTokens: int
    outputTokens: int
    totalTokens: int
    estimatedCost: float
    currency: str
    estimateMethod: str
    contextCharacterCount: int
    createdAt: str
    rawPromptIncluded: Literal[False]
    rawResponseIncluded: Literal[False]
    hiddenReasoningIncluded: Literal[False]
    secretValuesIncluded: Literal[False]


class ApiUsageSummary(BaseModel):
    """Aggregate token/cost summary for safe UI display."""

    model_config = ConfigDict(extra="forbid")

    eventCount: int
    totalInputTokens: int
    totalOutputTokens: int
    totalTokens: int
    totalEstimatedCost: float
    currency: str
    latest: ApiUsageEventRecord | None
    rawPromptIncluded: Literal[False]
    rawResponseIncluded: Literal[False]
    hiddenReasoningIncluded: Literal[False]
    secretValuesIncluded: Literal[False]


def database_path_for(layout: RinDataLayout) -> Path:
    """Return the full path to the SQLite database file for the given layout."""
    return layout.directories["databases"] / DATABASE_FILENAME


def open_readonly_database(path: Path) -> sqlite3.Connection:
    """Open the SQLite database in read-only mode with row factory enabled."""
    uri = f"file:{path.resolve()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def inspect_database(layout: RinDataLayout) -> DatabaseStatus:
    """
    Return a full snapshot of the database: schema version, table existence, and row
    counts.
    """
    path = database_path_for(layout)
    with open_readonly_database(path) as connection:
        applied_migrations = [
            int(row["version"])
            for row in connection.execute(
                "SELECT version FROM schema_migrations ORDER BY version ASC"
            ).fetchall()
        ]
        tables = [
            DatabaseTableStatus(
                name=table,
                exists=table_exists(connection, table),
                rowCount=count_rows(connection, table)
                if table_exists(connection, table)
                else 0,
            )
            for table in DATABASE_TABLES
        ]
        return DatabaseStatus(
            path=str(path),
            schemaVersion=max(applied_migrations, default=0),
            appliedMigrations=applied_migrations,
            tables=tables,
            counts=DatabaseCounts(
                auditEvents=count_rows_if_exists(connection, "audit_events"),
                rawEvents=count_rows_if_exists(connection, "raw_events"),
                conversations=count_rows_if_exists(connection, "conversations"),
                conversationTurns=count_rows_if_exists(
                    connection,
                    "conversation_turns",
                ),
                messages=count_rows_if_exists(connection, "messages"),
                messageMemoryContexts=count_rows_if_exists(
                    connection,
                    "message_memory_contexts",
                ),
                memoryItems=count_rows_if_exists(connection, "memory_items"),
                memoryMetadata=count_rows_if_exists(connection, "memory_metadata"),
                memoryV2TraceSources=count_rows_if_exists(
                    connection,
                    "memory_v2_trace_sources",
                ),
                memoryV2Traces=count_rows_if_exists(connection, "memory_v2_traces"),
                memoryV2TraceSignals=count_rows_if_exists(
                    connection,
                    "memory_v2_trace_signals",
                ),
                memoryV2RetrievalEvents=count_rows_if_exists(
                    connection,
                    "memory_v2_retrieval_events",
                ),
                apiUsageEvents=count_rows_if_exists(connection, "api_usage_events"),
                mindTurnSnapshots=count_rows_if_exists(
                    connection,
                    "mind_turn_snapshots",
                ),
                memoryCandidates=count_rows_if_exists(connection, "memory_candidates"),
                conversationSummaries=count_rows_if_exists(
                    connection,
                    "conversation_summaries",
                ),
                modelSummaryCandidates=count_rows_if_exists(
                    connection,
                    "model_summary_candidates",
                ),
                rinSelfModel=count_rows_if_exists(connection, "rin_self_model"),
                rinGrowthEvents=count_rows_if_exists(connection, "rin_growth_events"),
                memoryEmbeddings=count_rows_if_exists(connection, "memory_embeddings"),
                toolCapabilities=count_rows_if_exists(connection, "tool_capabilities"),
                agentIntents=count_rows_if_exists(connection, "agent_intents"),
                toolInvocationRequests=count_rows_if_exists(
                    connection,
                    "tool_invocation_requests",
                ),
                toolInvocationAudit=count_rows_if_exists(
                    connection,
                    "tool_invocation_audit",
                ),
                slowVariableVersions=count_rows_if_exists(
                    connection,
                    "slow_variable_versions",
                ),
                stateHistory=count_rows_if_exists(connection, "state_history"),
                toolInvocations=count_rows_if_exists(connection, "tool_invocations"),
            ),
        )


def list_conversations(
    layout: RinDataLayout,
    limit: int = 10,
) -> list[ConversationRecord]:
    """List recent conversations ordered by update time (capped at 100)."""
    safe_limit = max(1, min(limit, 100))
    with open_readonly_database(database_path_for(layout)) as connection:
        rows = connection.execute(
            """
            SELECT * FROM conversations
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()
        return [map_conversation(row) for row in rows]


def get_conversation(
    layout: RinDataLayout,
    conversation_id: str,
) -> ConversationRecord | None:
    """Look up a single conversation by ID, returning None if not found."""
    with open_readonly_database(database_path_for(layout)) as connection:
        row = connection.execute(
            "SELECT * FROM conversations WHERE id = ?",
            (conversation_id,),
        ).fetchone()
        return map_conversation(row) if row else None


def list_messages(
    layout: RinDataLayout,
    conversation_id: str,
) -> list[ConversationMessageRecord]:
    """
    List all messages in a conversation, ordered by creation time, with optional memory
    context.
    """
    with open_readonly_database(database_path_for(layout)) as connection:
        rows = connection.execute(
            """
            SELECT messages.*, message_memory_contexts.trace_json AS memory_context_json
            FROM messages
            LEFT JOIN message_memory_contexts
              ON message_memory_contexts.message_id = messages.id
            WHERE messages.conversation_id = ?
            ORDER BY messages.created_at ASC
            """,
            (conversation_id,),
        ).fetchall()
        return [map_message(row) for row in rows]


def list_legacy_memories(layout: RinDataLayout, limit: int = 20) -> list[MemoryRecord]:
    """List recent legacy memory items with their metadata (capped at 100)."""
    safe_limit = max(1, min(limit, 100))
    with open_readonly_database(database_path_for(layout)) as connection:
        join_column = memory_metadata_join_column(connection)
        if join_column:
            rows = connection.execute(
                f"""
                SELECT memory_items.*, memory_metadata.metadata_json
                FROM memory_items
                LEFT JOIN memory_metadata
                  ON memory_metadata.{join_column} = memory_items.id
                ORDER BY memory_items.updated_at DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT memory_items.*, NULL AS metadata_json
                FROM memory_items
                ORDER BY memory_items.updated_at DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
        return [map_memory(row) for row in rows]


def list_memory_v2_traces(
    layout: RinDataLayout,
    limit: int = 50,
) -> list[MemoryV2TraceRecord]:
    """List recent Memory V2 traces ordered by update time (capped at 100)."""
    safe_limit = max(1, min(limit, 100))
    with open_readonly_database(database_path_for(layout)) as connection:
        rows = connection.execute(
            """
            SELECT * FROM memory_v2_traces
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()
        return [map_memory_v2_trace(row) for row in rows]


def list_top_memory_v2_traces(
    layout: RinDataLayout,
    limit: int = 3,
) -> list[MemoryV2TraceRecord]:
    """List top Memory V2 traces ordered by salience score (capped at 10)."""
    safe_limit = max(1, min(limit, 10))
    with open_readonly_database(database_path_for(layout)) as connection:
        rows = connection.execute(
            """
            SELECT * FROM memory_v2_traces
            ORDER BY salience_score DESC, updated_at DESC, id ASC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()
        return [map_memory_v2_trace(row) for row in rows]


def list_audit_summaries(
    layout: RinDataLayout,
    limit: int = 20,
) -> list[AuditEventSummary]:
    """List recent audit event summaries (capped at 100)."""
    safe_limit = max(1, min(limit, 100))
    with open_readonly_database(database_path_for(layout)) as connection:
        rows = connection.execute(
            """
            SELECT * FROM audit_events
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()
        return [map_audit_summary(row) for row in rows]


def list_api_usage_events(
    layout: RinDataLayout,
    limit: int = 20,
) -> list[ApiUsageEventRecord]:
    """List recent API usage records without raw prompt/response text."""
    safe_limit = max(1, min(limit, 100))
    with open_readonly_database(database_path_for(layout)) as connection:
        if not table_exists(connection, "api_usage_events"):
            return []
        rows = connection.execute(
            """
            SELECT * FROM api_usage_events
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()
        return [map_api_usage_event(row) for row in rows]


def summarize_api_usage(layout: RinDataLayout) -> ApiUsageSummary:
    """Return aggregate API usage/cost totals for diagnostics and UI."""
    with open_readonly_database(database_path_for(layout)) as connection:
        if not table_exists(connection, "api_usage_events"):
            return empty_api_usage_summary()
        row = connection.execute(
            """
            SELECT
              COUNT(*) AS event_count,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(total_tokens), 0) AS total_tokens,
              COALESCE(SUM(estimated_cost), 0) AS estimated_cost,
              COALESCE(MAX(currency), 'CNY') AS currency
            FROM api_usage_events
            """
        ).fetchone()
    latest = list_api_usage_events(layout, limit=1)
    return ApiUsageSummary(
        eventCount=int(row["event_count"]),
        totalInputTokens=int(row["input_tokens"]),
        totalOutputTokens=int(row["output_tokens"]),
        totalTokens=int(row["total_tokens"]),
        totalEstimatedCost=round(float(row["estimated_cost"]), 8),
        currency=str(row["currency"]),
        latest=latest[0] if latest else None,
        rawPromptIncluded=False,
        rawResponseIncluded=False,
        hiddenReasoningIncluded=False,
        secretValuesIncluded=False,
    )


def get_latest_mind_snapshot(layout: RinDataLayout) -> RinMindSnapshot | None:
    """Return the latest safe RIN Mind snapshot, if one has been recorded."""
    with open_readonly_database(database_path_for(layout)) as connection:
        if not table_exists(connection, "mind_turn_snapshots"):
            return None
        row = connection.execute(
            """
            SELECT * FROM mind_turn_snapshots
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            """
        ).fetchone()
        return map_mind_snapshot(row) if row else None


def get_mind_snapshot_for_turn(
    layout: RinDataLayout,
    turn_id: str,
) -> RinMindSnapshot | None:
    """Return the safe RIN Mind snapshot for a specific turn."""
    with open_readonly_database(database_path_for(layout)) as connection:
        if not table_exists(connection, "mind_turn_snapshots"):
            return None
        row = connection.execute(
            "SELECT * FROM mind_turn_snapshots WHERE turn_id = ?",
            (turn_id,),
        ).fetchone()
        return map_mind_snapshot(row) if row else None


def list_recent_mind_snapshots(
    layout: RinDataLayout,
    *,
    limit: int = 20,
) -> list[RinMindSnapshot]:
    """Return recent safe RIN Mind snapshots for trend visualizations."""
    safe_limit = max(1, min(limit, 100))
    with open_readonly_database(database_path_for(layout)) as connection:
        if not table_exists(connection, "mind_turn_snapshots"):
            return []
        rows = connection.execute(
            """
            SELECT * FROM mind_turn_snapshots
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()
        return [map_mind_snapshot(row) for row in rows]


def list_mind_memory_candidates(
    layout: RinDataLayout,
    *,
    limit: int = 50,
    review_status: str | None = None,
    candidate_type: str | None = None,
    risk_level: str | None = None,
    active: bool | None = None,
) -> list[MemoryCandidate]:
    """List safe RIN Mind memory candidates without raw source message text."""
    safe_limit = max(1, min(limit, 100))
    with open_readonly_database(database_path_for(layout)) as connection:
        if not table_exists(connection, "memory_candidates"):
            return []
        ensure_projection = "SELECT * FROM memory_candidates"
        clauses: list[str] = []
        params: list[object] = []
        if review_status:
            clauses.append("review_status = ?")
            params.append(review_status)
        if candidate_type:
            clauses.append("type = ?")
            params.append(candidate_type)
        if risk_level:
            clauses.append("risk_level = ?")
            params.append(risk_level)
        if active is not None:
            clauses.append("active = ?")
            params.append(1 if active else 0)
        where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
        params.append(safe_limit)
        rows = connection.execute(
            f"""
            {ensure_projection}
            {where}
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
        return [map_memory_candidate(row) for row in rows]


def get_active_conversation_summary(
    layout: RinDataLayout,
    conversation_id: str,
) -> ConversationSummary | None:
    with open_readonly_database(database_path_for(layout)) as connection:
        if not table_exists(connection, "conversation_summaries"):
            return None
        row = connection.execute(
            """
            SELECT * FROM conversation_summaries
            WHERE conversation_id = ? AND active = 1
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
            """,
            (conversation_id,),
        ).fetchone()
        return map_conversation_summary(row) if row else None


def list_rin_growth_events(
    layout: RinDataLayout,
    *,
    limit: int = 50,
) -> list[RinGrowthEvent]:
    safe_limit = max(1, min(limit, 100))
    with open_readonly_database(database_path_for(layout)) as connection:
        if not table_exists(connection, "rin_growth_events"):
            return []
        rows = connection.execute(
            """
            SELECT * FROM rin_growth_events
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()
        return [map_rin_growth_event(row) for row in rows]


def list_tool_invocation_requests(
    layout: RinDataLayout,
    *,
    limit: int = 50,
) -> list[ToolInvocationRequest]:
    safe_limit = max(1, min(limit, 100))
    with open_readonly_database(database_path_for(layout)) as connection:
        if not table_exists(connection, "tool_invocation_requests"):
            return []
        rows = connection.execute(
            """
            SELECT * FROM tool_invocation_requests
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()
        return [map_tool_invocation_request(row) for row in rows]


def list_memory_embeddings(
    layout: RinDataLayout,
    *,
    limit: int = 50,
) -> list[MemoryEmbeddingEntry]:
    safe_limit = max(1, min(limit, 100))
    with open_readonly_database(database_path_for(layout)) as connection:
        if not table_exists(connection, "memory_embeddings"):
            return []
        rows = connection.execute(
            """
            SELECT * FROM memory_embeddings
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (safe_limit,),
        ).fetchall()
        return [map_memory_embedding(row) for row in rows]


def empty_api_usage_summary() -> ApiUsageSummary:
    return ApiUsageSummary(
        eventCount=0,
        totalInputTokens=0,
        totalOutputTokens=0,
        totalTokens=0,
        totalEstimatedCost=0.0,
        currency="CNY",
        latest=None,
        rawPromptIncluded=False,
        rawResponseIncluded=False,
        hiddenReasoningIncluded=False,
        secretValuesIncluded=False,
    )


def table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    """Check whether a table exists in the connected database."""
    row = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def count_rows_if_exists(connection: sqlite3.Connection, table_name: str) -> int:
    """Count rows in a table, returning 0 if the table does not exist."""
    return (
        count_rows(connection, table_name)
        if table_exists(connection, table_name)
        else 0
    )


def count_rows(connection: sqlite3.Connection, table_name: str) -> int:
    """Count rows in a known table (raises ValueError for unsupported table names)."""
    if table_name not in DATABASE_TABLES:
        raise ValueError(f"Unsupported table name: {table_name}")
    row = connection.execute(f"SELECT COUNT(*) AS count FROM {table_name}").fetchone()
    return int(row["count"])


def memory_metadata_join_column(connection: sqlite3.Connection) -> str | None:
    """Return the supported legacy memory metadata join column, if present."""
    columns = {
        str(row["name"])
        for row in connection.execute("PRAGMA table_info(memory_metadata)").fetchall()
    }
    if "memory_item_id" in columns:
        return "memory_item_id"
    if "memory_id" in columns:
        return "memory_id"
    return None


def map_conversation(row: sqlite3.Row) -> ConversationRecord:
    return ConversationRecord(
        id=str(row["id"]),
        title=str(row["title"]),
        createdAt=str(row["created_at"]),
        updatedAt=str(row["updated_at"]),
    )


def map_message(row: sqlite3.Row) -> ConversationMessageRecord:
    return ConversationMessageRecord(
        id=str(row["id"]),
        conversationId=str(row["conversation_id"]),
        role=row["role"],
        content=str(row["content"]),
        modelAdapter=row["model_adapter"],
        createdAt=str(row["created_at"]),
        memoryContext=parse_memory_context(row["memory_context_json"]),
    )


def map_memory(row: sqlite3.Row) -> MemoryRecord:
    metadata = json.loads(row["metadata_json"] or "{}")
    return MemoryRecord(
        id=str(row["id"]),
        memoryType=str(row["memory_type"]),
        content=json.loads(str(row["content_json"])),
        metadata=MemoryMetadata(
            tags=list(metadata.get("tags", [])),
            importance=metadata.get("importance", "normal"),
            confidence=metadata.get("confidence", "medium"),
            source=metadata.get("source"),
            reviewedAt=metadata.get("reviewedAt"),
            acceptedAt=metadata.get("acceptedAt"),
        ),
        sourceMessageId=row["source_message_id"],
        status=row["status"],
        createdAt=str(row["created_at"]),
        updatedAt=str(row["updated_at"]),
    )


def map_memory_v2_trace(row: sqlite3.Row) -> MemoryV2TraceRecord:
    keys = set(row.keys())
    return MemoryV2TraceRecord(
        id=str(row["id"]),
        sourceId=str(row["source_id"] if "source_id" in keys else row["source_ref_id"]),
        traceType=str(row["trace_type"] if "trace_type" in keys else row["trace_kind"]),
        signalSummary=json.loads(str(row["signal_summary_json"])),
        salienceScore=float(row["salience_score"]),
        createdAt=str(row["created_at"]),
        updatedAt=str(row["updated_at"]),
    )


def map_audit_summary(row: sqlite3.Row) -> AuditEventSummary:
    try:
        payload = json.loads(str(row["payload_json"]))
    except json.JSONDecodeError:
        payload = {}
    return AuditEventSummary(
        id=str(row["id"]),
        eventType=str(row["event_type"]),
        payloadKeys=sorted(payload.keys()) if isinstance(payload, dict) else [],
        createdAt=str(row["created_at"]),
        fullTextIncluded=False,
    )


def map_api_usage_event(row: sqlite3.Row) -> ApiUsageEventRecord:
    return ApiUsageEventRecord(
        id=str(row["id"]),
        turnId=row["turn_id"],
        conversationId=row["conversation_id"],
        providerId=str(row["provider_id"]),
        model=str(row["model"]),
        inputTokens=int(row["input_tokens"]),
        outputTokens=int(row["output_tokens"]),
        totalTokens=int(row["total_tokens"]),
        estimatedCost=float(row["estimated_cost"]),
        currency=str(row["currency"]),
        estimateMethod=str(row["estimate_method"]),
        contextCharacterCount=int(row["context_character_count"]),
        createdAt=str(row["created_at"]),
        rawPromptIncluded=False,
        rawResponseIncluded=False,
        hiddenReasoningIncluded=False,
        secretValuesIncluded=False,
    )


def map_mind_snapshot(row: sqlite3.Row) -> RinMindSnapshot:
    keys = set(row.keys())
    lifecycle_payload = (
        json.loads(str(row["lifecycle_json"]))
        if "lifecycle_json" in keys and row["lifecycle_json"]
        else {
            "observed": True,
            "understood": True,
            "planned": True,
            "responded": True,
            "candidateGenerated": False,
            "stored": True,
            "awaitingReview": False,
            "stages": [],
            "rawTextIncluded": False,
        }
    )
    policy_payload = (
        json.loads(str(row["policy_json"]))
        if "policy_json" in keys and row["policy_json"]
        else {
            "contextMaxCharacters": 8000,
            "recentHistorySelectedLimit": 8,
            "recentHistoryCandidateLimit": 20,
            "memoryRetrievalCandidateLimit": 100,
            "memoryMaxSelected": 5,
            "autopromoteConfidence": 0.8,
            "ownerStateTtlHours": 6,
            "enableEmbeddings": False,
            "embeddingProvider": "disabled",
            "enableModelSummaries": False,
            "enableAgentTools": False,
            "allowHighRiskMemoryExport": False,
            "selfModelAutoApply": False,
            "warnings": [],
            "dangerousDefaultsDisabled": True,
            "secretValuesIncluded": False,
        }
    )
    return RinMindSnapshot(
        messageUnderstanding=json.loads(str(row["message_understanding_json"])),
        ownerState=json.loads(str(row["owner_state_json"])),
        contextPlan=json.loads(str(row["context_plan_json"])),
        memoryRetrieval=json.loads(str(row["memory_retrieval_json"])),
        memoryCandidates=json.loads(str(row["memory_candidates_json"])),
        conversationSummary=json.loads(str(row["conversation_summary_json"]))
        if "conversation_summary_json" in keys and row["conversation_summary_json"]
        else None,
        growthEvents=json.loads(str(row["growth_events_json"]))
        if "growth_events_json" in keys and row["growth_events_json"]
        else [],
        toolInvocationRequests=json.loads(str(row["tool_requests_json"]))
        if "tool_requests_json" in keys and row["tool_requests_json"]
        else [],
        responsePlan=json.loads(str(row["response_plan_json"])),
        lifecycle=MindLifecycle.model_validate(lifecycle_payload),
        policy=MindPolicyMetadata.model_validate(policy_payload),
        createdAt=str(row["created_at"]),
        safeForUi=True,
        rawTextIncluded=False,
        secretValuesIncluded=False,
    )


def map_memory_candidate(row: sqlite3.Row) -> MemoryCandidate:
    keys = set(row.keys())
    summary = str(row["summary"])
    return MemoryCandidate(
        id=str(row["id"]),
        type=str(row["type"]),  # type: ignore[arg-type]
        summary=summary,
        safeSummary=str(row["safe_summary"])
        if "safe_summary" in keys and row["safe_summary"]
        else summary,
        normalizedValue=row["normalized_value"] if "normalized_value" in keys else None,
        rawTextIncluded=False,
        redacted=bool(row["redacted"]) if "redacted" in keys else False,
        sourceKind=str(row["source_kind"])
        if "source_kind" in keys and row["source_kind"]
        else "owner_message",
        language=str(row["language"])
        if "language" in keys and row["language"]
        else "unknown",
        sourceMessageIds=[str(row["source_message_id"])],
        confidence=float(row["confidence"]),
        salience=float(row["salience"]),
        stability=str(row["stability"]),
        decayPolicy=str(row["decay_policy"]),
        riskLevel=str(row["risk_level"]),  # type: ignore[arg-type]
        reviewStatus=str(row["review_status"]),  # type: ignore[arg-type]
        active=bool(row["active"]),
        tags=list(json.loads(str(row["tags_json"]))),
        evidenceHashes=list(json.loads(str(row["evidence_hashes_json"]))),
        contradictionOf=row["contradiction_of"],
        supersedes=row["supersedes"],
        ownerConfirmed=bool(row["owner_confirmed"]),
        autoPromote=bool(row["auto_promote"]),
        reasons=list(json.loads(str(row["reasons_json"]))),
        createdAt=str(row["created_at"]) if "created_at" in keys else None,
        updatedAt=str(row["updated_at"]) if "updated_at" in keys else None,
    )


def map_conversation_summary(row: sqlite3.Row) -> ConversationSummary:
    payload = json.loads(str(row["summary_json"]))
    return ConversationSummary.model_validate(payload)


def map_rin_growth_event(row: sqlite3.Row) -> RinGrowthEvent:
    return RinGrowthEvent(
        id=str(row["id"]),
        eventType=str(row["event_type"]),  # type: ignore[arg-type]
        summary=str(row["summary"]),
        sourceTurnId=str(row["source_turn_id"]),
        sourceMessageId=str(row["source_message_id"]),
        candidate=json.loads(str(row["candidate_json"])),
        riskLevel=str(row["risk_level"]),  # type: ignore[arg-type]
        reviewStatus=str(row["review_status"]),  # type: ignore[arg-type]
        createdAt=str(row["created_at"]),
        appliedAt=row["applied_at"],
        active=bool(row["active"]),
        rawTextIncluded=False,
    )


def map_tool_invocation_request(row: sqlite3.Row) -> ToolInvocationRequest:
    return ToolInvocationRequest(
        id=str(row["id"]),
        sourceTurnId=str(row["source_turn_id"]),
        intent=str(row["intent"]),
        toolName=str(row["tool_name"]),
        actionSummary=str(row["action_summary"]),
        riskLevel=str(row["risk_level"]),  # type: ignore[arg-type]
        requiresOwnerApproval=bool(row["requires_owner_approval"]),
        status=str(row["status"]),  # type: ignore[arg-type]
        createdAt=str(row["created_at"]),
        rawInputIncluded=False,
        secretValuesIncluded=False,
    )


def map_memory_embedding(row: sqlite3.Row) -> MemoryEmbeddingEntry:
    return MemoryEmbeddingEntry(
        id=str(row["id"]),
        sourceKind=str(row["source_kind"]),  # type: ignore[arg-type]
        sourceId=str(row["source_id"]),
        embeddingProvider=str(row["embedding_provider"]),
        embeddingModel=str(row["embedding_model"]),
        vector=list(json.loads(str(row["vector_json"]))),
        dimensions=int(row["dimensions"]),
        contentHash=str(row["content_hash"]),
        createdAt=str(row["created_at"]),
        active=bool(row["active"]),
        rawTextIncluded=False,
    )


def parse_memory_context(raw: str | None) -> MemoryInjectionTrace | None:
    if not raw:
        return None
    try:
        return MemoryInjectionTrace.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValueError):
        return None
