import shutil
import sqlite3
from pathlib import Path

import pytest

from rin.database import (
    append_audit_event,
    append_message,
    create_conversation,
    create_memory_candidate_records,
    create_memory_trace,
    create_mind_turn_snapshot,
    create_temp_layout_database,
    get_latest_mind_snapshot,
    get_mind_snapshot_for_turn,
    initialize_temp_database,
    inspect_database,
    list_audit_summaries,
    list_conversations,
    list_messages,
    list_mind_memory_candidates,
    record_failed_turn,
    update_memory_candidate_review,
)
from rin.diagnostics.safety import UnsafeDataPathError, create_temp_data_dir
from rin.mind import build_rin_mind_snapshot
from rin.storage import RinDataLayout, create_data_layout

NOW = "2026-06-05T00:00:00.000Z"


def create_layout() -> RinDataLayout:
    temp = create_temp_data_dir()
    return create_temp_layout_database(temp.path)


def test_allows_initialized_production_root_but_rejects_children(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import rin.diagnostics.safety as safety

    production = tmp_path / ".rin-data"
    monkeypatch.setattr(safety, "PRODUCTION_RIN_DATA_DIR", production)
    layout = create_data_layout(str(production), cwd="/")
    initialize_temp_database(layout)

    conversation = create_conversation(layout, "allowed", NOW, "conv-prod-test")

    assert conversation.id == "conv-prod-test"
    with pytest.raises(UnsafeDataPathError):
        create_conversation(
            create_data_layout(str(production / "databases"), cwd="/"),
            "blocked child",
            NOW,
        )


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
            "rin-mock-test",
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


def test_append_message_rejects_missing_conversation_without_orphan_write() -> None:
    layout = create_layout()
    try:
        with pytest.raises(ValueError, match="Conversation not found"):
            append_message(layout, "missing-conv", "owner", "hello", NOW, "msg-orphan")

        status = inspect_database(layout)
        assert status.counts.messages == 0
        assert status.counts.auditEvents == 0
        assert list_messages(layout, "missing-conv") == []
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


def test_mind_snapshots_and_candidates_are_safe_additive_tables() -> None:
    layout = create_layout()
    try:
        conversation = create_conversation(layout, "Mind turn", NOW, "conv-mind")
        owner = append_message(
            layout,
            conversation.id,
            "owner",
            "I prefer concise RIN progress reports.",
            NOW,
            "msg-mind-owner",
        )
        snapshot = build_rin_mind_snapshot(
            owner_message_id=owner.id,
            owner_content=owner.content,
            created_at=NOW,
            prior_messages=[],
            memory_traces=[],
            profile_sections=["rin_profile"],
            budget=6000,
        )

        candidate_ids = create_memory_candidate_records(
            layout,
            conversation_id=conversation.id,
            candidates=snapshot.memoryCandidates,
            now=NOW,
        )
        snapshot_id = create_mind_turn_snapshot(
            layout,
            turn_id="turn-mind",
            conversation_id=conversation.id,
            snapshot=snapshot,
            now=NOW,
            snapshot_id="mind-snapshot-1",
        )

        latest = get_latest_mind_snapshot(layout)
        by_turn = get_mind_snapshot_for_turn(layout, "turn-mind")
        candidates = list_mind_memory_candidates(layout)
        status = inspect_database(layout)

        assert snapshot_id == "mind-snapshot-1"
        assert candidate_ids == [snapshot.memoryCandidates[0].id]
        assert latest is not None
        assert by_turn == latest
        assert latest.safeForUi is True
        assert latest.rawTextIncluded is False
        assert latest.messageUnderstanding.mode == "preference_expression"
        assert latest.memoryCandidates[0].autoPromote is True
        assert candidates[0].summary == "Owner expressed a stable owner preference."
        assert candidates[0].ownerConfirmed is False
        assert status.counts.mindTurnSnapshots == 1
        assert status.counts.memoryCandidates == 1
        assert status.counts.conversationSummaries == 0

        updated = update_memory_candidate_review(
            layout,
            candidate_id=candidates[0].id,
            review_status="rejected",
            active=False,
            owner_confirmed=False,
            now=NOW,
        )
        reviewed = list_mind_memory_candidates(layout)[0]

        assert updated is True
        assert reviewed.reviewStatus == "rejected"
        assert reviewed.active is False
        assert "I prefer" not in latest.model_dump_json()
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)
