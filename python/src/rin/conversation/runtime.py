from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from time import perf_counter
from typing import Protocol
from uuid import uuid4

from pydantic import BaseModel, ConfigDict

from rin.context import ContextV2InputSegment, build_context_v2_report
from rin.contracts import (
    ConversationMessageRecord,
    ModelMessage,
    ModelRequest,
    ModelResponse,
)
from rin.database import (
    append_message,
    create_conversation,
    create_memory_trace,
    inspect_database,
    list_messages,
    record_completed_turn,
    record_failed_turn,
)
from rin.diagnostics.runtime_trace import (
    RUNTIME_TRACE_STORE,
    RuntimeTraceRecorder,
    has_thinking_like_prefix,
    has_thinking_tag,
    input_preview,
    short_hash,
)
from rin.diagnostics.safety import assert_safe_python_write_data_dir
from rin.model.ollama import (
    ModelError,
    has_unsafe_thinking_leak,
    sanitize_assistant_content,
)
from rin.profiles import build_profile_report
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
    assert_safe_python_write_data_dir(layout.rootDir)
    runtime_clock = clock or RuntimeClock()
    now = runtime_clock.now()
    conversation = None
    if conversation_id is None:
        conversation = create_conversation(layout, "Python runtime candidate", now)
        conversation_id = conversation.id

    turn_id = str(uuid4())
    recorder = RuntimeTraceRecorder(turn_id, conversation_id, now)
    recorder.record(
        "input_received",
        "ok",
        turnId=turn_id,
        conversationId=conversation_id,
        timestamp=now,
        inputLength=len(owner_content),
        inputPreview=input_preview(owner_content),
        inputHash=short_hash(owner_content),
    )
    owner_message = append_message(
        layout,
        conversation_id,
        "owner",
        owner_content,
        now,
    )
    recorder.record(
        "owner_message_persisted",
        "ok",
        databaseWriteSuccess=True,
        messageId=owner_message.id,
        role=owner_message.role,
        timestamp=owner_message.createdAt,
    )
    profile_report = build_profile_report(layout)
    recorder.record(
        "profile_loading",
        "ok" if profile_report.status == "valid" else "warning",
        rinProfileLoaded=profile_report.status == "valid",
        ownerProfileLoaded=profile_report.status == "valid",
        profileSummaryIncluded=False,
        profileFileCount=len(profile_report.files),
        profileValidationStatus=profile_report.status,
    )
    previous_messages = select_recent_messages(layout, conversation_id, owner_content)
    recorder.record(
        "recent_history_selection",
        "ok",
        recentWindowPolicy="last six prior messages in active conversation",
        selectedMessageCount=len(previous_messages),
        selectedOwnerMessageCount=sum(
            1 for message in previous_messages if message.role == "owner"
        ),
        selectedRinMessageCount=sum(
            1 for message in previous_messages if message.role == "rin"
        ),
        oldestSelectedTimestamp=previous_messages[0].createdAt
        if previous_messages
        else "n/a",
        newestSelectedTimestamp=previous_messages[-1].createdAt
        if previous_messages
        else "n/a",
        dedupStatus="current owner message excluded from prior history",
    )
    recorder.record(
        "memory_v2_retrieval",
        "skipped",
        retrievalEnabled=False,
        candidateCount=0,
        selectedTraceCount=0,
        rankingSignalsSummary=(
            "runtime does not retrieve Memory V2 traces for prompt assembly yet"
        ),
        topSelectedTraceIds=[],
        fullTextIncluded=False,
    )
    context_segments = build_runtime_context_segments_from_messages(
        previous_messages,
        owner_content,
    )
    context_report = build_context_v2_report(context_segments)
    model_request = ModelRequest(
        ownerId="local-owner",
        conversationId=conversation_id,
        messages=model_messages_for(context_segments, owner_content),
    )
    request_character_count = sum(
        len(message.content) for message in model_request.messages
    )
    recorder.record(
        "context_assembly",
        "ok",
        contextBuilderVersion="context-v2-report",
        componentOrder=context_report.order,
        currentInputIncluded=context_report.latestOwnerMessagePreserved,
        dedupCount=sum(
            1
            for segment in context_report.segments
            if segment.skipReason == "duplicate_source"
        ),
        droppedItemCount=context_report.skippedSegments,
        maxCharacters=context_report.maxCharacters,
        finalContextMessageCount=len(model_request.messages),
        finalContextCharacterCount=context_report.characterCount,
        rawPromptIncluded=False,
    )
    recorder.record(
        "model_request",
        "ok",
        adapter=adapter.id,
        provider="local",
        model=getattr(adapter, "model", "n/a"),
        baseUrl=getattr(adapter, "baseUrl", "n/a"),
        timeoutMs=getattr(adapter, "timeoutMs", "n/a"),
        numPredict=getattr(
            getattr(adapter, "generationOptions", None),
            "numPredict",
            "n/a",
        ),
        temperature=getattr(
            getattr(adapter, "generationOptions", None),
            "temperature",
            "n/a",
        ),
        topP=getattr(getattr(adapter, "generationOptions", None), "topP", "n/a"),
        thinkFalse=True if adapter.id == "rin-ollama-local" else "n/a",
        requestMessageCount=len(model_request.messages),
        requestCharacterCount=request_character_count,
        rawPromptIncluded=False,
    )

    try:
        model_started_at = perf_counter()
        model_response = await adapter.generate(model_request)
        model_duration_ms = elapsed_ms(model_started_at)
        raw_content = model_response.content
        recorder.record(
            "raw_model_response",
            "ok",
            providerReturned=True,
            durationMs=model_duration_ms,
            rawContentLength=len(raw_content),
            thinkingTagDetected=has_thinking_tag(raw_content),
            thinkingLikePrefixDetected=has_thinking_like_prefix(raw_content),
            emptyResponse=not raw_content.strip(),
            errorCode=None,
            rawModelOutputIncluded=False,
        )
        sanitized, removed_thinking = sanitize_assistant_content(model_response.content)
        recorder.record(
            "sanitization_final_answer",
            "ok"
            if sanitized.strip() and not has_unsafe_thinking_leak(sanitized)
            else "error",
            sanitizerApplied=True,
            thinkingTagDetected=has_thinking_tag(raw_content),
            thinkingLikePrefixDetected=has_thinking_like_prefix(raw_content),
            thinkingRemoved=removed_thinking,
            removedCharacterCount=max(0, len(raw_content) - len(sanitized)),
            rawContentLength=len(raw_content),
            finalAnswerLength=len(sanitized),
            finalAnswerPreview=input_preview(sanitized),
            rejectionReason=None
            if sanitized.strip() and not has_unsafe_thinking_leak(sanitized)
            else "invalid_or_unsafe_final_answer",
        )
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
        recorder.record(
            "raw_model_response",
            "error",
            providerReturned=False,
            durationMs=None,
            rawContentLength=0,
            thinkingTagDetected=False,
            thinkingLikePrefixDetected=False,
            emptyResponse=error.details.emptyContent is True,
            errorCode=error.code,
            rawModelOutputIncluded=False,
        )
        recorder.record(
            "rin_reply_persisted",
            "skipped",
            databaseWriteSuccess=False,
            role="rin",
            storedSanitizedAnswer=False,
            storedRawThinking=False,
        )
        recorder.record(
            "memory_update",
            "skipped",
            memoryV2UpdateAttempted=False,
            signalsCreatedCount=0,
            tracesUpdatedCount=0,
            shortTermStateUpdated=False,
            noFullTextStoredInTrace=True,
        )
        record_failed_turn(
            layout,
            turn_id,
            conversation_id,
            owner_message.id,
            error.code,
            now,
        )
        recorder.record(
            "response_returned",
            "error",
            uiResponseSuccess=False,
            statusCode=502,
            totalDurationMs=elapsed_ms(started_at),
        )
        RUNTIME_TRACE_STORE.add(recorder.finish("failed", error.code))
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
        recorder.record(
            "rin_reply_persisted",
            "skipped",
            databaseWriteSuccess=False,
            role="rin",
            storedSanitizedAnswer=False,
            storedRawThinking=False,
        )
        recorder.record(
            "memory_update",
            "skipped",
            memoryV2UpdateAttempted=False,
            signalsCreatedCount=0,
            tracesUpdatedCount=0,
            shortTermStateUpdated=False,
            noFullTextStoredInTrace=True,
        )
        record_failed_turn(
            layout,
            turn_id,
            conversation_id,
            owner_message.id,
            error.code,
            now,
        )
        recorder.record(
            "response_returned",
            "error",
            uiResponseSuccess=False,
            statusCode=502,
            totalDurationMs=elapsed_ms(started_at),
        )
        RUNTIME_TRACE_STORE.add(recorder.finish("failed", error.code))
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
    recorder.record(
        "rin_reply_persisted",
        "ok",
        databaseWriteSuccess=True,
        messageId=rin_message.id,
        role=rin_message.role,
        timestamp=rin_message.createdAt,
        storedSanitizedAnswer=True,
        storedRawThinking=False,
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
    status_after_memory = inspect_database(layout)
    recorder.record(
        "memory_update",
        "ok",
        memoryV2UpdateAttempted=True,
        signalsCreatedCount="n/a",
        tracesUpdatedCount=1,
        totalMemoryV2Traces=status_after_memory.counts.memoryV2Traces,
        shortTermStateUpdated=False,
        noFullTextStoredInTrace=True,
    )
    total_elapsed = elapsed_ms(started_at)
    recorder.record(
        "response_returned",
        "ok",
        uiResponseSuccess=True,
        statusCode=200,
        totalDurationMs=total_elapsed,
    )
    RUNTIME_TRACE_STORE.add(recorder.finish("success"))
    return ConversationRuntimeResult(
        status="completed",
        conversationId=conversation_id,
        ownerMessageId=owner_message.id,
        rinMessageId=rin_message.id,
        turnId=turn_id,
        adapterId=model_response.adapterId,
        contextIncludedSegments=context_report.includedSegments,
        contextCharacterCount=context_report.characterCount,
        elapsedMs=total_elapsed,
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
    previous_messages = select_recent_messages(layout, conversation_id, owner_content)
    return build_runtime_context_segments_from_messages(
        previous_messages,
        owner_content,
    )


def select_recent_messages(
    layout: RinDataLayout,
    conversation_id: str,
    owner_content: str,
) -> list[ConversationMessageRecord]:
    return [
        message
        for message in list_messages(layout, conversation_id)
        if message.content != owner_content
    ][-6:]


def build_runtime_context_segments_from_messages(
    previous_messages: Sequence[ConversationMessageRecord],
    owner_content: str,
) -> list[ContextV2InputSegment]:
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
