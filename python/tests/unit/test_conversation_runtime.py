import shutil
from typing import cast

import pytest

from rin.contracts import ModelRequest, ModelResponse, ModelResponseMetadata
from rin.conversation import RuntimeClock, run_conversation_turn
from rin.database import (
    create_temp_layout_database,
    inspect_database,
    list_messages,
)
from rin.diagnostics.runtime_trace import RUNTIME_TRACE_STORE
from rin.diagnostics.safety import create_temp_data_dir
from rin.model.ollama import ModelError, ModelErrorDetails
from rin.storage import RinDataLayout

NOW = "2026-06-05T00:00:00.000Z"


class MockAdapter:
    id = "rin-mock-local"

    def __init__(self, content: str = "Final reply.") -> None:
        self.content = content
        self.requests: list[ModelRequest] = []

    async def generate(self, request: ModelRequest) -> ModelResponse:
        self.requests.append(request)
        return ModelResponse(
            content=self.content,
            adapterId=self.id,
            metadata=ModelResponseMetadata(
                externalProvider=False,
                memoryWriteRequested=False,
                toolCallRequested=False,
            ),
        )


class FailingAdapter:
    id = "rin-mock-local"

    async def generate(self, request: ModelRequest) -> ModelResponse:
        raise ModelError(
            "MODEL_RESPONSE_INVALID",
            "empty",
            "rin-mock-local",
            retryable=True,
            details=ModelErrorDetails(emptyContent=True),
        )


def create_layout() -> RinDataLayout:
    temp = create_temp_data_dir()
    return create_temp_layout_database(temp.path)


