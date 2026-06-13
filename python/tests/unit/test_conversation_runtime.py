import json
import shutil
from typing import cast

import pytest

from rin.contracts import (
    ModelErrorDetails,
    ModelRequest,
    ModelResponse,
    ModelResponseMetadata,
)
from rin.conversation import RuntimeClock, run_conversation_turn
from rin.database import (
    create_memory_trace,
    create_temp_layout_database,
    inspect_database,
    list_api_usage_events,
    list_memory_v2_traces,
    list_messages,
)
from rin.diagnostics.runtime_trace import RUNTIME_TRACE_STORE
from rin.diagnostics.safety import create_temp_data_dir
from rin.model import ModelError
from rin.storage import RinDataLayout

NOW = "2026-06-05T00:00:00.000Z"


class MockAdapter:
    id = "rin-mock-test"

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
    id = "rin-mock-test"

    async def generate(self, request: ModelRequest) -> ModelResponse:
        raise ModelError(
            "MODEL_RESPONSE_INVALID",
            "empty",
            "rin-mock-test",
            retryable=True,
            details=ModelErrorDetails(emptyContent=True),
        )


class RawMetadataAdapter:
    id = "rin-api-chat-openai-compatible"
    provider = "openai-compatible"
    model = "qwen-long"
    baseUrl = "https://api.example.test/v1"
    timeoutMs = 180000

    def __init__(self) -> None:
        self.raw = "<think>private</think>\n\nFinal answer."
        self.sanitized = "Final answer."

    async def generate(self, request: ModelRequest) -> ModelResponse:
        return ModelResponse(
            content=self.sanitized,
            adapterId=self.id,
            metadata=ModelResponseMetadata(
                externalProvider=True,
                memoryWriteRequested=False,
                toolCallRequested=False,
                providerId=self.id,
                provider=self.provider,
                model=self.model,
                safeBaseUrl=self.baseUrl,
                rawContentLength=len(self.raw),
                rawContentHash="rawhash",
                rawPreview="hidden_due_to_thinking_signal",
                rawModelOutputIncluded=False,
                thinkingTagDetected=True,
                thinkingLikePrefixDetected=False,
                adapterSanitized=True,
                adapterRemovedCharacterCount=len(self.raw) - len(self.sanitized),
                sanitizedContentLength=len(self.sanitized),
            ),
        )


class ExternalUsageAdapter:
    id = "rin-api-chat-openai-compatible"
    provider = "openai-compatible"
    model = "qwen-long"
    baseUrl = "https://api.example.test/v1"
    timeoutMs = 180000

    def __init__(
        self,
        *,
        content: str = "External reply.",
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
        total_tokens: int | None = None,
    ) -> None:
        self.content = content
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.total_tokens = total_tokens
        self.requests: list[ModelRequest] = []

    async def generate(self, request: ModelRequest) -> ModelResponse:
        self.requests.append(request)
        return ModelResponse(
            content=self.content,
            adapterId=self.id,
            metadata=ModelResponseMetadata(
                externalProvider=True,
                memoryWriteRequested=False,
                toolCallRequested=False,
                providerId=self.id,
                provider=self.provider,
                model=self.model,
                safeBaseUrl=self.baseUrl,
                promptTokens=self.prompt_tokens,
                completionTokens=self.completion_tokens,
                totalTokens=self.total_tokens,
                rawContentLength=len(self.content),
                rawContentHash="contenthash",
                rawModelOutputIncluded=False,
                secretValuesIncluded=False,
            ),
        )


def create_layout() -> RinDataLayout:
    temp = create_temp_data_dir()
    return create_temp_layout_database(temp.path)


