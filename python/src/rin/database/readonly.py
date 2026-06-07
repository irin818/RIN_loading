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
    "slow_variable_versions",
    "state_history",
    "tool_invocations",
)


class DatabaseTableStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    exists: bool
    rowCount: int


class DatabaseCounts(BaseModel):
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
    messageMemoryContexts: int
    slowVariableVersions: int
    stateHistory: int
    toolInvocations: int


class DatabaseStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    schemaVersion: int
    appliedMigrations: list[int]
    tables: list[DatabaseTableStatus]
    counts: DatabaseCounts


class MemoryMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tags: list[str]
    importance: Literal["low", "normal", "high"]
    confidence: Literal["low", "medium", "high"]
    source: str | None
    reviewedAt: str | None
    acceptedAt: str | None


class MemoryRecord(BaseModel):
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
    model_config = ConfigDict(extra="forbid")

    id: str
    sourceId: str
    traceType: str
    signalSummary: dict[str, Any]
    salienceScore: float
    createdAt: str
    updatedAt: str


class AuditEventSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    eventType: str
    payloadKeys: list[str]
    createdAt: str
    fullTextIncluded: Literal[False]


def database_path_for(layout: RinDataLayout) -> Path:
    return layout.directories["databases"] / DATABASE_FILENAME


def open_readonly_database(path: Path) -> sqlite3.Connection:
    uri = f"file:{path.resolve()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def inspect_database(layout: RinDataLayout) -> DatabaseStatus:
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
    safe_limit = max(1, min(limit, 100))
    with open_readonly_database(database_path_for(layout)) as connection:
        rows = connection.execute(
            """
            SELECT memory_items.*, memory_metadata.metadata_json
            FROM memory_items
            LEFT JOIN memory_metadata
              ON memory_metadata.memory_item_id = memory_items.id
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


def list_audit_summaries(
    layout: RinDataLayout,
    limit: int = 20,
) -> list[AuditEventSummary]:
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


def table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    row = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def count_rows_if_exists(connection: sqlite3.Connection, table_name: str) -> int:
    return (
        count_rows(connection, table_name)
        if table_exists(connection, table_name)
        else 0
    )


def count_rows(connection: sqlite3.Connection, table_name: str) -> int:
    if table_name not in DATABASE_TABLES:
        raise ValueError(f"Unsupported table name: {table_name}")
    row = connection.execute(f"SELECT COUNT(*) AS count FROM {table_name}").fetchone()
    return int(row["count"])


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


def parse_memory_context(raw: str | None) -> MemoryInjectionTrace | None:
    if not raw:
        return None
    try:
        return MemoryInjectionTrace.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValueError):
        return None