@pytest.mark.asyncio
async def test_runtime_persists_owner_and_rin_reply_on_success() -> None:
    layout = create_layout()
    try:
        RUNTIME_TRACE_STORE.clear()
        adapter = MockAdapter("Final answer.")

        result = await run_conversation_turn(
            layout,
            "hello",
            adapter,
            clock=RuntimeClock(NOW),
        )

        messages = list_messages(layout, result.conversationId)
        status = inspect_database(layout)

        assert result.status == "completed"
        assert [message.role for message in messages] == ["owner", "rin"]
        assert messages[1].content == "Final answer."
        assert result.fakeReplyWritten is False
        assert result.elapsedMs >= 0
        assert result.memoryTraceWritten is True
        assert status.counts.conversationTurns == 1
        assert status.counts.memoryV2Traces == 1
        assert adapter.requests[0].messages[-1].content == "hello"
        trace = RUNTIME_TRACE_STORE.latest()
        assert trace is not None
        assert trace.turnId == result.turnId
        assert [stage.name for stage in trace.stages] == [
            "input_received",
            "owner_message_persisted",
            "profile_loading",
            "recent_history_selection",
            "memory_v2_retrieval",
            "context_assembly",
            "model_request",
            "raw_model_response",
            "sanitization_final_answer",
            "rin_reply_persisted",
            "memory_update",
            "response_returned",
        ]
        input_stage = trace.stages[0]
        memory_stage = next(
            stage for stage in trace.stages if stage.name == "memory_v2_retrieval"
        )
        context_stage = next(
            stage for stage in trace.stages if stage.name == "context_assembly"
        )
        request_stage = next(
            stage for stage in trace.stages if stage.name == "model_request"
        )
        reply_stage = next(
            stage for stage in trace.stages if stage.name == "rin_reply_persisted"
        )
        memory_update_stage = next(
            stage for stage in trace.stages if stage.name == "memory_update"
        )

        assert input_stage.output["inputLength"] == len("hello")
        assert input_stage.output["inputHash"]
        assert memory_stage.status == "skipped"
        assert memory_stage.decision["skipReason"] == (
            "runtime retrieval not wired into prompt assembly"
        )
        assert context_stage.output["componentTable"]
        assert request_stage.output["requestOutline"]
        assert reply_stage.output["storedSanitizedAnswer"] is True
        assert reply_stage.output["storedRawThinking"] is False
        assert memory_update_stage.output["tracesCreatedCount"] == 1
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_preserves_owner_without_fake_reply_on_model_failure() -> None:
    layout = create_layout()
    try:
        RUNTIME_TRACE_STORE.clear()
        result = await run_conversation_turn(
            layout,
            "hello",
            FailingAdapter(),
            clock=RuntimeClock(NOW),
        )

        messages = list_messages(layout, result.conversationId)
        status = inspect_database(layout)

        assert result.status == "failed"
        assert result.ownerMessagePreserved is True
        assert result.rinMessageId is None
        assert result.fakeReplyWritten is False
        assert result.elapsedMs >= 0
        assert [message.role for message in messages] == ["owner"]
        assert status.counts.conversationTurns == 1
        assert status.counts.messages == 1
        assert status.counts.memoryV2Traces == 0
        trace = RUNTIME_TRACE_STORE.latest()
        assert trace is not None
        assert trace.status == "failed"
        assert trace.errorCode == "MODEL_RESPONSE_INVALID"
        assert trace.stages[-1].name == "response_returned"
        assert trace.stages[-1].status == "error"
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_strips_thinking_before_persistence() -> None:
    layout = create_layout()
    try:
        RUNTIME_TRACE_STORE.clear()
        result = await run_conversation_turn(
            layout,
            "dinner",
            MockAdapter("<think>private</think>\n\nEat noodles."),
            clock=RuntimeClock(NOW),
        )

        messages = list_messages(layout, result.conversationId)

        assert result.status == "completed"
        assert messages[-1].content == "Eat noodles."
        assert "private" not in messages[-1].content
        assert result.thinkingIncluded is True
        trace = RUNTIME_TRACE_STORE.latest()
        assert trace is not None
        sanitizer = next(
            stage for stage in trace.stages if stage.name == "sanitization_final_answer"
        )
        assert sanitizer.metadata["thinkingTagDetected"] is True
        assert sanitizer.metadata["thinkingRemoved"] is True
        assert sanitizer.metadata["finalAnswerLength"] == len("Eat noodles.")
        assert sanitizer.output["rawLength"] == len(
            "<think>private</think>\n\nEat noodles."
        )
        assert sanitizer.output["finalLength"] == len("Eat noodles.")
        assert cast(int, sanitizer.output["removedCharacterCount"]) > 0
        assert sanitizer.operation["thinkingTagRemoved"] is True
        assert sanitizer.privacy["hiddenReasoningTextIncluded"] is False
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_extracts_chinese_final_answer_before_persistence() -> None:
    layout = create_layout()
    try:
        RUNTIME_TRACE_STORE.clear()
        result = await run_conversation_turn(
            layout,
            "晚饭吃什么？",
            MockAdapter(
                "首先，用户问晚饭吃什么。我需要分析。\n最终答案：今晚可以吃番茄鸡蛋面。"
            ),
            clock=RuntimeClock(NOW),
        )

        messages = list_messages(layout, result.conversationId)

        assert result.status == "completed"
        assert messages[-1].content == "今晚可以吃番茄鸡蛋面。"
        assert "用户问" not in messages[-1].content
        trace = RUNTIME_TRACE_STORE.latest()
        assert trace is not None
        sanitizer = next(
            stage for stage in trace.stages if stage.name == "sanitization_final_answer"
        )
        assert sanitizer.operation["extractedFinalAnswer"] is True
        assert sanitizer.output["storedSanitizedOnly"] is True
        memory_update = next(
            stage for stage in trace.stages if stage.name == "memory_update"
        )
        assert memory_update.output["fullTextStoredInTrace"] is False
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_rejects_chinese_thinking_only_output() -> None:
    layout = create_layout()
    try:
        result = await run_conversation_turn(
            layout,
            "晚饭吃什么？",
            MockAdapter("首先，用户问晚饭吃什么。我需要分析用户偏好。"),
            clock=RuntimeClock(NOW),
        )

        messages = list_messages(layout, result.conversationId)

        assert result.status == "failed"
        assert result.errorCode == "MODEL_RESPONSE_INVALID"
        assert [message.role for message in messages] == ["owner"]
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_rejects_empty_after_thinking_removal() -> None:
    layout = create_layout()
    try:
        result = await run_conversation_turn(
            layout,
            "dinner",
            MockAdapter("<think>private</think>"),
            clock=RuntimeClock(NOW),
        )

        messages = list_messages(layout, result.conversationId)

        assert result.status == "failed"
        assert result.errorCode == "MODEL_RESPONSE_INVALID"
        assert [message.role for message in messages] == ["owner"]
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)