def write_profiles(layout: RinDataLayout) -> None:
    config = layout.directories["config"]
    config.mkdir(parents=True, exist_ok=True)
    (config / "rin_profile.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "kind": "rin_profile",
                "updatedAt": NOW,
                "displayName": "RIN",
                "role": "local-first personal AI companion",
                "communicationStyle": ["concise", "Chinese-friendly"],
                "behaviorBoundaries": ["DO_NOT_INJECT_BOUNDARY"],
                "contextNotes": ["DO_NOT_INJECT_RIN_NOTE"],
            }
        ),
        encoding="utf-8",
    )
    (config / "owner_profile.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "kind": "owner_profile",
                "ownerId": "local-owner",
                "updatedAt": NOW,
                "displayName": "Owner",
                "communicationPreferences": ["direct"],
                "stablePreferences": ["prefers local-first systems"],
                "activeProjects": ["DO_NOT_INJECT_PROJECT"],
                "contextNotes": ["DO_NOT_INJECT_OWNER_NOTE"],
            }
        ),
        encoding="utf-8",
    )


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
        assert result.memoryTraceWritten is False
        assert status.counts.conversationTurns == 1
        assert status.counts.memoryV2Traces == 0
        assert status.counts.apiUsageEvents == 0
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
        assert memory_stage.decision["skipReason"] == "no_memory_v2_traces"
        assert context_stage.output["componentTable"]
        assert request_stage.output["requestOutline"]
        assert request_stage.output["currentOwnerInputLast"] is True
        assert reply_stage.output["storedSanitizedAnswer"] is True
        assert reply_stage.output["storedRawThinking"] is False
        assert memory_update_stage.output["analysisDecision"] == "ignored"
        assert memory_update_stage.output["tracesCreatedCount"] == 0
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_promotes_memory_trace_from_owner_signal() -> None:
    layout = create_layout()
    try:
        RUNTIME_TRACE_STORE.clear()
        result = await run_conversation_turn(
            layout,
            "I prefer concise RIN progress reports.",
            MockAdapter("Noted."),
            clock=RuntimeClock(NOW),
        )

        status = inspect_database(layout)
        traces = list_memory_v2_traces(layout)
        trace = RUNTIME_TRACE_STORE.latest()
        assert trace is not None
        memory_update_stage = next(
            stage for stage in trace.stages if stage.name == "memory_update"
        )

        assert result.status == "completed"
        assert result.memoryTraceWritten is True
        assert status.counts.memoryV2Traces == 1
        assert traces[0].signalSummary["rawTextIncluded"] is False
        assert traces[0].signalSummary["decision"] == "promoted"
        assert traces[0].signalSummary["contentCharacterCount"] == len(
            "I prefer concise RIN progress reports."
        )
        assert "I prefer" not in str(traces[0].signalSummary)
        assert memory_update_stage.output["analysisDecision"] == "promoted"
        assert memory_update_stage.output["tracesCreatedCount"] == 1
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_injects_selected_profile_fields_only() -> None:
    layout = create_layout()
    try:
        write_profiles(layout)
        RUNTIME_TRACE_STORE.clear()
        adapter = MockAdapter("Profile-aware reply.")
        await run_conversation_turn(
            layout,
            "hello",
            adapter,
            clock=RuntimeClock(NOW),
        )

        system_context = adapter.requests[0].messages[0].content
        trace = RUNTIME_TRACE_STORE.latest()
        assert trace is not None
        profile_stage = next(
            stage for stage in trace.stages if stage.name == "profile_loading"
        )
        context_stage = next(
            stage for stage in trace.stages if stage.name == "context_assembly"
        )
        component_table = context_stage.output["componentTable"]

        assert "displayName: RIN" in system_context
        assert "communicationStyle: concise; Chinese-friendly" in system_context
        assert "communicationPreferences: direct" in system_context
        assert "stablePreferences: prefers local-first systems" in system_context
        assert "DO_NOT_INJECT" not in system_context
        assert profile_stage.decision["profileContextInjected"] is True
        assert any(
            item["component"] == "owner_profile"
            and item["preview"] == "hidden_profile_context"
            for item in component_table
        )
        assert context_stage.output["exportPolicyApplied"] is True
        assert context_stage.output["rawPromptIncluded"] is False
        assert context_stage.output["hiddenReasoningIncluded"] is False
        assert context_stage.output["profileSummaryIncluded"] is True
        assert context_stage.output["fullProfileIncluded"] is False
        assert context_stage.output["rawMemoryIncluded"] is False
        assert context_stage.output["recentHistoryCount"] == 0
        assert "owner_profile" in context_stage.output["includedSegments"]
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_records_provider_usage_tokens_for_external_adapter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RIN_COST_INPUT_PER_1K_TOKENS_CNY", "0.0005")
    monkeypatch.setenv("RIN_COST_OUTPUT_PER_1K_TOKENS_CNY", "0.0005")
    monkeypatch.setenv("RIN_COST_CURRENCY", "CNY")
    layout = create_layout()
    try:
        RUNTIME_TRACE_STORE.clear()
        result = await run_conversation_turn(
            layout,
            "hello",
            ExternalUsageAdapter(
                content="External final answer.",
                prompt_tokens=1000,
                completion_tokens=500,
                total_tokens=1500,
            ),
            clock=RuntimeClock(NOW),
        )

        records = list_api_usage_events(layout)

        assert result.status == "completed"
        assert len(records) == 1
        assert records[0].turnId == result.turnId
        assert records[0].providerId == "rin-api-chat-openai-compatible"
        assert records[0].inputTokens == 1000
        assert records[0].outputTokens == 500
        assert records[0].totalTokens == 1500
        assert records[0].estimatedCost == 0.00075
        assert records[0].currency == "CNY"
        assert records[0].estimateMethod == "provider_usage"
        assert records[0].rawPromptIncluded is False
        assert records[0].rawResponseIncluded is False
        assert records[0].hiddenReasoningIncluded is False
        assert records[0].secretValuesIncluded is False
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_estimates_usage_when_provider_usage_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("RIN_COST_INPUT_PER_1K_TOKENS_CNY", "0.0005")
    monkeypatch.setenv("RIN_COST_OUTPUT_PER_1K_TOKENS_CNY", "0.0005")
    monkeypatch.setenv("RIN_COST_CURRENCY", "CNY")
    layout = create_layout()
    try:
        RUNTIME_TRACE_STORE.clear()
        result = await run_conversation_turn(
            layout,
            "hello",
            ExternalUsageAdapter(content="abcd"),
            clock=RuntimeClock(NOW),
        )

        records = list_api_usage_events(layout)

        assert result.status == "completed"
        assert len(records) == 1
        assert records[0].inputTokens > 0
        assert records[0].outputTokens == 1
        assert records[0].totalTokens == records[0].inputTokens + 1
        assert records[0].estimatedCost > 0
        assert records[0].estimateMethod == "estimated_chars_div_4"
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_injects_top_memory_trace_summaries_only() -> None:
    layout = create_layout()
    try:
        for trace_id, score in (
            ("trace-low", 0.1),
            ("trace-high", 0.9),
            ("trace-mid", 0.7),
            ("trace-second", 0.8),
        ):
            create_memory_trace(
                layout,
                trace_id,
                f"source-{trace_id}",
                {
                    "rawTextIncluded": False,
                    "decision": "promoted",
                    "reasons": [f"reason-{trace_id}"],
                    "signalKeys": [f"signal-{trace_id}"],
                    "contentCharacterCount": 42,
                },
                score,
                NOW,
            )
        RUNTIME_TRACE_STORE.clear()
        adapter = MockAdapter("Memory-aware reply.")
        await run_conversation_turn(
            layout,
            "What context matters?",
            adapter,
            clock=RuntimeClock(NOW),
        )

        system_context = adapter.requests[0].messages[0].content
        trace = RUNTIME_TRACE_STORE.latest()
        assert trace is not None
        memory_stage = next(
            stage for stage in trace.stages if stage.name == "memory_v2_retrieval"
        )
        context_stage = next(
            stage for stage in trace.stages if stage.name == "context_assembly"
        )

        assert memory_stage.output["selectedTraceCount"] == 3
        assert memory_stage.output["selectedScores"] == [0.9, 0.8, 0.7]
        assert "reason-trace-high" in system_context
        assert "reason-trace-second" in system_context
        assert "reason-trace-mid" in system_context
        assert "reason-trace-low" not in system_context
        assert "source-trace-high" not in system_context
        assert any(
            item["component"] == "memory_v2_trace"
            and item["privacyStatus"] == "metadata_only"
            and item["preview"] == "hidden_memory_summary"
            for item in context_stage.output["componentTable"]
        )
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_injects_bounded_recent_history_content() -> None:
    layout = create_layout()
    try:
        RUNTIME_TRACE_STORE.clear()
        adapter = MockAdapter("ok")
        first = await run_conversation_turn(
            layout,
            "上一句话是香蕉。",
            adapter,
            clock=RuntimeClock(NOW),
        )
        await run_conversation_turn(
            layout,
            "我说的上一句话是什么？",
            adapter,
            conversation_id=first.conversationId,
            clock=RuntimeClock(NOW),
        )

        second_request = adapter.requests[-1]
        system_message = second_request.messages[0]

        assert second_request.messages[-1].content == "我说的上一句话是什么？"
        assert "上一句话是香蕉" in system_message.content
        assert "chars" not in system_message.content
        trace = RUNTIME_TRACE_STORE.latest()
        assert trace is not None
        recent_stage = next(
            stage for stage in trace.stages if stage.name == "recent_history_selection"
        )
        request_stage = next(
            stage for stage in trace.stages if stage.name == "model_request"
        )
        assert (
            cast(
                int,
                recent_stage.output["promptInjectedRecentHistoryCharacterCount"],
            )
            > 0
        )
        assert request_stage.output["currentOwnerInputLast"] is True
        outline = request_stage.output["requestOutline"]
        assert isinstance(outline, list)
        assert "上一句话是香蕉" in str(outline[0]["recentHistoryPreview"])
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_keeps_prior_repeated_owner_message_in_history() -> None:
    layout = create_layout()
    try:
        RUNTIME_TRACE_STORE.clear()
        adapter = MockAdapter("ok")
        first = await run_conversation_turn(
            layout,
            "repeatable owner phrase",
            adapter,
            clock=RuntimeClock(NOW),
        )
        await run_conversation_turn(
            layout,
            "different middle phrase",
            adapter,
            conversation_id=first.conversationId,
            clock=RuntimeClock(NOW),
        )
        await run_conversation_turn(
            layout,
            "repeatable owner phrase",
            adapter,
            conversation_id=first.conversationId,
            clock=RuntimeClock(NOW),
        )

        system_message = adapter.requests[-1].messages[0]
        trace = RUNTIME_TRACE_STORE.latest()
        assert trace is not None
        recent_stage = next(
            stage for stage in trace.stages if stage.name == "recent_history_selection"
        )

        assert adapter.requests[-1].messages[-1].content == "repeatable owner phrase"
        assert "owner: repeatable owner phrase" in system_message.content
        assert recent_stage.output["selectedPriorMessages"] == 4
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_records_large_removal_short_final_warning() -> None:
    layout = create_layout()
    try:
        RUNTIME_TRACE_STORE.clear()
        long_analysis = "首先，用户问晚饭吃什么。" + ("我需要分析。" * 30)
        result = await run_conversation_turn(
            layout,
            "晚饭吃什么？",
            MockAdapter(f"{long_analysis}\n最终答案：面。"),
            clock=RuntimeClock(NOW),
        )

        assert result.status == "completed"
        trace = RUNTIME_TRACE_STORE.latest()
        assert trace is not None
        sanitizer = next(
            stage for stage in trace.stages if stage.name == "sanitization_final_answer"
        )
        assert sanitizer.output["largeRemovalShortFinalWarning"] is True
        assert "large sanitizer removal with short final answer" in sanitizer.warnings
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


