"""
Conversation turn runtime: context assembly, model call, sanitization, persistence.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from time import perf_counter
from typing import Protocol
from uuid import uuid4

from pydantic import BaseModel, ConfigDict

from rin.config.chat_provider import load_cost_config
from rin.context import ContextV2InputSegment, build_context_v2_report
from rin.contracts import (
    ContextV2Report,
    ConversationMessageRecord,
    MemoryV2TraceAnalysis,
    ModelMessage,
    ModelRequest,
    ModelResponse,
)
from rin.database import (
    MemoryV2TraceRecord,
    append_message,
    create_api_usage_event,
    create_conversation,
    create_memory_trace,
    inspect_database,
    list_messages,
    list_top_memory_v2_traces,
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
    short_id,
)
from rin.diagnostics.safety import assert_safe_python_write_data_dir
from rin.memory import MemoryV2SourceMessage, analyze_memory_v2_source
from rin.model import (
    ModelError,
    has_unsafe_thinking_leak,
    sanitize_assistant_content_details,
)
from rin.model.usage import build_api_usage_accounting
from rin.profiles import build_profile_report, load_owner_profile, load_rin_profile
from rin.storage import RinDataLayout


class ModelAdapterProtocol(Protocol):
    """
    Protocol that any model adapter must satisfy: an id and an async generate method.
    """

    id: str

    async def generate(self, request: ModelRequest) -> ModelResponse: ...


class ConversationRuntimeError(RuntimeError):
    """
    Raised when the conversation runtime cannot complete a turn (model error, invalid
    response, etc.).
    """

    def __init__(self, code: str, message: str, retryable: bool = True) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable


class ConversationRuntimeResult(BaseModel):
    """Structured result returned after each conversation turn completes or fails."""

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


# Budget caps for recent conversation history injected into the model prompt.
RECENT_HISTORY_MESSAGE_LIMIT = 6
RECENT_HISTORY_MESSAGE_MAX_CHARS = 500
RECENT_HISTORY_TOTAL_MAX_CHARS = 2000


@dataclass(frozen=True)
class RuntimeClock:
    """Provides ISO 8601 timestamps; set fixed_now for deterministic tests."""

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
    """
    Run one full conversation turn.

    Persists the owner message, assembles context, calls the model, sanitizes the
    response, persists the reply, and writes a memory trace. Returns a structured
    result whether the turn succeeds or fails.
    """
    # --- Setup ---
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
        display_name="Input",
        summary=f"{len(owner_content)} chars",
        input={
            "role": "owner",
            "conversationTarget": conversation_id,
            "conversationShortId": short_id(conversation_id),
            "turnId": turn_id,
            "turnShortId": short_id(turn_id),
            "timestamp": now,
        },
        operation={
            "normalizationApplied": False,
            "validation": "non-empty content checked by FastAPI route",
        },
        output={
            "inputLength": len(owner_content),
            "inputPreview": input_preview(owner_content),
            "inputHash": short_hash(owner_content),
        },
        decision={"accepted": True, "reason": "owner message entered runtime"},
        privacy={"fullOwnerInputIncluded": False, "previewOnly": True},
    )
    # --- Persist owner message ---
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
        display_name="Persist Owner",
        summary=f"msg {short_id(owner_message.id)}",
        input={
            "conversationId": conversation_id,
            "role": "owner",
            "contentLength": len(owner_content),
            "contentHash": short_hash(owner_content),
        },
        operation={
            "databaseTarget": "messages",
            "writeType": "insert message and update conversation timestamp",
        },
        output={
            "databaseWriteSuccess": True,
            "messageId": owner_message.id,
            "messageShortId": short_id(owner_message.id),
            "role": owner_message.role,
            "createdAt": owner_message.createdAt,
            "storedContentLength": len(owner_message.content),
            "storedContentHash": short_hash(owner_message.content),
        },
        decision={
            "stored": True,
            "reason": "owner message persisted before model call",
        },
        privacy={"fullStoredContentIncluded": False, "hashOnly": True},
    )
    # --- Load profiles ---
    profile_report = build_profile_report(layout)
    profile_context_segments = (
        build_profile_context_segments(layout)
        if profile_report.status == "valid"
        else []
    )
    profile_files = [
        {
            "file": item.file,
            "exists": item.exists,
            "valid": item.valid,
            "issueCount": item.issueCount,
            "summaryKeys": sorted(item.summaryCounts.keys()),
            "summaryCounts": item.summaryCounts,
        }
        for item in profile_report.files
    ]
    recorder.record(
        "profile_loading",
        "ok" if profile_report.status == "valid" else "warning",
        display_name="Profiles",
        summary=f"{len(profile_report.files)} files / {profile_report.status}",
        input={"layoutRootName": layout.rootDir.name},
        operation={"reportBuilder": "build_profile_report", "fullProfileRead": False},
        output={
            "rinProfilePresent": any(
                item.file == "rin_profile.json" and item.exists
                for item in profile_report.files
            ),
            "ownerProfilePresent": any(
                item.file == "owner_profile.json" and item.exists
                for item in profile_report.files
            ),
            "profileFilesLoaded": profile_files,
            "profileSummaryKeysIncluded": sorted(
                {key for item in profile_report.files for key in item.summaryCounts}
            ),
            "profileValidationStatus": profile_report.status,
            "profileIssueCount": profile_report.issueCount,
            "profileContextIncluded": bool(profile_context_segments),
            "profileCharacterCountAvailable": profile_report.contextCharacterCount,
            "profileSegmentTypes": [item.type for item in profile_context_segments],
        },
        decision={
            "profileContextInjected": bool(profile_context_segments),
            "reason": "selected profile fields injected"
            if profile_context_segments
            else "profile validation failed or profile files unavailable",
        },
        privacy={"fullProfileTextIncluded": False, "summaryCountsOnly": True},
        warnings=[]
        if profile_report.status == "valid"
        else ["profile validation warning"],
    )
    # --- Select recent history for prompt ---
    previous_messages = select_recent_messages(
        layout,
        conversation_id,
        owner_content,
        current_message_id=owner_message.id,
    )
    available_prior_messages = [
        message
        for message in list_messages(layout, conversation_id)
        if message.id != owner_message.id
    ]
    selected_character_count = sum(
        len(message.content) for message in previous_messages
    )
    recent_history_prompt = build_bounded_recent_history(previous_messages)
    recorder.record(
        "recent_history_selection",
        "ok",
        display_name="Recent History",
        summary=f"{len(previous_messages)} selected",
        input={
            "conversationId": conversation_id,
            "availablePriorMessages": len(available_prior_messages),
            "selectionPolicy": "last six prior messages in active conversation",
            "timeWindow": "n/a",
        },
        operation={
            "excludedCurrentOwnerMessageId": owner_message.id,
            "dedupRule": "exclude current owner message by id/content",
        },
        output={
            "selectedPriorMessages": len(previous_messages),
            "selectedOwnerCount": sum(
                1 for message in previous_messages if message.role == "owner"
            ),
            "selectedRinCount": sum(
                1 for message in previous_messages if message.role == "rin"
            ),
            "excludedMessagesCount": max(
                0,
                len(available_prior_messages) - len(previous_messages),
            ),
            "oldestSelectedTimestamp": previous_messages[0].createdAt
            if previous_messages
            else "n/a",
            "newestSelectedTimestamp": previous_messages[-1].createdAt
            if previous_messages
            else "n/a",
            "selectedCharacterCount": selected_character_count,
            "promptInjectedRecentHistoryCharacterCount": recent_history_prompt[
                "characterCount"
            ],
            "promptInjectedRecentHistoryTruncated": recent_history_prompt["truncated"],
            "conversationIdsInvolved": sorted(
                {message.conversationId for message in previous_messages}
            ),
            "selectedMessages": [
                message_trace_summary(message, included=True, reason="selected")
                for message in previous_messages
            ],
        },
        decision={
            "dedupResult": "current owner message excluded from prior history",
            "reason": "runtime uses the latest six prior messages only",
        },
        privacy={"fullMessageTextIncluded": False, "previewsOnly": True},
    )
    status_before_memory = inspect_database(layout)
    selected_memory_traces = list_top_memory_v2_traces(layout, limit=3)
    memory_context_segments = build_memory_context_segments(selected_memory_traces)
    recorder.record(
        "memory_v2_retrieval",
        "ok" if selected_memory_traces else "skipped",
        display_name="Memory Retrieval",
        summary=f"{len(selected_memory_traces)} selected",
        input={
            "availableMemoryV2TraceCount": status_before_memory.counts.memoryV2Traces,
            "runtimeRetrievalConfigured": True,
        },
        operation={
            "retrievalEnabled": True,
            "selectionPolicy": "top salience score, max 3",
            "candidateCount": status_before_memory.counts.memoryV2Traces,
        },
        output={
            "selectedTraceCount": len(selected_memory_traces),
            "topSelectedTraceIds": [trace.id for trace in selected_memory_traces],
            "topSelectedTraceShortIds": [
                short_id(trace.id) for trace in selected_memory_traces
            ],
            "selectedScores": [trace.salienceScore for trace in selected_memory_traces],
            "injectedIntoContext": bool(memory_context_segments),
        },
        decision={
            "skipReason": None if selected_memory_traces else "no_memory_v2_traces",
            "explanation": (
                "Memory V2 traces are injected as safe summaries without raw text."
            ),
        },
        privacy={"fullMemoryTextIncluded": False},
        warnings=[] if selected_memory_traces else ["No Memory V2 traces available"],
    )
    # --- Assemble context and build model request ---
    context_segments = build_runtime_context_segments_from_messages(
        previous_messages,
        owner_content,
        profile_context_segments=profile_context_segments,
        memory_context_segments=memory_context_segments,
    )
    context_report = build_context_v2_report(context_segments)
    export_policy = context_export_policy_metadata(
        context_report,
        recent_history_count=len(previous_messages),
    )
    model_request = ModelRequest(
        ownerId="local-owner",
        conversationId=conversation_id,
        messages=model_messages_for(context_segments, context_report, owner_content),
    )
    request_character_count = sum(
        len(message.content) for message in model_request.messages
    )
    current_owner_input_last = (
        bool(model_request.messages)
        and model_request.messages[-1].role == "owner"
        and model_request.messages[-1].content == owner_content
    )
    recorder.record(
        "context_assembly",
        "ok",
        display_name="Context Assembly",
        summary=(
            f"{len(model_request.messages)} messages / "
            f"{context_report.characterCount} chars"
        ),
        input={
            "contextInputSegments": len(context_segments),
            "recentHistoryMessages": len(previous_messages),
            "memoryTracesAvailable": status_before_memory.counts.memoryV2Traces,
        },
        operation={
            "contextBuilderVersion": "context-v2-report",
            "budgetPolicy": f"max {context_report.maxCharacters} characters",
            "componentOrder": context_report.order,
            "systemInstructionsIncluded": any(
                item.type == "system" and item.included
                for item in context_report.segments
            ),
            "rinProfileIncluded": any(
                item.type == "rin_profile" and item.included
                for item in context_report.segments
            ),
            "ownerProfileIncluded": any(
                item.type == "owner_profile" and item.included
                for item in context_report.segments
            ),
            "currentOwnerInputIncluded": context_report.latestOwnerMessagePreserved,
        },
        output={
            "recentHistoryIncludedCount": sum(
                1
                for item in context_report.segments
                if item.type == "short_term_window" and item.included
            ),
            "memoryTracesIncludedCount": sum(
                1
                for item in context_report.segments
                if item.type == "memory_v2_trace" and item.included
            ),
            "finalRequestMessageCount": len(model_request.messages),
            "finalContextCharacterCount": context_report.characterCount,
            "dedupCount": sum(
                1
                for segment in context_report.segments
                if segment.skipReason == "duplicate_source"
            ),
            "droppedCount": context_report.skippedSegments,
            "componentTable": context_component_table(context_segments, context_report),
            "exportPolicyApplied": export_policy["exportPolicyApplied"],
            "rawPromptIncluded": export_policy["rawPromptIncluded"],
            "hiddenReasoningIncluded": export_policy["hiddenReasoningIncluded"],
            "profileSummaryIncluded": export_policy["profileSummaryIncluded"],
            "fullProfileIncluded": export_policy["fullProfileIncluded"],
            "memorySummaryIncluded": export_policy["memorySummaryIncluded"],
            "rawMemoryIncluded": export_policy["rawMemoryIncluded"],
            "recentHistoryCount": export_policy["recentHistoryCount"],
            "contextCharacterCount": export_policy["contextCharacterCount"],
            "includedSegments": export_policy["includedSegments"],
        },
        decision={
            "productionContextChanged": context_report.productionContextChanged,
            "reason": "Context V2 report built a safe prompt outline",
        },
        privacy={
            "rawPromptIncluded": False,
            "componentPreviewsOnly": True,
            "contextExportPolicy": export_policy,
        },
    )
    recorder.record(
        "model_request",
        "ok",
        display_name="Model Request",
        summary=(
            f"{len(model_request.messages)} msgs / {getattr(adapter, 'model', 'mock')}"
        ),
        input={
            "conversationId": conversation_id,
            "ownerId": model_request.ownerId,
            "contextCharacterCount": context_report.characterCount,
        },
        operation={
            "adapter": adapter.id,
            "provider": getattr(adapter, "provider", "unknown"),
            "model": getattr(adapter, "model", "n/a"),
            "baseUrl": getattr(adapter, "baseUrl", "n/a"),
            "timeoutMs": getattr(adapter, "timeoutMs", "n/a"),
            "maxTokens": getattr(
                getattr(adapter, "config", None),
                "maxTokens",
                "n/a",
            ),
            "temperature": getattr(
                getattr(adapter, "config", None),
                "temperature",
                "n/a",
            ),
            "topP": getattr(getattr(adapter, "config", None), "topP", "n/a"),
            "streaming": False,
        },
        output={
            "requestMessageCount": len(model_request.messages),
            "requestCharacterCount": request_character_count,
            "systemMessageCount": sum(
                1 for message in model_request.messages if message.role == "system"
            ),
            "ownerMessageCount": sum(
                1 for message in model_request.messages if message.role == "owner"
            ),
            "rinMessageCount": sum(
                1 for message in model_request.messages if message.role == "rin"
            ),
            "requestOutline": model_request_outline(model_request),
            "currentOwnerInputPresent": any(
                message.role == "owner" and message.content == owner_content
                for message in model_request.messages
            ),
            "currentOwnerInputLast": current_owner_input_last,
        },
        decision={
            "sentToAdapter": True,
            "reason": "model request assembled",
            "currentOwnerInputPriority": "last"
            if current_owner_input_last
            else "warning",
        },
        privacy={"rawPromptIncluded": False, "messagePreviewsOnly": True},
        warnings=[] if current_owner_input_last else ["current owner input not last"],
    )

    # --- Call model adapter ---
    try:
        model_started_at = perf_counter()
        model_response = await adapter.generate(model_request)
        model_duration_ms = elapsed_ms(model_started_at)
        adapter_content = model_response.content
        metadata = model_response.metadata
        provider_raw_length = metadata.rawContentLength
        provider_raw_hash = metadata.rawContentHash or "n/a"
        provider_raw_preview = metadata.rawPreview or "not_included"
        provider_raw_metadata_available = provider_raw_length is not None
        trace_raw_length = (
            provider_raw_length
            if provider_raw_length is not None
            else len(adapter_content)
        )
        recorder.record(
            "raw_model_response",
            "ok",
            display_name="Provider Response",
            summary=(
                f"{trace_raw_length} raw chars"
                if provider_raw_metadata_available
                else "adapter content only"
            ),
            input={
                "adapter": adapter.id,
                "requestMessageCount": len(model_request.messages),
            },
            operation={"awaitedAdapterGenerate": True, "durationMs": model_duration_ms},
            output={
                "providerReturned": True,
                "providerRawMetadataAvailable": provider_raw_metadata_available,
                "rawContentLength": provider_raw_length or "n/a",
                "rawContentHash": provider_raw_hash,
                "rawPreview": provider_raw_preview,
                "adapterContentLength": len(adapter_content),
                "providerId": metadata.providerId or adapter.id,
                "provider": metadata.provider or getattr(adapter, "provider", "n/a"),
                "model": metadata.model or getattr(adapter, "model", "n/a"),
                "safeBaseUrl": metadata.safeBaseUrl
                or getattr(adapter, "baseUrl", "n/a"),
                "promptTokens": metadata.promptTokens or "n/a",
                "completionTokens": metadata.completionTokens or "n/a",
                "totalTokens": metadata.totalTokens or "n/a",
                "adapterSanitized": metadata.adapterSanitized,
                "adapterRemovedCharacterCount": metadata.adapterRemovedCharacterCount,
                "adapterSanitizedContentLength": metadata.sanitizedContentLength,
                "thinkingTagDetected": metadata.thinkingTagDetected
                if metadata.thinkingTagDetected is not None
                else has_thinking_tag(adapter_content),
                "thinkingLikePrefixDetected": metadata.thinkingLikePrefixDetected
                if metadata.thinkingLikePrefixDetected is not None
                else has_thinking_like_prefix(adapter_content),
                "emptyContent": not adapter_content.strip(),
                "errorCode": None,
            },
            decision={
                "acceptedForRuntimeSanitizer": True,
                "reason": (
                    "provider raw metadata captured before adapter sanitization"
                    if provider_raw_metadata_available
                    else "adapter did not expose raw provider metadata"
                ),
            },
            privacy={
                "rawModelOutputIncluded": False,
                "secretValuesIncluded": metadata.secretValuesIncluded,
                "rawPreviewHiddenIfThinkingDetected": True,
            },
        )
        sanitizer = sanitize_assistant_content_details(adapter_content)
        sanitized = sanitizer.content
        removed_thinking = sanitizer.removed
        removed_from_provider = max(0, trace_raw_length - len(sanitized))
        large_removal_short_final = (
            trace_raw_length >= 80
            and removed_from_provider / max(trace_raw_length, 1) > 0.8
            and len(sanitized) < 24
        )
        final_safe = (
            sanitized.strip()
            and not sanitizer.rejected
            and not has_unsafe_thinking_leak(sanitized)
        )
        recorder.record(
            "sanitization_final_answer",
            "ok"
            if final_safe and not removed_thinking
            else "warning"
            if final_safe and removed_thinking
            else "error",
            display_name="Sanitizer",
            summary=(
                f"{trace_raw_length}→{len(sanitized)} chars"
                if final_safe
                else "rejected"
            ),
            input={
                "providerRawMetadataAvailable": provider_raw_metadata_available,
                "rawContentLength": trace_raw_length,
                "rawContentHash": provider_raw_hash
                if provider_raw_metadata_available
                else short_hash(adapter_content),
                "adapterContentLength": len(adapter_content),
                "thinkingTagDetected": metadata.thinkingTagDetected
                if metadata.thinkingTagDetected is not None
                else has_thinking_tag(adapter_content),
                "thinkingLikePrefixDetected": metadata.thinkingLikePrefixDetected
                if metadata.thinkingLikePrefixDetected is not None
                else has_thinking_like_prefix(adapter_content),
            },
            operation={
                "sanitizerApplied": True,
                "rulesApplied": sanitizer.rulesApplied,
                "thinkingTagRemoved": sanitizer.thinkingTagRemoved,
                "thinkingLikePrefixRemoved": sanitizer.thinkingLikePrefixRemoved,
                "extractedFinalAnswer": sanitizer.extractedFinalAnswer,
                "adapterAlreadySanitized": metadata.adapterSanitized,
            },
            output={
                "removedCharacterCount": removed_from_provider,
                "rawLength": trace_raw_length,
                "finalLength": len(sanitized),
                "thinkingRemoved": removed_thinking,
                "finalAnswerLength": len(sanitized),
                "finalAnswerPreview": input_preview(sanitized),
                "storedSanitizedOnly": True,
                "largeRemovalShortFinalWarning": large_removal_short_final,
            },
            decision={
                "rejected": not final_safe,
                "rejectionReason": None
                if final_safe
                else sanitizer.rejectionReason or "invalid_or_unsafe_final_answer",
            },
            privacy={"hiddenReasoningTextIncluded": False, "finalPreviewOnly": True},
            warnings=[
                item
                for item in (
                    "thinking removed" if removed_thinking else "",
                    "thinking-like prefix detected"
                    if sanitizer.thinkingLikePrefixRemoved
                    else "",
                    "large sanitizer removal with short final answer"
                    if large_removal_short_final
                    else "",
                )
                if item
            ],
        )
        if not sanitized:
            raise ConversationRuntimeError(
                "MODEL_RESPONSE_INVALID",
                "Empty model reply.",
            )
        if sanitizer.rejected:
            raise ConversationRuntimeError(
                "MODEL_RESPONSE_INVALID",
                "Model reply failed sanitizer validation.",
            )
        if has_unsafe_thinking_leak(sanitized):
            raise ConversationRuntimeError(
                "MODEL_RESPONSE_INVALID",
                "Model reply contained unsafe thinking artifacts.",
            )
    # --- Handle errors ---
    except ModelError as error:
        recorder.record(
            "raw_model_response",
            "error",
            display_name="Raw Response",
            summary=error.code,
            input={
                "adapter": adapter.id,
                "requestMessageCount": len(model_request.messages),
            },
            operation={"awaitedAdapterGenerate": True},
            output={
                "providerReturned": False,
                "rawContentLength": 0,
                "rawContentHash": "n/a",
                "rawPreview": "n/a",
                "thinkingTagDetected": False,
                "thinkingLikePrefixDetected": False,
                "emptyContent": error.details.emptyContent is True,
                "errorCode": error.code,
            },
            decision={
                "acceptedForSanitizer": False,
                "reason": "adapter raised ModelError",
            },
            privacy={"rawModelOutputIncluded": False},
            errors=[error.code],
        )
        recorder.record(
            "rin_reply_persisted",
            "skipped",
            display_name="Store Reply",
            summary="skipped",
            input={"conversationId": conversation_id, "role": "rin"},
            operation={"databaseTarget": "messages", "writeType": "insert rin reply"},
            output={
                "databaseWriteSuccess": False,
                "messageId": "n/a",
                "role": "rin",
                "storedSanitizedAnswer": False,
                "storedRawThinking": False,
            },
            decision={"stored": False, "reason": "model error prevented final answer"},
            privacy={"fullStoredContentIncluded": False},
        )
        recorder.record(
            "memory_update",
            "skipped",
            display_name="Memory Update",
            summary="skipped",
            input={"ownerMessageId": owner_message.id},
            operation={"memoryV2UpdateAttempted": False},
            output={
                "signalsCreatedCount": 0,
                "tracesCreatedCount": 0,
                "tracesUpdatedCount": 0,
                "shortTermStateUpdated": False,
            },
            decision={"skipReason": "failed turn does not write Memory V2 trace"},
            privacy={"noFullTextStoredInTrace": True},
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
            display_name="Return",
            summary="502",
            input={"turnId": turn_id, "conversationId": conversation_id},
            operation={"resultBuilder": "failed_result"},
            output={
                "uiApiStatus": 502,
                "totalDurationMs": elapsed_ms(started_at),
                "finalAnswerLength": 0,
                "conversationId": conversation_id,
                "messageId": "n/a",
                "errorCode": error.code,
            },
            decision={"uiResponseSuccess": False, "reason": "runtime returned failure"},
            privacy={"fullErrorPayloadIncluded": False},
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
            display_name="Store Reply",
            summary="skipped",
            input={"conversationId": conversation_id, "role": "rin"},
            operation={"databaseTarget": "messages", "writeType": "insert rin reply"},
            output={
                "databaseWriteSuccess": False,
                "messageId": "n/a",
                "role": "rin",
                "storedSanitizedAnswer": False,
                "storedRawThinking": False,
            },
            decision={
                "stored": False,
                "reason": "sanitizer/runtime validation rejected final answer",
            },
            privacy={"fullStoredContentIncluded": False},
        )
        recorder.record(
            "memory_update",
            "skipped",
            display_name="Memory Update",
            summary="skipped",
            input={"ownerMessageId": owner_message.id},
            operation={"memoryV2UpdateAttempted": False},
            output={
                "signalsCreatedCount": 0,
                "tracesCreatedCount": 0,
                "tracesUpdatedCount": 0,
                "shortTermStateUpdated": False,
            },
            decision={"skipReason": "failed turn does not write Memory V2 trace"},
            privacy={"noFullTextStoredInTrace": True},
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
            display_name="Return",
            summary="502",
            input={"turnId": turn_id, "conversationId": conversation_id},
            operation={"resultBuilder": "failed_result"},
            output={
                "uiApiStatus": 502,
                "totalDurationMs": elapsed_ms(started_at),
                "finalAnswerLength": 0,
                "conversationId": conversation_id,
                "messageId": "n/a",
                "errorCode": error.code,
            },
            decision={"uiResponseSuccess": False, "reason": "runtime returned failure"},
            privacy={"fullErrorPayloadIncluded": False},
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

    # --- Persist rin reply ---
    usage_accounting = None
    if metadata.externalProvider:
        usage_accounting = build_api_usage_accounting(
            metadata=metadata,
            provider_id=metadata.providerId or model_response.adapterId,
            model=str(metadata.model or getattr(adapter, "model", "n/a")),
            request_character_count=request_character_count,
            output_character_count=len(sanitized),
            context_character_count=context_report.characterCount,
            cost_config=load_cost_config(),
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
        display_name="Store Reply",
        summary=f"msg {short_id(rin_message.id)}",
        input={
            "conversationId": conversation_id,
            "role": "rin",
            "sanitizedAnswerLength": len(sanitized),
            "sanitizedAnswerHash": short_hash(sanitized),
        },
        operation={
            "databaseTarget": "messages",
            "writeType": "insert rin reply and update conversation timestamp",
        },
        output={
            "databaseWriteSuccess": True,
            "messageId": rin_message.id,
            "messageShortId": short_id(rin_message.id),
            "role": rin_message.role,
            "createdAt": rin_message.createdAt,
            "storedContentLength": len(rin_message.content),
            "storedContentHash": short_hash(rin_message.content),
            "storedSanitizedAnswer": True,
            "storedRawThinking": False,
        },
        decision={"stored": True, "reason": "sanitized final answer persisted"},
        privacy={"fullStoredContentIncluded": False, "hashOnly": True},
    )
    # --- Write turn record and memory trace ---
    record_completed_turn(
        layout,
        turn_id,
        conversation_id,
        owner_message.id,
        rin_message.id,
        now,
    )
    usage_event_id: str | None = None
    if usage_accounting is not None:
        usage_event_id = create_api_usage_event(
            layout,
            turn_id=turn_id,
            conversation_id=conversation_id,
            accounting=usage_accounting,
            now=now,
        )
    memory_analysis = analyze_memory_v2_source(
        MemoryV2SourceMessage(
            messageId=owner_message.id,
            conversationId=conversation_id,
            role="owner",
            content=owner_content,
            createdAt=owner_message.createdAt,
        ),
        now=now,
    )
    memory_trace_id: str | None = None
    memory_update_supported = memory_analysis.decision == "promoted"
    if memory_update_supported:
        memory_trace_id = str(uuid4())
        create_memory_trace(
            layout,
            memory_trace_id,
            owner_message.id,
            memory_trace_signal_summary(memory_analysis),
            memory_analysis.retentionScore,
            now,
        )
    status_after_memory = inspect_database(layout)
    traces_created = max(
        0,
        status_after_memory.counts.memoryV2Traces
        - status_before_memory.counts.memoryV2Traces,
    )
    signals_created = max(
        0,
        status_after_memory.counts.memoryV2TraceSignals
        - status_before_memory.counts.memoryV2TraceSignals,
    )
    recorder.record(
        "memory_update",
        "ok",
        display_name="Memory Update",
        summary=f"{traces_created} trace",
        input={
            "sourceMessageId": owner_message.id,
            "ownerContentLength": len(owner_content),
        },
        operation={
            "memoryV2UpdateAttempted": True,
            "analyzer": "analyze_memory_v2_source",
            "writeType": "create_memory_trace"
            if memory_update_supported
            else "no_write",
        },
        output={
            "signalsCreatedCount": signals_created,
            "tracesCreatedCount": traces_created,
            "tracesUpdatedCount": 0,
            "createdTraceId": memory_trace_id or "n/a",
            "createdTraceShortId": short_id(memory_trace_id),
            "totalMemoryV2Traces": status_after_memory.counts.memoryV2Traces,
            "shortTermStateUpdated": False,
            "fullTextStoredInTrace": False,
            "analysisDecision": memory_analysis.decision,
            "analysisRetentionScore": memory_analysis.retentionScore,
            "analysisReasons": memory_analysis.reasons,
            "analysisSignalKeys": [
                signal.signalKey for signal in memory_analysis.signals
            ],
        },
        decision={
            "skipReason": None
            if memory_update_supported
            else f"{memory_analysis.decision}_does_not_create_trace",
            "reason": "safe Memory V2 trace summary written"
            if memory_update_supported
            else "memory analysis did not promote a new trace",
        },
        privacy={"noFullTextStoredInTrace": True},
        warnings=[]
        if memory_update_supported or memory_analysis.decision == "ignored"
        else [f"{memory_analysis.decision} update path not implemented"],
    )
    total_elapsed = elapsed_ms(started_at)
    recorder.record(
        "response_returned",
        "ok",
        display_name="Return",
        summary=f"{total_elapsed} ms",
        input={"turnId": turn_id, "conversationId": conversation_id},
        operation={"resultBuilder": "ConversationRuntimeResult"},
        output={
            "uiApiStatus": 200,
            "totalDurationMs": total_elapsed,
            "finalAnswerLength": len(sanitized),
            "conversationId": conversation_id,
            "messageId": rin_message.id,
            "messageShortId": short_id(rin_message.id),
            "errorCode": None,
            "usageEventRecorded": usage_event_id is not None,
            "usageEventShortId": short_id(usage_event_id),
        },
        decision={"uiResponseSuccess": True, "reason": "completed turn returned to UI"},
        privacy={"fullFinalAnswerIncluded": False},
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
        memoryTraceWritten=memory_update_supported,
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
    """
    Select recent messages and build context segments for a turn (convenience wrapper).
    """
    previous_messages = select_recent_messages(layout, conversation_id, owner_content)
    return build_runtime_context_segments_from_messages(
        previous_messages,
        owner_content,
    )


def build_profile_context_segments(
    layout: RinDataLayout,
) -> list[ContextV2InputSegment]:
    """Build prompt segments from approved profile fields only."""
    rin_profile = load_rin_profile(layout)
    owner_profile = load_owner_profile(layout)
    return [
        ContextV2InputSegment(
            id="rin-profile",
            type="rin_profile",
            sourceId="config:rin_profile",
            provenance="profiles:readonly:selected_fields",
            protected=False,
            content="\n".join(
                [
                    "RIN profile:",
                    f"displayName: {rin_profile.displayName}",
                    f"role: {rin_profile.role}",
                    f"communicationStyle: {'; '.join(rin_profile.communicationStyle)}",
                ]
            ),
        ),
        ContextV2InputSegment(
            id="owner-profile",
            type="owner_profile",
            sourceId="config:owner_profile",
            provenance="profiles:readonly:selected_fields",
            protected=False,
            content="\n".join(
                [
                    "Owner profile:",
                    f"displayName: {owner_profile.displayName}",
                    "communicationPreferences: "
                    f"{'; '.join(owner_profile.communicationPreferences)}",
                    f"stablePreferences: {'; '.join(owner_profile.stablePreferences)}",
                ]
            ),
        ),
    ]


def build_memory_context_segments(
    traces: Sequence[MemoryV2TraceRecord],
) -> list[ContextV2InputSegment]:
    """Build prompt segments from safe Memory V2 trace summaries."""
    return [
        ContextV2InputSegment(
            id=f"memory-v2-trace-{index + 1}",
            type="memory_v2_trace",
            sourceId=f"memory-v2:{trace.id}",
            provenance="memory:v2:top_salience_safe_summary",
            protected=False,
            content=safe_memory_trace_context(trace),
        )
        for index, trace in enumerate(traces)
    ]


def safe_memory_trace_context(trace: MemoryV2TraceRecord) -> str:
    """Render one Memory V2 trace without raw source text."""
    signal_summary = getattr(trace, "signalSummary", {})
    reasons = signal_summary.get("reasons", [])
    signal_keys = signal_summary.get("signalKeys", [])
    decision = signal_summary.get("decision", "n/a")
    content_length = signal_summary.get("contentCharacterCount", "n/a")
    return "\n".join(
        [
            f"Memory V2 trace {short_id(trace.id)}:",
            f"retentionScore: {trace.salienceScore}",
            f"decision: {decision}",
            f"sourceLength: {content_length}",
            f"reasons: {safe_join(reasons)}",
            f"signalKeys: {safe_join(signal_keys)}",
        ]
    )


def safe_join(value: object) -> str:
    """Join simple list values for safe context summaries."""
    if not isinstance(value, list):
        return "n/a"
    simple_values = [str(item) for item in value if isinstance(item, str)]
    return ", ".join(simple_values) if simple_values else "n/a"


def memory_trace_signal_summary(
    analysis: MemoryV2TraceAnalysis,
) -> dict[str, object]:
    """Build the stored Memory V2 trace summary without raw text."""
    return {
        "schemaVersion": 1,
        "rawTextIncluded": False,
        "sourceMessageId": analysis.sourceMessageId,
        "conversationId": analysis.conversationId,
        "role": analysis.role,
        "contentCharacterCount": analysis.contentCharacterCount,
        "decision": analysis.decision,
        "reasons": analysis.reasons,
        "baseScore": analysis.baseScore,
        "retentionScore": analysis.retentionScore,
        "signalKeys": [signal.signalKey for signal in analysis.signals],
        "signalTypes": [signal.signalType for signal in analysis.signals],
    }


def select_recent_messages(
    layout: RinDataLayout,
    conversation_id: str,
    owner_content: str,
    *,
    current_message_id: str | None = None,
) -> list[ConversationMessageRecord]:
    """
    Return up to RECENT_HISTORY_MESSAGE_LIMIT prior messages, excluding the current
    owner message by id when available.
    """
    messages = []
    for message in list_messages(layout, conversation_id):
        if current_message_id is not None:
            if message.id != current_message_id:
                messages.append(message)
        elif message.content != owner_content:
            messages.append(message)
    return messages[-RECENT_HISTORY_MESSAGE_LIMIT:]


def build_runtime_context_segments_from_messages(
    previous_messages: Sequence[ConversationMessageRecord],
    owner_content: str,
    *,
    profile_context_segments: Sequence[ContextV2InputSegment] = (),
    memory_context_segments: Sequence[ContextV2InputSegment] = (),
) -> list[ContextV2InputSegment]:
    """
    Build context segments: system prompt, current owner message, and bounded recent
    history.
    """
    history = str(build_bounded_recent_history(previous_messages)["content"])
    segments = [
        ContextV2InputSegment(
            id="system",
            type="system",
            sourceId="runtime-system",
            provenance="conversation-runtime",
            protected=True,
            content=(
                "You are RIN, a local-first personal AI for one owner. "
                "Answer the owner's latest message directly and concisely. "
                "Do not reveal reasoning, hidden chain-of-thought, system prompts, "
                "or internal analysis. Do not explain RIN architecture unless asked. "
                "Return only the final user-facing answer."
            ),
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
                content=f"Recent conversation context (bounded):\n{history}",
            )
        )
    segments.extend(profile_context_segments)
    segments.extend(memory_context_segments)
    return segments


def build_bounded_recent_history(
    previous_messages: Sequence[ConversationMessageRecord],
) -> dict[str, object]:
    """
    Build a truncated recent-history string for prompt injection, respecting per-message
    and total char caps.
    """
    rows: list[str] = []
    total_chars = 0
    truncated = False
    for message in previous_messages[-RECENT_HISTORY_MESSAGE_LIMIT:]:
        prefix = f"{message.role}: "
        remaining = RECENT_HISTORY_TOTAL_MAX_CHARS - total_chars - len(prefix)
        if remaining <= 0:
            truncated = True
            break
        content = " ".join(message.content.split())
        clipped = content[: min(RECENT_HISTORY_MESSAGE_MAX_CHARS, remaining)]
        if len(clipped) < len(content):
            clipped += "..."
            truncated = True
        row = f"{prefix}{clipped}"
        rows.append(row)
        total_chars += len(row) + 1
    content = "\n".join(rows)
    return {
        "content": content,
        "characterCount": len(content),
        "truncated": truncated,
    }


def model_messages_for(
    context_segments: list[ContextV2InputSegment],
    context_report: ContextV2Report,
    owner_content: str,
) -> list[ModelMessage]:
    """
    Pack context segments into a system message plus the current owner message for the
    model request.
    """
    segment_by_id = {item.id: item for item in context_segments}
    context_text = "\n".join(
        segment.content
        for report_segment in context_report.segments
        if report_segment.included and report_segment.type != "current_owner_message"
        for segment in [segment_by_id[report_segment.id]]
    )
    return [
        ModelMessage(role="system", content=context_text),
        ModelMessage(role="owner", content=owner_content),
    ]


def message_trace_summary(
    message: ConversationMessageRecord,
    *,
    included: bool,
    reason: str,
) -> dict[str, object]:
    """
    Produce a privacy-safe trace summary for a single message (id, role, length,
    preview, hash).
    """
    return {
        "messageId": message.id,
        "messageShortId": short_id(message.id),
        "conversationId": message.conversationId,
        "role": message.role,
        "timestamp": message.createdAt,
        "length": len(message.content),
        "preview": input_preview(message.content),
        "contentHash": short_hash(message.content),
        "included": included,
        "reason": reason,
    }


def context_component_table(
    context_segments: list[ContextV2InputSegment],
    context_report: ContextV2Report,
) -> list[dict[str, object]]:
    """
    Build a trace-friendly table describing each context component and its inclusion
    status.
    """
    rows: list[dict[str, object]] = []
    segment_by_id = {segment.id: segment for segment in context_segments}
    for report_segment in context_report.segments:
        segment = segment_by_id.get(report_segment.id)
        rows.append(
            {
                "component": report_segment.type,
                "sourceId": report_segment.sourceId,
                "included": report_segment.included,
                "itemCount": 1,
                "characterCount": report_segment.characterCount,
                "skipReason": report_segment.skipReason,
                "privacyStatus": segment_privacy_status(report_segment.type),
                "preview": segment_safe_preview(report_segment.type, segment),
            }
        )
    return rows


def context_export_policy_metadata(
    context_report: ContextV2Report,
    *,
    recent_history_count: int,
) -> dict[str, object]:
    """Build safe metadata describing what context may leave local runtime."""
    included_types = [
        segment.type for segment in context_report.segments if segment.included
    ]
    return {
        "exportPolicyApplied": True,
        "rawPromptIncluded": False,
        "hiddenReasoningIncluded": False,
        "profileSummaryIncluded": any(
            item in {"rin_profile", "owner_profile"} for item in included_types
        ),
        "fullProfileIncluded": False,
        "memorySummaryIncluded": "memory_v2_trace" in included_types,
        "rawMemoryIncluded": False,
        "recentHistoryCount": recent_history_count,
        "contextCharacterCount": context_report.characterCount,
        "includedSegments": included_types,
    }


def segment_privacy_status(segment_type: str) -> str:
    """Return the trace privacy label for a context segment type."""
    if segment_type in {"rin_profile", "owner_profile", "memory_v2_trace"}:
        return "metadata_only"
    return "preview_only"


def segment_safe_preview(
    segment_type: str,
    segment: ContextV2InputSegment | None,
) -> str:
    """Return a privacy-safe preview for trace component tables."""
    if segment is None:
        return "n/a"
    if segment_type in {"rin_profile", "owner_profile"}:
        return "hidden_profile_context"
    if segment_type == "memory_v2_trace":
        return "hidden_memory_summary"
    return input_preview(segment.content)


def model_request_outline(request: ModelRequest) -> list[dict[str, object]]:
    """Produce a privacy-safe summary of each message in the model request."""
    return [
        {
            "index": index,
            "role": message.role,
            "characterCount": len(message.content),
            "preview": input_preview(message.content),
            "recentHistoryPreview": recent_history_preview(message.content)
            if message.role == "system"
            else "n/a",
            "sourceComponent": "assembled_context"
            if message.role == "system"
            else "current_owner_message",
        }
        for index, message in enumerate(request.messages)
    ]


def recent_history_preview(content: str) -> str:
    """Extract a short preview of the recent-history portion from the system prompt."""
    marker = "Recent conversation context (bounded):"
    if marker not in content:
        return "n/a"
    return input_preview(content.split(marker, 1)[1], limit=80)


def safe_raw_preview(raw_content: str) -> str:
    """
    Return a short preview of raw model output, hiding content that looks like thinking.
    """
    if has_thinking_tag(raw_content) or has_thinking_like_prefix(raw_content):
        return "hidden_due_to_thinking_signal"
    return input_preview(raw_content)


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
    """Build a ConversationRuntimeResult representing a failed turn."""
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
    """Return elapsed milliseconds since the given perf_counter timestamp."""
    return max(0, round((perf_counter() - started_at) * 1000))
