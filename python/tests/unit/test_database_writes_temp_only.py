import shutil
import sqlite3
from pathlib import Path

import pytest

from rin.database import (
    append_audit_event,
    append_message,
    create_conversation,
    create_memory_trace,
    create_temp_layout_database,
    inspect_database,
    list_audit_summaries,
    list_conversations,
    list_messages,
    record_failed_turn,
)
from rin.diagnostics.safety import UnsafeDataPathError, create_temp_data_dir
from rin.storage import RinDataLayout, create_data_layout

NOW = "2026-06-05T00:00:00.000Z"


def create_layout() -> RinDataLayout:
    temp = create_temp_data_dir()
    return create_temp_layout_database(temp.path)


def test_rejects_unmarked_production_data_path(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import rin.diagnostics.safety as safety

    production = tmp_path / ".rin-data"
    monkeypatch.setattr(safety, "PRODUCTION_RIN_DATA_DIR", production)
    layout = create_data_layout(str(production), cwd="/")

    with pytest.raises(UnsafeDataPathError):
        create_conversation(layout, "blocked", NOW)


def test_creates_conversation_and_messages_transactionally() -> None:
    layout = create_layout()
    try:
        conversation = create_conversation(layout, "Temp conversation", NOW, "conv-1")
        owner = append_message(layout, conversation.id, "owner", "hello", NOW, "msg-1")
        rin = append_message(
            layout,
            conversation.id,
            "rin",
            "hello back",
            NOW,
            "msg-2",
            "rin-mock-local",
        )

        assert list_conversations(layout)[0].id == "conv-1"
        assert [item.id for item in list_messages(layout, "conv-1")] == [
            owner.id,
            rin.id,
        ]
        status = inspect_database(layout)
        assert status.counts.conversations == 1
        assert status.counts.messages == 2
        assert status.counts.auditEvents == 3
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_duplicate_write_fails_without_overwrite() -> None:
    layout = create_layout()
    try:
        create_conversation(layout, "Temp conversation", NOW, "conv-1")

        with pytest.raises(sqlite3.IntegrityError):
            create_conversation(layout, "Duplicate", NOW, "conv-1")

        assert list_conversations(layout)[0].title == "Temp conversation"
        assert inspect_database(layout).counts.conversations == 1
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_failed_turn_audit_and_memory_trace_writes_are_temp_only() -> None:
    layout = create_layout()
    try:
        conversation = create_conversation(layout, "Runtime failure", NOW, "conv-1")
        owner = append_message(layout, conversation.id, "owner", "hello", NOW, "msg-1")
        record_failed_turn(
            layout,
            "turn-1",
            conversation.id,
            owner.id,
            "MODEL_RESPONSE_INVALID",
            NOW,
        )
        create_memory_trace(
            layout,
            "trace-1",
            "source-ref-1",
            {"schemaVersion": 1, "rawTextIncluded": False},
            0.7,
            NOW,
        )
        append_audit_event(layout, "safe.test", {"privateText": "hidden"}, NOW)

        status = inspect_database(layout)
        summaries = list_audit_summaries(layout)

        assert status.counts.conversationTurns == 1
        assert status.counts.memoryV2Traces == 1
        assert any(item.eventType == "safe.test" for item in summaries)
        assert "hidden" not in summaries[0].model_dump_json()
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)
