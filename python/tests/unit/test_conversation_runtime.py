import shutil

import pytest

from rin.contracts import ModelRequest, ModelResponse, ModelResponseMetadata
from rin.conversation import RuntimeClock, run_conversation_turn
from rin.database import (
    create_temp_layout_database,
    inspect_database,
    list_messages,
)
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
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_preserves_owner_without_fake_reply_on_model_failure() -> None:
    layout = create_layout()
    try:
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
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_strips_thinking_before_persistence() -> None:
    layout = create_layout()
    try:
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
