"""Lightweight benchmark-style regression tests for core runtime paths."""

from __future__ import annotations

import shutil
from time import perf_counter

import pytest

from rin.context import build_context_v2_report, segment
from rin.contracts import ModelRequest, ModelResponse, ModelResponseMetadata
from rin.conversation import RuntimeClock, run_conversation_turn
from rin.database import (
    append_message,
    create_conversation,
    create_temp_layout_database,
    inspect_database,
    list_conversations,
    list_messages,
)
from rin.diagnostics.safety import create_temp_data_dir
from rin.memory import MemoryV2SourceMessage, analyze_memory_v2_source
from rin.storage import RinDataLayout

NOW = "2026-06-05T00:00:00.000Z"


class BenchmarkAdapter:
    id = "rin-benchmark-local"

    async def generate(self, request: ModelRequest) -> ModelResponse:
        return ModelResponse(
            content="Benchmark reply.",
            adapterId=self.id,
            metadata=ModelResponseMetadata(
                externalProvider=False,
                memoryWriteRequested=False,
                toolCallRequested=False,
            ),
        )


def create_layout() -> RinDataLayout:
    temp = create_temp_data_dir("rin-python-benchmark-")
    return create_temp_layout_database(temp.path)


def assert_under_seconds(label: str, started_at: float, threshold: float) -> None:
    elapsed = perf_counter() - started_at
    assert elapsed < threshold, f"{label} took {elapsed:.3f}s >= {threshold:.3f}s"


def test_context_assembly_regression_budget() -> None:
    started_at = perf_counter()
    for index in range(500):
        report = build_context_v2_report(
            [
                segment("system", "system", "system", "sys", True),
                segment(
                    "current_owner_message",
                    f"owner-{index}",
                    f"owner:{index}",
                    "latest owner message",
                    True,
                ),
                segment(
                    "short_term_window",
                    f"history-{index}",
                    f"history:{index}",
                    "history " * 20,
                    False,
                ),
                segment(
                    "memory_v2_trace",
                    f"memory-{index}",
                    f"memory:{index}",
                    "memory summary " * 15,
                    False,
                ),
            ]
        )
        assert report.latestOwnerMessagePreserved is True
    assert_under_seconds("context assembly benchmark", started_at, 5.0)


def test_memory_signal_extraction_regression_budget() -> None:
    started_at = perf_counter()
    for index in range(1000):
        analysis = analyze_memory_v2_source(
            MemoryV2SourceMessage(
                messageId=f"message-{index}",
                conversationId="conversation",
                role="owner",
                content="I prefer concise local model progress updates.",
                createdAt=NOW,
            ),
            now=NOW,
        )
        assert analysis.decision == "promoted"
    assert_under_seconds("memory signal benchmark", started_at, 5.0)


def test_database_read_regression_budget() -> None:
    layout = create_layout()
    try:
        conversation = create_conversation(layout, "Benchmark", NOW, "bench-conv")
        for index in range(12):
            append_message(
                layout,
                conversation.id,
                "owner" if index % 2 == 0 else "rin",
                f"message {index}",
                NOW,
                f"message-{index}",
            )

        started_at = perf_counter()
        for _ in range(200):
            assert inspect_database(layout).counts.messages == 12
            assert list_conversations(layout, limit=5)
            assert len(list_messages(layout, conversation.id)) == 12
        assert_under_seconds("database read benchmark", started_at, 5.0)
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_full_turn_mock_latency_regression_budget() -> None:
    layout = create_layout()
    try:
        started_at = perf_counter()
        result = await run_conversation_turn(
            layout,
            "I prefer concise status updates.",
            BenchmarkAdapter(),
            clock=RuntimeClock(NOW),
        )
        assert result.status == "completed"
        assert result.memoryTraceWritten is True
        assert_under_seconds("full turn benchmark", started_at, 5.0)
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)
