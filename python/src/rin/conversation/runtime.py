from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from time import perf_counter
from typing import Protocol
from uuid import uuid4

from pydantic import BaseModel, ConfigDict

from rin.context import ContextV2InputSegment, build_context_v2_report
from rin.contracts import ModelMessage, ModelRequest, ModelResponse
from rin.database import (
    append_message,
    create_conversation,
    create_memory_trace,
    list_messages,
    record_completed_turn,
    record_failed_turn,
)
from rin.diagnostics.safety import assert_safe_temp_data_dir
from rin.model.ollama import (
    ModelError,
    has_unsafe_thinking_leak,
    sanitize_assistant_content,
)
from rin.storage import RinDataLayout


class ModelAdapterProtocol(Protocol):
    id: str

    async def generate(self, request: ModelRequest) -> ModelResponse: ...


class ConversationRuntimeError(RuntimeError):
    def __init__(self, code: str, message: str, retryable: bool = True) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable


class ConversationRuntimeResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    conversationId: str
    ownerMessageId: str
    rinMessageId: str | None
    turnId: str
    adapterId: str | None
    contextIncludedSegments: int
    contextCharacterCount: int
    elapsedMs: int
    memoryTraceWritten: bool
    ownerMessagePreserved: bool
    fakeReplyWritten: bool
    duplicateRetry: bool
    thinkingIncluded: bool
    errorCode: str | None
    retryable: bool | None


@dataclass(frozen=True)
class RuntimeClock:
    fixed_now: str | None = None

    def now(self) -> str:
        if self.fixed_now:
            return self.fixed_now
        return (
            datetime.now(tz=UTC)
            .isoformat(timespec="milliseconds")
            .replace(
                "+00:00",
                "Z",
            )
        )


async def run_conversation_turn(
    layout: RinDataLayout,
    owner_content: str,
    adapter: ModelAdapterProtocol,
    conversation_id: str | None = None,
    clock: RuntimeClock | None = None,
) -> ConversationRuntimeResult:
    started_at = perf_counter()
    assert_safe_temp_data_dir(layout.rootDir)
    runtime_clock = clock or RuntimeClock()
    now = runtime_clock.now()
    conversation = None
    if conversation_id is None:
        conversation = create_conversation(layout, "Python runtime candidate", now)
        conversation_id = conversation.id

    owner_message = append_message(
        layout,
        conversation_id,
        "owner",
        owner_content,
        now,
    )
    turn_id = str(uuid4())
    context_segments = build_runtime_context_segments(
        layout,
        conversation_id,
        owner_content,
    )
    context_report = build_context_v2_report(context_segments)
    model_request = ModelRequest(
        ownerId="local-owner",
        conversationId=conversation_id,
        messages=model_messages_for(context_segments, owner_content),
    )

    try:
        model_response = await adapter.generate(model_request)
        sanitized, removed_thinking = sanitize_assistant_content(model_response.content)
        if not sanitized:
            raise ConversationRuntimeError(
                "MODEL_RESPONSE_INVALID",
                "Empty model reply.",
            )
        if has_unsafe_thinking_leak(sanitized):
            raise ConversationRuntimeError(
                "MODEL_RESPONSE_INVALID",
                "Model reply contained unsafe thinking artifacts.",
            )
    except ModelError as error:
        record_failed_turn(
            layout,
            turn_id,
            conversation_id,
            owner_message.id,
            error.code,
            now,
        )
        return failed_result(
            conversation_id,
            owner_message.id,
            turn_id,
            error.adapterId,
            context_report.includedSegments,
            context_report.characterCount,
            elapsed_ms(started_at),
            error.code,
            error.retryable,
        )
    except ConversationRuntimeError as error:
        record_failed_turn(
            layout,
            turn_id,
            conversation_id,
            owner_message.id,
            error.code,
            now,
        )
        return failed_result(
            conversation_id,
            owner_message.id,
            turn_id,
            adapter.id,
            context_report.includedSegments,
            context_report.characterCount,
            elapsed_ms(started_at),
            error.code,
            error.retryable,
        )

    rin_message = append_message(
        layout,
        conversation_id,
        "rin",
        sanitized,
        now,
        model_adapter=model_response.adapterId,
    )
    record_completed_turn(
        layout,
        turn_id,
        conversation_id,
        owner_message.id,
        rin_message.id,
        now,
    )
    create_memory_trace(
        layout,
        str(uuid4()),
        owner_message.id,
        {
            "source": "conversation_runtime_candidate",
            "contentCharacterCount": len(owner_content),
            "rawTextIncluded": False,
        },
        0.5,
        now,
    )
    return ConversationRuntimeResult(
        status="completed",
        conversationId=conversation_id,
        ownerMessageId=owner_message.id,
        rinMessageId=rin_message.id,
        turnId=turn_id,
        adapterId=model_response.adapterId,
        contextIncludedSegments=context_report.includedSegments,
        contextCharacterCount=context_report.characterCount,
        elapsedMs=elapsed_ms(started_at),
        memoryTraceWritten=True,
        ownerMessagePreserved=True,
        fakeReplyWritten=False,
        duplicateRetry=False,
        thinkingIncluded=removed_thinking or has_unsafe_thinking_leak(sanitized),
        errorCode=None,
        retryable=None,
    )


def build_runtime_context_segments(
    layout: RinDataLayout,
    conversation_id: str,
    owner_content: str,
) -> list[ContextV2InputSegment]:
    previous_messages = [
        message
        for message in list_messages(layout, conversation_id)
        if message.content != owner_content
    ][-6:]
    history = "\n".join(
        f"{message.role}: {len(message.content)} chars" for message in previous_messages
    )
    segments = [
        ContextV2InputSegment(
            id="system",
            type="system",
            sourceId="runtime-system",
            provenance="conversation-runtime",
            protected=True,
            content="You are RIN. Reply with final assistant content only.",
        ),
        ContextV2InputSegment(
            id="current-owner",
            type="current_owner_message",
            sourceId="current-owner-message",
            provenance="conversation-runtime",
            protected=True,
            content=owner_content,
        ),
    ]
    if history:
        segments.append(
            ContextV2InputSegment(
                id="short-term-window",
                type="short_term_window",
                sourceId="short-term-window",
                provenance="conversation-runtime",
                protected=False,
                content=history,
            )
        )
    return segments


def model_messages_for(
    context_segments: list[ContextV2InputSegment],
    owner_content: str,
) -> list[ModelMessage]:
    context_text = "\n".join(
        item.content
        for item in context_segments
        if item.type != "current_owner_message"
    )
    return [
        ModelMessage(role="system", content=context_text),
        ModelMessage(role="owner", content=owner_content),
    ]


def failed_result(
    conversation_id: str,
    owner_message_id: str,
    turn_id: str,
    adapter_id: str | None,
    included_segments: int,
    character_count: int,
    elapsed_ms_value: int,
    error_code: str,
    retryable: bool,
) -> ConversationRuntimeResult:
    return ConversationRuntimeResult(
        status="failed",
        conversationId=conversation_id,
        ownerMessageId=owner_message_id,
        rinMessageId=None,
        turnId=turn_id,
        adapterId=adapter_id,
        contextIncludedSegments=included_segments,
        contextCharacterCount=character_count,
        elapsedMs=elapsed_ms_value,
        memoryTraceWritten=False,
        ownerMessagePreserved=True,
        fakeReplyWritten=False,
        duplicateRetry=False,
        thinkingIncluded=False,
        errorCode=error_code,
        retryable=retryable,
    )


def elapsed_ms(started_at: float) -> int:
    return max(0, round((perf_counter() - started_at) * 1000))
