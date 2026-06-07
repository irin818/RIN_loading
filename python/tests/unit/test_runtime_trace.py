from typing import cast

from rin.diagnostics.runtime_trace import (
    RuntimeTraceRecorder,
    RuntimeTraceStore,
    has_thinking_like_prefix,
    has_thinking_tag,
    input_preview,
    safe_trace_response,
    short_hash,
)


def test_runtime_trace_recorder_records_stages_in_order() -> None:
    recorder = RuntimeTraceRecorder("turn-1", "conv-1", "2026-06-05T00:00:00.000Z")

    recorder.record(
        "input_received",
        "ok",
        input={"role": "owner"},
        operation={"normalizationApplied": False},
        output={"inputLength": 12},
        decision={"accepted": True},
        privacy={"fullOwnerInputIncluded": False},
    )
    recorder.record(
        "model_request",
        "ok",
        input={"conversationId": "conv-1"},
        operation={"adapter": "mock"},
        output={"requestMessageCount": 2},
        decision={"sentToAdapter": True},
        privacy={"rawPromptIncluded": False},
    )
    trace = recorder.finish("success")

    assert trace.turnId == "turn-1"
    assert trace.conversationId == "conv-1"
    assert trace.status == "success"
    assert [stage.name for stage in trace.stages] == [
        "input_received",
        "model_request",
    ]
    payload = trace.to_safe_dict()
    assert payload["privacyMode"] == "safe"
    assert payload["fullTextIncluded"] is False
    assert payload["rawModelOutputIncluded"] is False
    stages = cast(list[dict[str, object]], payload["stages"])
    stage = stages[0]
    stage_input = cast(dict[str, object], stage["input"])
    stage_operation = cast(dict[str, object], stage["operation"])
    stage_output = cast(dict[str, object], stage["output"])
    stage_decision = cast(dict[str, object], stage["decision"])
    stage_privacy = cast(dict[str, object], stage["privacy"])
    assert stage["displayName"] == "Input"
    assert stage_input["role"] == "owner"
    assert stage_operation["normalizationApplied"] is False
    assert stage_output["inputLength"] == 12
    assert stage_decision["accepted"] is True
    assert stage_privacy["fullOwnerInputIncluded"] is False
    assert "durationMs" in stage


def test_runtime_trace_store_returns_latest_and_by_turn_id() -> None:
    store = RuntimeTraceStore(limit=2)
    first = RuntimeTraceRecorder("turn-1", "conv-1", "now").finish("success")
    second = RuntimeTraceRecorder("turn-2", "conv-1", "now").finish("failed", "E")

    store.add(first)
    store.add(second)

    assert store.latest() == second
    assert store.get("turn-1") == first
    assert [trace.turnId for trace in store.list()] == ["turn-2", "turn-1"]


def test_runtime_trace_safe_helpers_do_not_return_full_text_by_default() -> None:
    text = "private owner message that should only produce a short preview"

    assert input_preview(text) == "private owner mess..."
    assert len(short_hash(text)) == 12
    assert has_thinking_tag("<think>hidden</think> answer") is True
    assert has_thinking_like_prefix("Reasoning: hidden") is True


def test_safe_trace_response_marks_private_fields_hidden() -> None:
    trace = RuntimeTraceRecorder("turn-1", "conv-1", "now").finish("success")
    response = safe_trace_response([trace])

    assert response["privacyMode"] == "safe"
    assert response["readOnly"] is True
    assert response["externalProviderCallCount"] == 0
    assert response["fullTextIncluded"] is False
    assert response["rawPromptIncluded"] is False
    assert response["rawModelOutputIncluded"] is False
    traces = cast(list[dict[str, object]], response["traces"])
    assert traces[0]["turnId"] == "turn-1"
