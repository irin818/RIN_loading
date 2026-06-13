import hashlib
import json
import shutil
import sqlite3
from pathlib import Path
from typing import Any

import pytest

from rin.database import (
    database_path_for,
    get_conversation,
    inspect_database,
    list_audit_summaries,
    list_conversations,
    list_legacy_memories,
    list_memory_v2_traces,
    list_messages,
    open_readonly_database,
)
from rin.diagnostics.safety import create_temp_data_dir
from rin.storage import RinDataLayout, create_data_layout


def create_database_fixture() -> RinDataLayout:
    temp_dir = create_temp_data_dir()
    layout = create_data_layout(str(temp_dir.path), cwd="/")
    layout.directories["databases"].mkdir(parents=True, exist_ok=True)
    db_path = database_path_for(layout)
    connection = sqlite3.connect(db_path)
    try:
        create_schema(connection)
        seed_rows(connection)
        connection.commit()
    finally:
        connection.close()
    return layout


def create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
        CREATE TABLE audit_events (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE raw_events (id TEXT PRIMARY KEY);
        CREATE TABLE conversations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE conversation_turns (
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
        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          model_adapter TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE message_memory_contexts (
          message_id TEXT PRIMARY KEY,
          trace_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE memory_items (
          id TEXT PRIMARY KEY,
          memory_type TEXT NOT NULL,
          content_json TEXT NOT NULL,
          source_message_id TEXT,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE memory_metadata (
          memory_item_id TEXT PRIMARY KEY,
          metadata_json TEXT NOT NULL,
          reviewed_at TEXT,
          accepted_at TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE memory_v2_trace_sources (id TEXT PRIMARY KEY);
        CREATE TABLE memory_v2_traces (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL,
          trace_type TEXT NOT NULL,
          signal_summary_json TEXT NOT NULL,
          salience_score REAL NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE memory_v2_trace_signals (id TEXT PRIMARY KEY);
        CREATE TABLE memory_v2_retrieval_events (id TEXT PRIMARY KEY);
        CREATE TABLE slow_variable_versions (id TEXT PRIMARY KEY);
        CREATE TABLE state_history (id TEXT PRIMARY KEY);
        CREATE TABLE tool_invocations (id TEXT PRIMARY KEY);
        CREATE TABLE export_bundles (id TEXT PRIMARY KEY);
        """
    )


def seed_rows(connection: sqlite3.Connection) -> None:
    connection.executemany(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
        [
            (1, "initial", "2026-06-05T00:00:00.000Z"),
            (6, "v2", "2026-06-05T00:00:00.000Z"),
        ],
    )
    connection.execute(
        "INSERT INTO conversations VALUES (?, ?, ?, ?)",
        (
            "conv-1",
            "Synthetic chat",
            "2026-06-05T00:00:00.000Z",
            "2026-06-05T00:02:00.000Z",
        ),
    )
    connection.execute(
        "INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?)",
        (
            "msg-owner",
            "conv-1",
            "owner",
            "Private owner text should only be in record content.",
            None,
            "2026-06-05T00:01:00.000Z",
        ),
    )
    connection.execute(
        "INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?)",
        (
            "msg-rin",
            "conv-1",
            "rin",
            "Synthetic reply.",
            "rin-mock-test",
            "2026-06-05T00:02:00.000Z",
        ),
    )
    connection.execute(
        "INSERT INTO message_memory_contexts VALUES (?, ?, ?)",
        ("msg-rin", json.dumps(memory_trace()), "2026-06-05T00:02:00.000Z"),
    )
    connection.execute(
        "INSERT INTO memory_items VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            "mem-1",
            "preference",
            json.dumps({"text": "Synthetic memory"}),
            "msg-owner",
            "accepted",
            "2026-06-05T00:01:00.000Z",
            "2026-06-05T00:01:00.000Z",
        ),
    )
    connection.execute(
        "INSERT INTO memory_metadata VALUES (?, ?, ?, ?, ?)",
        (
            "mem-1",
            json.dumps(
                {
                    "tags": ["report"],
                    "importance": "normal",
                    "confidence": "medium",
                    "source": "synthetic",
                    "reviewedAt": None,
                    "acceptedAt": "2026-06-05T00:01:00.000Z",
                }
            ),
            None,
            "2026-06-05T00:01:00.000Z",
            "2026-06-05T00:01:00.000Z",
        ),
    )
    connection.execute(
        "INSERT INTO memory_v2_traces VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            "trace-1",
            "mem-1",
            "legacy_memory",
            json.dumps({"signalTypes": ["preference"]}),
            0.7,
            "2026-06-05T00:01:00.000Z",
            "2026-06-05T00:01:00.000Z",
        ),
    )
    connection.execute(
        "INSERT INTO audit_events VALUES (?, ?, ?, ?)",
        (
            "audit-1",
            "conversation.message_appended",
            json.dumps({"conversationId": "conv-1", "privateText": "hidden"}),
            "2026-06-05T00:02:00.000Z",
        ),
    )


def memory_trace() -> dict[str, Any]:
    return {
        "injectedMemoryCount": 1,
        "injectedMemoryIds": ["mem-1"],
        "deterministicInjectedMemoryIds": ["mem-1"],
        "semanticInjectedMemoryIds": [],
        "semanticCandidateIds": [],
        "semanticContextExpansionEnabled": False,
        "memoryContextCharacterCount": 16,
        "skippedByBudgetCount": 0,
        "skippedByRelevanceCount": 0,
        "skippedByMaxCountCount": 0,
        "items": [
            {
                "memoryId": "mem-1",
                "memoryType": "preference",
                "matchedKeywords": ["report"],
                "overlapCount": 1,
                "latinTokenMatchCount": 1,
                "cjkBigramMatchCount": 0,
                "normalizedQueryTokenCount": 2,
                "typeMatchBonus": 0.2,
                "matchedTypeSignals": ["prefer"],
                "matchedTags": ["report"],
                "tagMatchBonus": 0.1,
                "importanceBonus": 0.0,
                "confidenceAdjustment": 0.0,
                "metadataBonus": 0.1,
                "metadataSignals": ["tag:report"],
                "contextSource": "deterministic",
                "wasInjected": True,
                "skippedReason": None,
                "snippetLength": 16,
            }
        ],
    }


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_inspects_database_without_modifying_hash() -> None:
    layout = create_database_fixture()
    try:
        before = file_hash(database_path_for(layout))

        status = inspect_database(layout)

        assert status.schemaVersion == 6
        assert status.counts.conversations == 1
        assert status.counts.messages == 2
        assert status.counts.memoryV2Traces == 1
        assert file_hash(database_path_for(layout)) == before
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_lists_conversations_messages_and_memory() -> None:
    layout = create_database_fixture()
    try:
        conversations = list_conversations(layout)
        messages = list_messages(layout, "conv-1")
        memories = list_legacy_memories(layout)
        traces = list_memory_v2_traces(layout)

        assert conversations[0].id == "conv-1"
        assert get_conversation(layout, "conv-1") == conversations[0]
        assert [message.id for message in messages] == ["msg-owner", "msg-rin"]
        assert messages[1].memoryContext is not None
        assert memories[0].id == "mem-1"
        assert traces[0].id == "trace-1"
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_legacy_memory_metadata_can_join_on_memory_id_column() -> None:
    layout = create_database_fixture()
    try:
        connection = sqlite3.connect(database_path_for(layout))
        try:
            connection.execute(
                "ALTER TABLE memory_metadata RENAME COLUMN memory_item_id TO memory_id"
            )
            connection.commit()
        finally:
            connection.close()

        memories = list_legacy_memories(layout)

        assert memories[0].id == "mem-1"
        assert memories[0].metadata.source == "synthetic"
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_audit_summaries_do_not_include_payload_text() -> None:
    layout = create_database_fixture()
    try:
        summaries = list_audit_summaries(layout)
        dumped = summaries[0].model_dump_json()

        assert summaries[0].payloadKeys == ["conversationId", "privateText"]
        assert summaries[0].fullTextIncluded is False
        assert "hidden" not in dumped
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_readonly_connection_rejects_writes() -> None:
    layout = create_database_fixture()
    try:
        with (
            open_readonly_database(database_path_for(layout)) as connection,
            pytest.raises(sqlite3.OperationalError),
        ):
            connection.execute(
                "INSERT INTO conversations VALUES (?, ?, ?, ?)",
                ("blocked", "blocked", "now", "now"),
            )
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)
