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


def parse_memory_context(raw: str | None) -> MemoryInjectionTrace | None:
    if not raw:
        return None
    try:
        return MemoryInjectionTrace.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValueError):
        return None