@pytest.mark.asyncio
async def test_runtime_trace_distinguishes_raw_metadata_from_adapter_content() -> None:
    layout = create_layout()
    try:
        RUNTIME_TRACE_STORE.clear()
        adapter = RawMetadataAdapter()
        result = await run_conversation_turn(
            layout,
            "hello",
            adapter,
            clock=RuntimeClock(NOW),
        )

        assert result.status == "completed"
        trace = RUNTIME_TRACE_STORE.latest()
        assert trace is not None
        raw_stage = next(
            stage for stage in trace.stages if stage.name == "raw_model_response"
        )
        sanitizer = next(
            stage for stage in trace.stages if stage.name == "sanitization_final_answer"
        )
        assert raw_stage.displayName == "Provider Response"
        assert raw_stage.output["providerRawMetadataAvailable"] is True
        assert raw_stage.output["rawContentLength"] == len(adapter.raw)
        assert raw_stage.output["adapterContentLength"] == len(adapter.sanitized)
        assert raw_stage.output["adapterSanitized"] is True
        assert sanitizer.input["rawContentLength"] == len(adapter.raw)
        assert sanitizer.output["finalLength"] == len(adapter.sanitized)
        assert sanitizer.output["storedSanitizedOnly"] is True
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
async def test_runtime_rejects_nonempty_sanitizer_rejection() -> None:
    layout = create_layout()
    try:
        RUNTIME_TRACE_STORE.clear()
        result = await run_conversation_turn(
            layout,
            "dinner",
            MockAdapter("最终答案：Eat noodles.\ninternal analysis: hidden"),
            clock=RuntimeClock(NOW),
        )

        messages = list_messages(layout, result.conversationId)
        trace = RUNTIME_TRACE_STORE.latest()
        assert trace is not None
        sanitizer = next(
            stage for stage in trace.stages if stage.name == "sanitization_final_answer"
        )

        assert result.status == "failed"
        assert result.errorCode == "MODEL_RESPONSE_INVALID"
        assert [message.role for message in messages] == ["owner"]
        assert sanitizer.decision["rejected"] is True
        assert sanitizer.decision["rejectionReason"] == (
            "unsafe_thinking_marker_remaining"
        )
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
