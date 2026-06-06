from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from uuid import uuid4

from rin.contracts import ConversationMessageRecord, ConversationRecord
from rin.database.readonly import database_path_for
from rin.diagnostics.safety import assert_safe_temp_data_dir
from rin.storage import RinDataLayout, create_data_layout


def assert_safe_write_layout(layout: RinDataLayout) -> Path:
    return assert_safe_temp_data_dir(layout.rootDir)


def initialize_temp_database(layout: RinDataLayout) -> Path:
    assert_safe_write_layout(layout)
    layout.directories["databases"].mkdir(parents=True, exist_ok=True)
    path = database_path_for(layout)
    with sqlite3.connect(path) as connection:
        connection.executescript(SCHEMA_SQL)
        connection.executemany(
            "INSERT OR IGNORE INTO schema_migrations VALUES (?, ?, ?)",
            [
                (1, "initial", "2026-06-05T00:00:00.000Z"),
                (6, "v2", "2026-06-05T00:00:00.000Z"),
            ],
        )
    return path


def create_temp_layout_database(root: Path | str) -> RinDataLayout:
    layout = create_data_layout(str(root), cwd="/")
    initialize_temp_database(layout)
    return layout


def create_conversation(
    layout: RinDataLayout,
    title: str,
    now: str,
    conversation_id: str | None = None,
) -> ConversationRecord:
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
            connection.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (now, conversation_id),
            )
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


def append_audit_event_in_transaction(
    connection: sqlite3.Connection,
    event_type: str,
    payload: dict[str, object],
    now: str,
    event_id: str | None = None,
) -> str:
    event_id = event_id or str(uuid4())
    connection.execute(
        "INSERT INTO audit_events (id, event_type, payload_json, created_at) "
        "VALUES (?, ?, ?, ?)",
        (event_id, event_type, json.dumps(payload, sort_keys=True), now),
    )
    return event_id


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
CREATE TABLE IF NOT EXISTS raw_events (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS slow_variable_versions (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS state_history (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS tool_invocations (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS export_bundles (id TEXT PRIMARY KEY);
"""
