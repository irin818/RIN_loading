import re
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rin.contracts import ModelRequest, ModelResponse, ModelResponseMetadata
from rin.conversation import ModelAdapterProtocol
from rin.database import (
    append_message,
    create_conversation,
    create_rin_growth_events,
    create_temp_layout_database,
    create_tool_invocation_requests,
    list_audit_summaries,
    list_rin_growth_events,
    list_tool_invocation_requests,
)
from rin.diagnostics.runtime_trace import RUNTIME_TRACE_STORE
from rin.diagnostics.safety import create_temp_data_dir
from rin.mind import RinGrowthEvent, ToolInvocationRequest
from rin.server import create_app
from rin.server.api import MockApiAdapter
from rin.storage import RinDataLayout, create_data_layout

EXPECTED_RUNTIME_TRACE_STAGE_NAMES = [
    "input_received",
    "owner_message_persisted",
    "profile_loading",
    "message_understanding",
    "owner_state_inference",
    "memory_candidate_generation",
    "recent_history_selection",
    "memory_v2_retrieval",
    "context_planning",
    "response_planning",
    "context_assembly",
    "model_request",
    "raw_model_response",
    "sanitization_final_answer",
    "rin_reply_persisted",
    "memory_update",
    "mind_lifecycle",
    "response_returned",
]


def create_client(
    adapter: ModelAdapterProtocol | None = None,
) -> tuple[TestClient, RinDataLayout]:
    RUNTIME_TRACE_STORE.clear()
    temp = create_temp_data_dir()
    layout = create_temp_layout_database(temp.path)
    selected_adapter = adapter if adapter is not None else MockApiAdapter()
    return TestClient(create_app(layout, adapter=selected_adapter)), layout


class FailingAdapter:
    id = "failing-test-adapter"

    async def generate(self, request: ModelRequest) -> ModelResponse:
        raise RuntimeError("test adapter failure")


class ExternalUsageAdapter:
    id = "rin-api-chat-openai-compatible"
    provider = "openai-compatible"
    model = "deepseek-v4-flash"
    baseUrl = "https://api.example.test/v1"
    timeoutMs = 180000

    async def generate(self, request: ModelRequest) -> ModelResponse:
        return ModelResponse(
            content="External API mock reply.",
            adapterId=self.id,
            metadata=ModelResponseMetadata(
                externalProvider=True,
                memoryWriteRequested=False,
                toolCallRequested=False,
                providerId=self.id,
                provider=self.provider,
                model=self.model,
                safeBaseUrl=self.baseUrl,
                promptTokens=10,
                completionTokens=5,
                totalTokens=15,
                rawContentLength=len("External API mock reply."),
                rawContentHash="hash",
                rawModelOutputIncluded=False,
                secretValuesIncluded=False,
            ),
        )


def test_readiness_and_state_are_local_only() -> None:
    client, layout = create_client()
    try:
        readiness = client.get("/readiness")
        state = client.get("/state")

        assert readiness.status_code == 200
        assert readiness.json()["provider_call_count"] == 0
        assert state.status_code == 200
        assert state.json()["localOnly"] is True
        assert state.json()["writesTempOnly"] is True
        assert state.json()["productionDataProtected"] is True
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_conversation_create_send_and_history_contract() -> None:
    client, layout = create_client()
    try:
        created = client.post("/conversations", json={"title": "API test"})
        assert created.status_code == 200
        conversation_id = created.json()["id"]

        sent = client.post(
            f"/conversations/{conversation_id}/send",
            json={"content": "hello"},
        )
        history = client.get(f"/conversations/{conversation_id}/history")
        trace = client.get("/memory/context-trace/status")

        assert sent.status_code == 200
        assert sent.json()["status"] == "completed"
        assert sent.json()["fakeReplyWritten"] is False
        assert history.status_code == 200
        assert [item["role"] for item in history.json()["messages"]] == [
            "owner",
            "rin",
        ]
        assert trace.status_code == 200
        assert trace.json()["memoryV2Traces"] == 0
        assert trace.json()["fullTextIncluded"] is False
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_write_routes_allow_initialized_production_root(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import rin.diagnostics.safety as safety
    from rin.database import initialize_temp_database

    production = tmp_path / ".rin-data"
    monkeypatch.setattr(safety, "PRODUCTION_RIN_DATA_DIR", production)
    layout = create_data_layout(str(production), cwd="/")
    initialize_temp_database(layout)
    client = TestClient(create_app(layout))

    response = client.post("/conversations", json={"title": "allowed"})

    assert response.status_code == 200
    assert response.json()["title"] == "allowed"


def test_python_ui_renders_local_status_and_profile_summary() -> None:
    client, layout = create_client()
    try:
        response = client.get("/", follow_redirects=False)
        legacy = client.get("/legacy-ui")
        page_text = legacy.text

        assert response.status_code == 307
        assert response.headers["location"] == "/glitch-core"
        assert legacy.status_code == 200
        assert "RIN Control Console" in page_text
        assert "Observe, test, and understand RIN." in page_text
        assert 'class="control-console-shell"' in page_text
        assert 'class="console-topbar"' in page_text
        assert 'class="console-nav glass-panel"' in page_text
        assert 'data-console-tab="overview"' in page_text
        assert 'data-console-tab="chat"' in page_text
        assert 'data-console-tab="runtime-trace"' in page_text
        assert 'data-console-tab="model"' in page_text
        assert 'data-console-tab="memory"' in page_text
        assert 'data-console-tab="context"' in page_text
        assert 'data-console-tab="database"' in page_text
        assert 'data-console-tab="conversations"' in page_text
        assert 'data-console-tab="profiles"' in page_text
        assert 'data-console-tab="body"' in page_text
        assert 'data-console-tab="events"' in page_text
        assert 'data-console-tab="developer"' in page_text
        assert 'data-console-page="overview"' in page_text
        assert 'data-console-page="chat"' in page_text
        assert 'data-console-page="runtime-trace"' in page_text
        assert "Runtime Dataflow Analyzer" in page_text
        assert "Manual Runtime Test Chat" in page_text
        assert 'class="rin-character"' in page_text
        assert 'class="presence-panel glass-panel"' in page_text
        assert 'class="composer-dock"' in page_text
        assert 'class="trace-ring"' in page_text
        assert 'class="metric-card balance-card"' in page_text
        assert 'class="health-grid"' in page_text
        assert "/api/status-dashboard" in page_text
        assert "console.css" in page_text
        assert "console.js" in page_text
        assert "Python-primary local RIN runtime." in page_text
        assert "rin-mock-test" in page_text
        assert "Memory V2" in page_text
        assert "PROFILE" in page_text
        assert "Profile files" in page_text
        assert "Trace full text" in page_text
        assert "Body" in page_text
        assert "RIN PRESENCE" in page_text
        assert "/picture/rin-core-background.png" in page_text
        assert "STATIC BODY / LIVE2D FUTURE" in page_text
        assert "external" in page_text
        assert "0" in page_text
        assert "Start a local conversation." in page_text
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_python_ui_static_assets_are_served() -> None:
    client, layout = create_client()
    try:
        css = client.get("/static/console.css")
        js = client.get("/static/console.js")
        avatar = client.get("/live2d/rin/rin-bust-front.png")
        fullbody = client.get("/live2d/rin/rin-front-fullbody.png")

        assert css.status_code == 200
        assert "control-console-shell" in css.text
        assert "console-grid" in css.text
        assert "console-nav" in css.text
        assert "console-page.active" in css.text
        assert "trace-timeline" in css.text
        assert "trace-e2e" in css.text
        assert "trace-v2-summary" in css.text
        assert "trace-window-layer" in css.text
        assert "trace-window-titlebar" in css.text
        assert "trace-window-body" in css.text
        assert "overflow: visible" in css.text
        assert "position: fixed" in css.text
        assert "memory-console-grid" in css.text
        assert "memory-trace-table" in css.text
        assert "rin-character" in css.text
        assert "presence-panel" in css.text
        assert "composer-dock" in css.text
        assert "trace-ring" in css.text
        assert "health-grid" in css.text
        assert "presence-caption" in css.text
        assert "ambient-grid" in css.text
        assert "RIN console submit failed" in js.text
        assert "requestSubmit" in js.text
        assert "refreshDashboard" in js.text
        assert "refreshLatestRuntimeTrace" in js.text
        assert "renderLatestRuntimeTrace" in js.text
        assert "/api/diagnostics/runtime-trace/latest" in js.text
        assert "await refreshLatestRuntimeTrace()" in js.text
        assert "/api/chat-test/send" in js.text
        assert "document.write" not in js.text
        assert "document.open" not in js.text
        assert "appendChatMessage" in js.text
        assert "startChatTimer" in js.text
        assert "activateConsolePage" in js.text
        assert "openTraceStageWindow" in js.text
        assert "makeDraggable" in js.text
        assert "setPointerCapture" in js.text
        assert "releasePointerCapture" in js.text
        assert 'window.addEventListener("pointermove", move)' in js.text
        assert "curatedPrimaryFields" in js.text
        assert "renderStageSpecificSections" in js.text
        assert "renderSanitizerVisual" in js.text
        assert "closeAllTraceWindows" in js.text
        assert "resetTraceWindows" in js.text
        assert "closeTopTraceWindow" in js.text
        assert 'event.key !== "Escape"' in js.text
        assert "stopPropagation" in js.text
        assert "hasPointerCapture" in js.text
        assert "trace-stage-data" in js.text
        assert "control-console-shell" in js.text
        assert "/api/status-dashboard" not in js.text
        assert avatar.status_code == 200
        assert avatar.headers["content-type"] == "image/png"
        assert fullbody.status_code == 200
        assert fullbody.headers["content-type"] == "image/png"
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_body_state_api_snapshot_and_diagnostics_are_safe() -> None:
    client, layout = create_client()
    try:
        before = client.get("/api/local-state").json()
        response = client.get("/api/body/state")
        snapshot = client.get("/api/glitch-core/snapshot")
        diagnostics = client.get("/api/diagnostics/body")
        after = client.get("/api/local-state").json()

        assert response.status_code == 200
        payload = response.json()
        assert payload["mode"] == "body-state"
        assert payload["readOnly"] is True
        assert payload["localOnly"] is True
        assert payload["rawPromptIncluded"] is False
        assert payload["rawMemoryIncluded"] is False
        assert payload["rawModelOutputIncluded"] is False
        assert payload["hiddenReasoningIncluded"] is False
        assert payload["secretValuesIncluded"] is False
        assert payload["externalProviderCallCount"] == 0
        assert payload["bodyState"]["activity"] == "idle"
        assert payload["bodyState"]["reason"] == "No active chat request."
        assert payload["model"]["expectedPath"] == "/live2d/rin/rin.model3.json"
        assert payload["model"]["status"] == "partial"
        assert payload["model"]["standardModelInstalled"] is False
        assert payload["model"]["cubismExportPresent"] is True
        assert payload["model"]["fallbackModeAvailable"] is True
        assert payload["model"]["externalDownloadRequired"] is False
        assert payload["autonomy"]["executesTools"] is False
        assert payload["autonomy"]["externalApiCalls"] is False
        assert payload["controls"]["backendMutationAvailable"] is False
        assert "sk-" not in response.text
        assert ".env" not in response.text

        assert snapshot.status_code == 200
        snapshot_payload = snapshot.json()
        assert snapshot_payload["body"]["mode"] == "body-state"
        assert snapshot_payload["body"]["rawPromptIncluded"] is False
        assert snapshot_payload["body"]["secretValuesIncluded"] is False
        assert any(
            block["id"] == "body-state"
            for block in snapshot_payload["dataMap"]["dataBlocks"]
        )

        assert diagnostics.status_code == 200
        diagnostic_payload = diagnostics.json()
        assert diagnostic_payload["mode"] == "diagnostics-body"
        assert diagnostic_payload["modelStatus"] == "partial"
        assert diagnostic_payload["cubismRuntimeActive"] is False
        assert diagnostic_payload["rawPromptIncluded"] is False
        assert diagnostic_payload["rawMemoryIncluded"] is False
        assert diagnostic_payload["secretValuesIncluded"] is False
        assert after["database"] == before["database"]
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_body_state_derives_error_from_safe_failed_trace(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("RIN_API_CHAT_BASE_URL", raising=False)
    monkeypatch.delenv("RIN_API_CHAT_KEY", raising=False)
    monkeypatch.delenv("RIN_API_CHAT_MODEL", raising=False)
    RUNTIME_TRACE_STORE.clear()
    temp = create_temp_data_dir()
    layout = create_temp_layout_database(temp.path)
    client = TestClient(create_app(layout))
    try:
        submitted = client.post(
            "/api/chat-test/send",
            json={"content": "body failure private prompt"},
        )
        response = client.get("/api/body/state")

        assert submitted.status_code == 200
        assert submitted.json()["status"] == "failed"
        assert response.status_code == 200
        payload = response.json()
        assert payload["bodyState"]["activity"] == "error"
        assert payload["bodyState"]["warningLevel"] == "error"
        assert payload["bodyState"]["source"] == "runtime_trace"
        assert payload["rawPromptIncluded"] is False
        assert "body failure private prompt" not in response.text
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_console_v2_route_assets_and_snapshot_are_safe() -> None:
    client, layout = create_client()
    try:
        old_redirect = client.get("/ui", follow_redirects=False)
        v2_redirect = client.get("/ui-v2", follow_redirects=False)
        old_console = client.get("/legacy-ui")
        page = client.get("/legacy-ui-v2")
        css = client.get("/static/console-v2.css")
        js = client.get("/static/console-v2.js")
        snapshot = client.get("/api/console-v2/snapshot")

        assert old_redirect.status_code == 307
        assert old_redirect.headers["location"] == "/glitch-core"
        assert v2_redirect.status_code == 307
        assert v2_redirect.headers["location"] == "/glitch-core"
        assert old_console.status_code == 200
        assert "RIN Control Console" in old_console.text
        assert page.status_code == 200
        assert "RIN Console V2" in page.text
        assert 'data-v2-tab="dashboard"' in page.text
        assert "v2-tab-button" in page.text
        assert "v2-page-grid" in page.text
        assert 'data-v2-page="data-flow"' in page.text
        assert "v2-avatar-panel" in page.text
        assert "console-v2.css" in page.text
        assert "console-v2.js" in page.text
        assert "/api/console-v2/snapshot" in page.text
        assert "/api/chat-test/send" in page.text
        assert css.status_code == 200
        assert "--v2-green: #00ff64" in css.text
        assert ".v2-glass-panel" in css.text
        assert ".v2-neon-border" in css.text
        assert ".v2-status-indicator" in css.text
        assert ".v2-tab-button" in css.text
        assert ".v2-page-grid" in css.text
        assert ".v2-avatar-panel" in css.text
        assert ".v2-metric-card" in css.text
        assert js.status_code == 200
        assert "refreshSnapshot" in js.text
        assert "submitChat" in js.text
        assert "document.write" not in js.text
        assert snapshot.status_code == 200
        payload = snapshot.json()
        assert payload["readOnly"] is True
        assert payload["fullTextIncluded"] is False
        assert payload["rawPromptIncluded"] is False
        assert payload["rawModelOutputIncluded"] is False
        assert payload["externalProviderCallCount"] == 0
        assert payload["dashboard"]["serverMode"] == "local-only"
        assert payload["storage"]["fullPathIncluded"] is False
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_glitch_core_snapshot_and_memory_api_are_safe_read_only() -> None:
    client, layout = create_client()
    try:
        submitted = client.post(
            "/api/chat-test/send",
            json={"content": "I prefer glitch core memory cards."},
        )
        state_after_submit = client.get("/api/local-state").json()
        snapshot = client.get("/api/glitch-core/snapshot")
        memories = client.get("/api/glitch-core/memories?query=memory")
        state_after_reads = client.get("/api/local-state").json()

        assert submitted.status_code == 200
        assert snapshot.status_code == 200
        payload = snapshot.json()
        assert payload["mode"] == "glitch-core-snapshot"
        assert payload["readOnly"] is True
        assert payload["localOnly"] is True
        assert payload["fullTextIncluded"] is False
        assert payload["rawPromptIncluded"] is False
        assert payload["rawModelOutputIncluded"] is False
        assert payload["hiddenReasoningIncluded"] is False
        assert payload["secretValuesIncluded"] is False
        assert payload["externalProviderCallCount"] == 0
        assert payload["messages"][-1]["content"] == "Python API mock reply."
        assert payload["memory"]["cards"]
        assert payload["memory"]["cards"][0]["readOnly"] is True
        assert payload["memory"]["cards"][0]["fullTextIncluded"] is False
        assert payload["mind"]["safeForUi"] is True
        assert payload["mind"]["rawTextIncluded"] is False
        assert payload["mind"]["secretValuesIncluded"] is False
        assert payload["mind"]["latest"]["messageUnderstanding"]["mode"] == (
            "preference_expression"
        )
        assert payload["mind"]["candidateCount"] == 1
        assert payload["mind"]["memoryCandidates"][0]["autoPromote"] is True
        assert payload["trace"]["latest"]["rawModelOutputIncluded"] is False
        assert payload["provider"]["safeConfig"]["apiKeyIncluded"] is False
        assert payload["provider"]["safeConfig"]["secretValuesIncluded"] is False
        assert state_after_reads["database"] == state_after_submit["database"]
        assert state_after_reads["externalProviderCallCount"] == 0

        assert memories.status_code == 200
        memory_payload = memories.json()
        assert memory_payload["readOnly"] is True
        assert memory_payload["fullTextIncluded"] is False
        assert memory_payload["cards"]
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_glitch_core_snapshot_redacts_legacy_hidden_reasoning_chat_message() -> None:
    client, layout = create_client()
    try:
        now = "2026-05-22T12:00:00Z"
        conversation = create_conversation(layout, "legacy reasoning", now)
        append_message(
            layout,
            conversation.id,
            "owner",
            "hello",
            now,
            message_id="owner-legacy-reasoning",
        )
        leaked_text = (
            "Okay, the user asked hello. I need to analyze the system and "
            "decide how to answer before writing the response."
        )
        append_message(
            layout,
            conversation.id,
            "rin",
            leaked_text,
            now,
            message_id="rin-legacy-reasoning",
            model_adapter="legacy",
        )

        response = client.get(
            f"/api/glitch-core/snapshot?conversationId={conversation.id}"
        )
        payload = response.json()
        rin_message = payload["messages"][-1]

        assert response.status_code == 200
        assert payload["hiddenReasoningIncluded"] is False
        assert leaked_text not in response.text
        assert "the user asked hello" not in response.text
        assert rin_message["content"] == (
            "[RIN reply hidden: unsafe reasoning-like content was redacted.]"
        )
        assert rin_message["fullTextIncluded"] is False
        assert rin_message["hiddenReasoningIncluded"] is False
        assert rin_message["hiddenReasoningRedacted"] is True
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_cost_api_responses_are_safe_after_mocked_external_turn() -> None:
    client, layout = create_client(adapter=ExternalUsageAdapter())
    try:
        submitted = client.post(
            "/api/chat-test/send",
            json={"content": "private cost prompt"},
        )
        summary = client.get("/api/cost/summary")
        recent = client.get("/api/cost/recent")
        snapshot = client.get("/api/glitch-core/snapshot")

        assert submitted.status_code == 200
        assert summary.status_code == 200
        assert recent.status_code == 200
        summary_payload = summary.json()
        recent_payload = recent.json()
        snapshot_payload = snapshot.json()
        assert summary_payload["eventCount"] == 1
        assert summary_payload["totalTokens"] == 15
        assert summary_payload["latest"]["estimateMethod"] == "provider_usage"
        assert summary_payload["pricingProfile"] == "deepseek-v4-flash"
        assert summary_payload["pricingUnit"] == "per_1m_tokens"
        assert summary_payload["currencyOfficial"] == "USD"
        assert summary_payload["cacheBreakdownAvailable"] is False
        assert summary_payload["officialBillingMatch"] == "estimate"
        assert "DeepSeek official billing may differ" in summary_payload["explanation"]
        assert summary_payload["latest"]["usageSource"] == "provider_usage"
        assert summary_payload["latest"]["officialBillingMatch"] == "estimate"
        assert recent_payload["records"][0]["totalTokens"] == 15
        assert recent_payload["records"][0]["pricingProfile"] == "deepseek-v4-flash"
        assert snapshot_payload["cost"]["eventCount"] == 1
        assert snapshot_payload["dataMap"]["mode"] == "console-data-map"
        for response in (summary, recent):
            assert "private cost prompt" not in response.text
            assert "External API mock reply." not in response.text
            assert "hidden reasoning" not in response.text.lower()
            assert "api-key" not in response.text.lower()
        cost_json = str(snapshot_payload["cost"])
        assert "private cost prompt" not in cost_json
        assert "External API mock reply." not in cost_json
        assert summary_payload["rawPromptIncluded"] is False
        assert summary_payload["rawResponseIncluded"] is False
        assert summary_payload["hiddenReasoningIncluded"] is False
        assert summary_payload["secretValuesIncluded"] is False
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_console_data_map_is_safe_and_covers_required_domains() -> None:
    client, layout = create_client()
    try:
        response = client.get("/api/console/data-map")

        assert response.status_code == 200
        payload = response.json()
        domain_ids = {item["id"] for item in payload["domains"]}
        block_ids = {item["id"] for item in payload["dataBlocks"]}
        assert payload["mode"] == "console-data-map"
        assert payload["readOnly"] is True
        assert payload["rawPromptIncluded"] is False
        assert payload["rawMemoryIncluded"] is False
        assert payload["hiddenReasoningIncluded"] is False
        assert payload["secretValuesIncluded"] is False
        assert {
            "core-health",
            "conversation",
            "mind",
            "memory",
            "context",
            "runtime-trace",
            "cost-usage",
            "provider",
            "growth-self-model",
            "control-tool-proposal",
            "database-storage",
            "profiles",
            "errors",
        }.issubset(domain_ids)
        assert {
            "cost-usage",
            "memory-candidates",
            "context-analytics",
            "tool-proposals",
        }.issubset(block_ids)
        assert "private prompt" not in response.text.lower()
        assert "api-key" not in response.text.lower()
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_growth_and_tool_review_actions_are_audited_and_non_executing() -> None:
    client, layout = create_client()
    now = "2026-06-14T00:00:00.000Z"
    try:
        create_rin_growth_events(
            layout,
            events=[
                RinGrowthEvent(
                    id="growth-test",
                    eventType="relationship_milestone",
                    summary="Safe growth summary.",
                    sourceTurnId="turn-1",
                    sourceMessageId="message-1",
                    candidate={"candidateId": "candidate-1"},
                    riskLevel="medium",
                    reviewStatus="review_required",
                    createdAt=now,
                    appliedAt=None,
                    active=True,
                    rawTextIncluded=False,
                )
            ],
            now=now,
        )
        create_tool_invocation_requests(
            layout,
            requests=[
                ToolInvocationRequest(
                    id="tool-test",
                    sourceTurnId="turn-1",
                    intent="safe intent",
                    toolName="future_manual_tool_proposal",
                    actionSummary="Safe proposed action.",
                    riskLevel="medium",
                    requiresOwnerApproval=True,
                    status="proposed",
                    createdAt=now,
                    rawInputIncluded=False,
                    secretValuesIncluded=False,
                )
            ],
            now=now,
        )

        growth = client.post("/api/mind/growth-events/growth-test/approve")
        tool = client.post("/api/mind/tool-requests/tool-test/reject")
        audit = list_audit_summaries(layout, limit=20)

        assert growth.status_code == 200
        assert growth.json()["autoApplied"] is False
        assert growth.json()["event"]["reviewStatus"] == "owner_approved"
        assert tool.status_code == 200
        assert tool.json()["executed"] is False
        assert tool.json()["executionDisabledByDefault"] is True
        assert tool.json()["request"]["status"] == "rejected"
        assert list_rin_growth_events(layout)[0].reviewStatus == "owner_approved"
        assert list_tool_invocation_requests(layout)[0].status == "rejected"
        event_types = {item.eventType for item in audit}
        assert "mind.rin_growth_event_reviewed" in event_types
        assert "mind.tool_invocation_request_reviewed" in event_types
        assert "Safe growth summary." not in str([item.model_dump() for item in audit])
        assert "Safe proposed action." not in str([item.model_dump() for item in audit])
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_glitch_core_entry_reports_frontend_build_state() -> None:
    client, layout = create_client()
    try:
        response = client.get("/glitch-core")
        body = client.get("/body")
        floating = client.get("/body/floating")

        assert response.status_code in {200, 503}
        assert "RIN Glitch Core Console" in response.text
        assert body.status_code in {200, 503}
        assert "RIN Glitch Core Console" in body.text
        assert floating.status_code in {200, 503}
        assert "RIN Glitch Core Console" in floating.text
        if response.status_code == 200:
            asset_paths = re.findall(
                r'(?:src|href)="([^"]*assets/[^"]+)"',
                response.text,
            )
            assert asset_paths
            for asset_path in asset_paths:
                asset = client.get(asset_path)
                assert asset.status_code == 200
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_python_ui_chat_submit_renders_conversation_history() -> None:
    client, layout = create_client()
    try:
        RUNTIME_TRACE_STORE.clear()
        response = client.post("/ui/chat", json={"content": "hello from UI"})
        state = client.get("/api/local-state").json()

        assert response.status_code == 200
        assert "Reply stored with turn" in response.text
        assert "hello from UI" in response.text
        assert "Python API mock reply." in response.text
        assert 'class="message-bubble owner"' in response.text
        assert 'class="message-bubble rin"' in response.text
        assert "Local conversation" in response.text
        assert "Latest Backend Turn Pipeline" in response.text
        assert "Runtime Dataflow Analyzer" in response.text
        assert "End-to-End Summary" in response.text
        assert "Sanitizer raw" in response.text
        assert 'data-console-tab="chat">Chat / Test' in response.text
        assert 'data-console-page="chat"' in response.text
        assert 'class="console-page active" data-console-page="chat"' in response.text
        assert (
            'class="console-page active" data-console-page="overview"'
            not in response.text
        )
        assert 'id="trace-window-layer"' in response.text
        assert 'id="trace-stage-window-template"' in response.text
        assert response.text.index('id="trace-window-layer"') > response.text.index(
            "</main>"
        )
        assert "Close all windows" in response.text
        assert "Reset windows" in response.text
        assert 'class="trace-window-close"' in response.text
        assert 'id="trace-stage-data"' in response.text
        assert "trace-stage-panel" not in response.text
        assert "trace-detail-v2" not in response.text
        assert 'data-stage-id="input_received"' in response.text
        assert 'class="composer-dock"' in response.text
        assert 'id="chat-status"' in response.text
        assert state["externalProviderCallCount"] == 0
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_chat_test_json_endpoint_updates_without_raw_thinking() -> None:
    client, layout = create_client()
    try:
        response = client.post(
            "/api/chat-test/send",
            json={"content": "json chat endpoint message"},
        )
        state = client.get("/api/local-state").json()

        assert response.status_code == 200
        payload = response.json()
        assert payload["ok"] is True
        assert payload["status"] == "completed"
        assert payload["conversationId"]
        assert payload["turnId"]
        assert payload["ownerMessage"]["content"] == "json chat endpoint message"
        assert payload["rinMessage"]["content"] == "Python API mock reply."
        assert payload["finalAnswer"] == "Python API mock reply."
        assert payload["rawThinkingStored"] is False
        assert payload["rawModelOutputIncluded"] is False
        assert payload["hiddenReasoningIncluded"] is False
        assert payload["externalProviderCallCount"] == 0
        assert state["externalProviderCallCount"] == 0
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_mind_api_exposes_safe_snapshot_and_review_actions() -> None:
    client, layout = create_client()
    try:
        response = client.post(
            "/api/chat-test/send",
            json={"content": "RIN 应该保持本地优先边界。"},
        )
        turn_id = response.json()["turnId"]

        latest = client.get("/api/mind/latest")
        by_turn = client.get(f"/api/mind/turn/{turn_id}")
        candidates = client.get("/api/mind/memory-candidates")
        missing = client.get("/api/mind/turn/missing-turn")

        assert response.status_code == 200
        assert latest.status_code == 200
        assert by_turn.status_code == 200
        assert candidates.status_code == 200
        assert missing.status_code == 404

        latest_payload = latest.json()
        by_turn_payload = by_turn.json()
        candidate_payload = candidates.json()
        candidate = candidate_payload["candidates"][0]

        assert latest_payload["safeForUi"] is True
        assert latest_payload["rawTextIncluded"] is False
        assert latest_payload["rawPromptIncluded"] is False
        assert latest_payload["secretValuesIncluded"] is False
        assert latest_payload["latest"]["messageUnderstanding"]["mode"] == (
            "rin_development"
        )
        assert latest_payload["latest"]["memoryCandidates"][0]["riskLevel"] == "high"
        assert by_turn_payload["snapshot"] == latest_payload["latest"]
        assert candidate["reviewStatus"] == "review_required"
        assert candidate["ownerConfirmed"] is False
        assert "RIN 应该保持本地优先边界" not in latest.text
        assert "RIN 应该保持本地优先边界" not in candidates.text

        approved = client.post(f"/api/mind/memory-candidates/{candidate['id']}/approve")
        deactivated = client.post(
            f"/api/mind/memory-candidates/{candidate['id']}/deactivate"
        )
        reactivated = client.post(
            f"/api/mind/memory-candidates/{candidate['id']}/reactivate"
        )
        rejected = client.post(f"/api/mind/memory-candidates/{candidate['id']}/reject")
        missing_action = client.post("/api/mind/memory-candidates/missing/reject")

        assert approved.status_code == 200
        assert approved.json()["readOnly"] is False
        assert approved.json()["candidate"]["reviewStatus"] == "owner_approved"
        assert approved.json()["candidate"]["active"] is True
        assert approved.json()["candidate"]["ownerConfirmed"] is True
        assert deactivated.status_code == 200
        assert deactivated.json()["candidate"]["reviewStatus"] == "inactive"
        assert deactivated.json()["candidate"]["active"] is False
        assert deactivated.json()["candidate"]["ownerConfirmed"] is False
        assert reactivated.status_code == 200
        assert reactivated.json()["candidate"]["reviewStatus"] == "candidate"
        assert reactivated.json()["candidate"]["active"] is True
        assert reactivated.json()["candidate"]["ownerConfirmed"] is False
        assert rejected.status_code == 200
        assert rejected.json()["candidate"]["reviewStatus"] == "rejected"
        assert rejected.json()["candidate"]["active"] is False
        assert rejected.json()["secretValuesIncluded"] is False
        assert missing_action.status_code == 404
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_mind_analytics_endpoints_return_safe_derived_payloads() -> None:
    client, layout = create_client()
    try:
        response = client.post(
            "/api/chat-test/send",
            json={"content": "I prefer concise RIN progress reports."},
        )
        assert response.status_code == 200

        candidates = client.get("/api/mind/memory-candidates").json()["candidates"]
        candidate_id = candidates[0]["id"]
        analytics = client.get("/api/mind/analytics")
        memory = client.get("/api/mind/memory-analytics")
        candidate = client.get(f"/api/mind/memory-candidates/{candidate_id}/analytics")
        context = client.get("/api/mind/context-analytics")
        owner_trend = client.get("/api/mind/owner-state-trend")
        trace = client.get("/api/mind/trace-analytics")

        assert analytics.status_code == 200
        assert memory.status_code == 200
        assert candidate.status_code == 200
        assert context.status_code == 200
        assert owner_trend.status_code == 200
        assert trace.status_code == 200

        analytics_payload = analytics.json()
        memory_payload = memory.json()
        candidate_payload = candidate.json()["candidate"]
        context_payload = context.json()
        trace_payload = trace.json()

        for payload in (
            analytics_payload,
            memory_payload,
            candidate.json(),
            context_payload,
            owner_trend.json(),
            trace_payload,
        ):
            assert payload["rawTextIncluded"] is False
            assert payload["secretValuesIncluded"] is False
            assert "I prefer concise RIN progress reports." not in str(payload)

        assert analytics_payload["memory"]["rawMemoryIncluded"] is False
        assert memory_payload["thresholds"] == {"weakening": 0.42, "forgetting": 0.22}
        assert candidate_payload["rawTextIncluded"] is False
        assert candidate_payload["secretValuesIncluded"] is False
        assert candidate_payload["predictedDecayPoints"]
        assert candidate_payload["thresholds"]["weakening"] == 0.42
        assert context_payload["rawPromptIncluded"] is False
        assert (
            context_payload["providerRequestOutline"]["currentOwnerInputLast"] is True
        )
        assert trace_payload["latest"]["rawPromptIncluded"] is False
        assert trace_payload["latest"]["hiddenReasoningIncluded"] is False
        assert owner_trend.json()["points"]
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_cognition_flow_config_registry_and_self_review_are_safe() -> None:
    client, layout = create_client()
    try:
        owner_text = "I prefer concise RIN progress reports."
        response = client.post("/api/chat-test/send", json={"content": owner_text})
        turn_id = response.json()["turnId"]

        latest_flow = client.get("/api/mind/cognition-flow/latest")
        turn_flow = client.get(f"/api/mind/cognition-flow/{turn_id}")
        missing_flow = client.get("/api/mind/cognition-flow/missing-turn")
        config = client.get("/api/config/registry")
        self_review = client.post("/api/self-review/run")
        proposals = client.get("/api/improvement-proposals")

        assert response.status_code == 200
        assert latest_flow.status_code == 200
        assert turn_flow.status_code == 200
        assert missing_flow.status_code == 404
        assert config.status_code == 200
        assert self_review.status_code == 200
        assert proposals.status_code == 200

        flow_payload = latest_flow.json()
        config_payload = config.json()
        review_payload = self_review.json()
        proposals_payload = proposals.json()

        assert flow_payload["mode"] == "rin-cognition-flow"
        assert flow_payload["rawPromptIncluded"] is False
        assert flow_payload["rawMemoryIncluded"] is False
        assert flow_payload["rawModelOutputIncluded"] is False
        assert flow_payload["hiddenReasoningIncluded"] is False
        assert flow_payload["secretValuesIncluded"] is False
        assert (
            flow_payload["ownerInput"]["latestOwnerInputPreservedAsFinalOwnerMessage"]
            is True
        )
        assert [step["id"] for step in flow_payload["steps"]] == [
            "owner_input",
            "message_understanding",
            "owner_state",
            "memory_retrieval",
            "context_plan",
            "model_request",
            "provider_response",
            "sanitizer",
            "final_answer",
            "turn_impact",
        ]
        assert all(step["rawPromptIncluded"] is False for step in flow_payload["steps"])
        assert owner_text not in latest_flow.text
        assert owner_text not in turn_flow.text

        assert config_payload["mode"] == "config-registry"
        assert config_payload["readOnly"] is True
        assert {section["label"] for section in config_payload["sections"]} >= {
            "UI Display Config",
            "Runtime Config",
            "Provider Config",
            "Cost Config",
            "Mind Policy Config",
            "Memory Policy Config",
            "Profile Config",
            "RIN Identity / Self-model Config",
            "Dangerous Capability Config",
        }
        provider_key = next(
            item for item in config_payload["items"] if item["key"] == "provider.apiKey"
        )
        dangerous = [
            item
            for item in config_payload["items"]
            if item["key"].startswith("dangerous.")
        ]
        assert provider_key["currentValue"] in {"present", "missing"}
        assert provider_key["secretValueIncluded"] is False
        assert "sk-" not in config.text
        assert dangerous
        assert all(item["editable"] is False for item in dangerous)
        assert all(item["currentValue"] is False for item in dangerous)

        assert review_payload["manualOnly"] is True
        assert review_payload["allowedLevel"] == 3
        assert review_payload["level4PlusLocked"] is True
        assert proposals_payload["executionEnabled"] is False
        assert proposals_payload["autoPrEnabled"] is False
        assert proposals_payload["autoCodeWriteEnabled"] is False
        assert proposals_payload["proposals"]
        proposal_id = proposals_payload["proposals"][0]["id"]

        approved = client.post(f"/api/improvement-proposals/{proposal_id}/approve")
        converted = client.post(
            f"/api/improvement-proposals/{proposal_id}/convert-to-codex-draft"
        )
        missing_action = client.post("/api/improvement-proposals/missing/approve")

        assert approved.status_code == 200
        assert approved.json()["proposal"]["status"] == "approved"
        assert approved.json()["executed"] is False
        assert approved.json()["codeWritten"] is False
        assert converted.status_code == 200
        converted_payload = converted.json()
        assert converted_payload["proposal"]["status"] == "converted_to_codex_task"
        assert converted_payload["proposal"]["codexPromptDraft"]
        assert converted_payload["pullRequestCreated"] is False
        assert converted_payload["codeWritten"] is False
        assert missing_action.status_code == 404
        assert owner_text not in self_review.text
        assert owner_text not in proposals.text
        assert owner_text not in converted.text
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_memory_candidate_safe_patch_edits_safe_fields_and_audits() -> None:
    client, layout = create_client()
    try:
        response = client.post(
            "/api/chat-test/send",
            json={"content": "I prefer concise RIN progress reports."},
        )
        assert response.status_code == 200
        candidate_id = client.get("/api/mind/memory-candidates").json()["candidates"][
            0
        ]["id"]

        patched = client.patch(
            f"/api/mind/memory-candidates/{candidate_id}",
            json={
                "safeSummary": "Owner prefers concise progress reports.",
                "normalizedValue": "concise progress reports",
                "tags": ["preference", "progress"],
            },
        )
        secret_like = client.patch(
            f"/api/mind/memory-candidates/{candidate_id}",
            json={"safeSummary": "api key sk-testsecret123456789"},
        )

        assert patched.status_code == 200
        payload = patched.json()
        assert payload["candidate"]["safeSummary"] == (
            "Owner prefers concise progress reports."
        )
        assert payload["candidate"]["normalizedValue"] == "concise progress reports"
        assert payload["candidate"]["tags"] == ["preference", "progress"]
        assert payload["rawTextIncluded"] is False
        assert payload["secretValuesIncluded"] is False
        assert secret_like.status_code == 400
        audits = list_audit_summaries(layout)
        assert audits[0].eventType == "mind.memory_candidate_safe_fields_edited"
        assert "safeSummaryHash" in audits[0].payloadKeys
        assert (
            "Owner prefers concise progress reports." not in audits[0].model_dump_json()
        )
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_mind_api_and_snapshot_redact_secret_like_owner_input() -> None:
    client, layout = create_client()
    try:
        secret_text = "记住我的 api key sk-testsecret123456789"
        response = client.post("/api/chat-test/send", json={"content": secret_text})
        turn_id = response.json()["turnId"]

        latest = client.get("/api/mind/latest")
        by_turn = client.get(f"/api/mind/turn/{turn_id}")
        candidates = client.get("/api/mind/memory-candidates")
        glitch = client.get("/api/glitch-core/snapshot")

        assert response.status_code == 200
        assert latest.status_code == 200
        assert by_turn.status_code == 200
        assert candidates.status_code == 200
        assert glitch.status_code == 200

        surfaces = {
            "latest": latest.text,
            "turn": by_turn.text,
            "candidates": candidates.text,
            "glitch_mind": str(glitch.json()["mind"]),
        }
        for payload_text in surfaces.values():
            assert secret_text not in payload_text
            assert "sk-testsecret" not in payload_text
            assert "rawPromptIncluded': True" not in payload_text
            assert "hiddenReasoningIncluded': True" not in payload_text

        latest_payload = latest.json()
        candidate_payload = candidates.json()["candidates"][0]

        assert latest_payload["rawTextIncluded"] is False
        assert latest_payload["rawPromptIncluded"] is False
        assert latest_payload["hiddenReasoningIncluded"] is False
        assert latest_payload["secretValuesIncluded"] is False
        assert latest_payload["latest"]["secretValuesIncluded"] is False
        assert latest_payload["latest"]["memoryCandidates"][0]["redacted"] is True
        assert (
            latest_payload["latest"]["memoryCandidates"][0]["rawTextIncluded"] is False
        )
        assert candidate_payload["reviewStatus"] == "rejected"
        assert candidate_payload["riskLevel"] == "blocked"
        assert candidate_payload["active"] is False
        assert candidate_payload["redacted"] is True
        assert candidate_payload["safeSummary"] == (
            "Blocked secret-like content was detected and redacted."
        )
        assert candidate_payload["normalizedValue"] is None
        assert glitch.json()["mind"]["rawTextIncluded"] is False
        assert glitch.json()["mind"]["rawPromptIncluded"] is False
        assert glitch.json()["mind"]["hiddenReasoningIncluded"] is False
        assert glitch.json()["mind"]["secretValuesIncluded"] is False

        blocked_edit = client.patch(
            f"/api/mind/memory-candidates/{candidate_payload['id']}",
            json={"safeSummary": "safe display text"},
        )
        assert blocked_edit.status_code == 409
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_default_chat_provider_missing_key_fails_safely(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("RIN_API_CHAT_BASE_URL", raising=False)
    monkeypatch.delenv("RIN_API_CHAT_KEY", raising=False)
    monkeypatch.delenv("RIN_API_CHAT_MODEL", raising=False)
    RUNTIME_TRACE_STORE.clear()
    temp = create_temp_data_dir()
    layout = create_temp_layout_database(temp.path)
    client = TestClient(create_app(layout))
    try:
        response = client.post(
            "/api/chat-test/send",
            json={"content": "should fail safely"},
        )
        messages = client.get(f"/api/conversations/{response.json()['conversationId']}")

        assert response.status_code == 200
        payload = response.json()
        assert payload["ok"] is False
        assert payload["status"] == "failed"
        assert payload["errorCode"] == "API_PROVIDER_UNCONFIGURED"
        assert payload["rinMessage"] is None
        assert payload["rawModelOutputIncluded"] is False
        assert payload["hiddenReasoningIncluded"] is False
        assert messages.status_code == 200
        assert [item["role"] for item in messages.json()["messages"]] == ["owner"]
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_chat_test_endpoint_rejects_missing_conversation_without_writes() -> None:
    client, layout = create_client()
    try:
        response = client.post(
            "/api/chat-test/send",
            json={
                "content": "should not create orphan message",
                "conversationId": "missing-conversation",
            },
        )
        state = client.get("/api/local-state").json()

        assert response.status_code == 404
        assert response.json()["detail"]["code"] == "CONVERSATION_NOT_FOUND"
        assert state["database"]["conversations"] == 0
        assert state["database"]["messages"] == 0
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_empty_chat_requests_do_not_create_conversations() -> None:
    client, layout = create_client()
    try:
        conversations_response = client.post(
            "/api/conversations",
            json={"content": "   "},
        )
        chat_test_response = client.post(
            "/api/chat-test/send",
            json={"content": "\n\t"},
        )
        state = client.get("/api/local-state").json()

        assert conversations_response.status_code == 400
        assert chat_test_response.status_code == 400
        assert state["database"]["conversations"] == 0
        assert state["database"]["messages"] == 0
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_console_tab_buttons_are_explicit_button_type() -> None:
    client, layout = create_client()
    try:
        response = client.get("/legacy-ui")

        assert response.status_code == 200
        tab_buttons = re.findall(
            r"<button[^>]+data-console-tab=\"[^\"]+\"[^>]*>",
            response.text,
        )
        assert len(tab_buttons) == 12
        assert all('type="button"' in item for item in tab_buttons)
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_python_ui_reload_preserves_history_without_new_write() -> None:
    client, layout = create_client()
    try:
        submitted = client.post("/ui/chat", json={"content": "reload-safe message"})
        state_after_submit = client.get("/api/local-state").json()
        reloaded = client.get("/legacy-ui")
        state_after_reload = client.get("/api/local-state").json()

        assert submitted.status_code == 200
        assert reloaded.status_code == 200
        assert "reload-safe message" in reloaded.text
        assert "Python API mock reply." in reloaded.text
        assert 'name="conversationId"' in reloaded.text
        assert state_after_reload["database"] == state_after_submit["database"]
        assert state_after_reload["externalProviderCallCount"] == 0
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_python_ui_renders_api_provider_status() -> None:
    client, layout = create_client()
    try:
        response = client.get("/legacy-ui")

        assert response.status_code == 200
        assert "rin-mock-test" in response.text
        assert "API model" in response.text
        assert "deepseek-v4-flash" in response.text
        assert "not active" in response.text
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_python_ui_error_rendering_is_visible() -> None:
    client, layout = create_client(adapter=FailingAdapter())
    try:
        response = client.post("/ui/chat", json={"content": "fail visibly"})

        assert response.status_code == 200
        assert "Structured error" in response.text
        assert "error-box" in response.text
        assert "test adapter failure" in response.text
        assert "RIN Control Console" in response.text
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_python_ui_new_chat_view_does_not_create_writes() -> None:
    client, layout = create_client()
    try:
        submitted = client.post("/ui/chat", json={"content": "existing chat"})
        state_after_submit = client.get("/api/local-state").json()
        response = client.get("/legacy-ui?new=1")
        state_after_new_view = client.get("/api/local-state").json()

        assert submitted.status_code == 200
        assert response.status_code == 200
        assert "Start a local conversation." in response.text
        assert 'value=""' in response.text
        assert state_after_new_view["database"] == state_after_submit["database"]
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_status_dashboard_endpoint_is_read_only_counts_only() -> None:
    client, layout = create_client()
    try:
        submitted = client.post("/ui/chat", json={"content": "dashboard check"})
        state_after_submit = client.get("/api/local-state").json()
        response = client.get("/api/status-dashboard")
        state_after_dashboard = client.get("/api/local-state").json()

        assert submitted.status_code == 200
        assert response.status_code == 200
        payload = response.json()
        assert payload["readiness"]["label"] == "ok"
        assert payload["adapter"] == "rin-mock-test"
        assert payload["externalProviderCallCount"] == 0
        assert payload["database"]["schemaVersion"] == 6
        assert payload["activeConversation"]["messageCount"] == 2
        assert payload["activeConversation"]["ownerMessages"] == 1
        assert payload["activeConversation"]["rinMessages"] == 1
        assert "dashboard check" not in response.text
        assert "Python API mock reply." not in response.text
        assert state_after_dashboard["database"] == state_after_submit["database"]
        assert state_after_dashboard["externalProviderCallCount"] == 0
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_diagnostics_endpoints_are_safe_and_read_only() -> None:
    client, layout = create_client()
    try:
        RUNTIME_TRACE_STORE.clear()
        private_submitted = client.post(
            "/ui/chat",
            json={"content": "private diagnostic endpoint check"},
        )
        submitted = client.post(
            "/ui/chat",
            json={"content": "I prefer concise diagnostic endpoint checks."},
        )
        state_after_submit = client.get("/api/local-state").json()
        endpoints = [
            "/api/diagnostics/overview",
            "/api/diagnostics/model",
            "/api/diagnostics/memory",
            "/api/diagnostics/context",
            "/api/diagnostics/database",
            "/api/diagnostics/profiles",
            "/api/diagnostics/body",
            "/api/diagnostics/events",
        ]

        assert private_submitted.status_code == 200
        assert submitted.status_code == 200
        for endpoint in endpoints:
            response = client.get(endpoint)
            state_after_endpoint = client.get("/api/local-state").json()

            assert response.status_code == 200
            payload = response.json()
            assert payload["readOnly"] is True
            assert payload["externalProviderCallCount"] == 0
            assert "private diagnostic endpoint check" not in response.text
            assert "Python API mock reply." not in response.text
            assert state_after_endpoint["database"] == state_after_submit["database"]
            assert state_after_endpoint["externalProviderCallCount"] == 0

        model = client.get("/api/diagnostics/model").json()
        memory = client.get("/api/diagnostics/memory").json()
        context = client.get("/api/diagnostics/context").json()
        profiles = client.get("/api/diagnostics/profiles").json()
        body = client.get("/api/diagnostics/body").json()

        assert model["providerCallsMade"] == 0
        assert memory["fullTextIncluded"] is False
        assert memory["algorithm"]["fullTextIncluded"] is False
        assert memory["algorithm"]["shortTermWindowPolicy"] == (
            "mind-selected prior messages in active conversation, max 8"
        )
        assert memory["state"]["retrievalWiredIntoPrompt"] is True
        assert memory["health"]["retrievalStatus"] == "active"
        assert memory["algorithm"]["memoryV2WritePolicy"]
        assert memory["aiMemoryState"]["shortTermContextActive"] is True
        assert memory["aiMemoryState"]["longTermRetrievalActive"] is True
        assert memory["curve"]["samplePoints"]
        assert memory["curve"]["status"] == "not parameterized yet"
        assert memory["contents"]
        assert memory["contents"][0]["rawTextIncluded"] is False
        assert "private diagnostic endpoint check" not in str(memory["contents"])
        assert context["fullPromptIncluded"] is False
        assert profiles["fullTextIncluded"] is False
        assert body["cubismRuntimeActive"] is False
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_memory_page_renders_useful_safe_console_sections() -> None:
    client, layout = create_client()
    try:
        response = client.post("/ui/chat", json={"content": "memory page private text"})

        assert response.status_code == 200
        assert "Memory Algorithm" in response.text
        assert "AI Memory State" in response.text
        assert "Retrieval Status" in response.text
        assert "Memory Curve" in response.text
        assert "Safe Memory Trace Index" in response.text
        assert "Short-term active" in response.text
        assert "Memory used last request" in response.text
        assert "Last Turn Memory Update" in response.text
        assert "Gaps / Warnings" in response.text
        assert "No approved memory sources available for retrieval." in response.text
        assert "memory page private text" in response.text

        memory = client.get("/api/diagnostics/memory")
        assert memory.status_code == 200
        payload = memory.json()
        assert payload["readOnly"] is True
        assert payload["localOnly"] is True
        assert payload["fullTextIncluded"] is False
        assert "memory page private text" not in memory.text
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_runtime_trace_api_is_safe_and_read_only() -> None:
    client, layout = create_client()
    try:
        RUNTIME_TRACE_STORE.clear()
        private_owner_text = (
            "private runtime trace owner message that must not be exposed in full"
        )
        submitted = client.post("/ui/chat", json={"content": private_owner_text})
        state_after_submit = client.get("/api/local-state").json()

        latest = client.get("/api/diagnostics/runtime-trace/latest")
        listing = client.get("/api/diagnostics/runtime-trace")
        state_after_trace = client.get("/api/local-state").json()

        assert submitted.status_code == 200
        assert latest.status_code == 200
        assert listing.status_code == 200
        latest_payload = latest.json()
        trace = latest_payload["traces"][0]
        assert latest_payload["privacyMode"] == "safe"
        assert latest_payload["readOnly"] is True
        assert latest_payload["externalProviderCallCount"] == 0
        assert latest_payload["fullTextIncluded"] is False
        assert latest_payload["rawPromptIncluded"] is False
        assert latest_payload["rawModelOutputIncluded"] is False
        assert trace["status"] == "success"
        assert trace["analysis"]["memorySkipReason"] == "no_memory_sources"
        assert [stage["name"] for stage in trace["stages"]] == (
            EXPECTED_RUNTIME_TRACE_STAGE_NAMES
        )
        for stage in trace["stages"]:
            assert "input" in stage
            assert "operation" in stage
            assert "output" in stage
            assert "decision" in stage
            assert "privacy" in stage
            assert "durationMs" in stage

        recent = next(
            stage
            for stage in trace["stages"]
            if stage["name"] == "recent_history_selection"
        )
        memory = next(
            stage for stage in trace["stages"] if stage["name"] == "memory_v2_retrieval"
        )
        context = next(
            stage for stage in trace["stages"] if stage["name"] == "context_assembly"
        )
        request = next(
            stage for stage in trace["stages"] if stage["name"] == "model_request"
        )
        raw = next(
            stage for stage in trace["stages"] if stage["name"] == "raw_model_response"
        )
        sanitizer = next(
            stage
            for stage in trace["stages"]
            if stage["name"] == "sanitization_final_answer"
        )
        reply = next(
            stage for stage in trace["stages"] if stage["name"] == "rin_reply_persisted"
        )
        memory_update = next(
            stage for stage in trace["stages"] if stage["name"] == "memory_update"
        )

        assert recent["output"]["selectedPriorMessages"] == 0
        assert memory["status"] == "skipped"
        assert memory["decision"]["skipReason"] == "no_memory_sources"
        assert context["output"]["componentTable"]
        assert request["output"]["requestOutline"]
        assert raw["output"]["providerRawMetadataAvailable"] is False
        assert raw["output"]["rawContentLength"] == "n/a"
        assert raw["output"]["adapterContentLength"] == len("Python API mock reply.")
        assert sanitizer["output"]["rawLength"] == len("Python API mock reply.")
        assert sanitizer["output"]["finalLength"] == len("Python API mock reply.")
        assert request["output"]["currentOwnerInputLast"] is True
        assert reply["output"]["storedSanitizedAnswer"] is True
        assert reply["output"]["storedRawThinking"] is False
        assert memory_update["output"]["tracesCreatedCount"] == 0
        assert memory_update["decision"]["skipReason"] == (
            "no_auto_promoted_memory_candidate"
        )
        assert "private runtime trace owner message" not in latest.text
        assert "private runtime tr..." in latest.text
        assert "Python API mock reply." not in latest.text
        assert state_after_trace["database"] == state_after_submit["database"]
        assert state_after_trace["externalProviderCallCount"] == 0

        by_id = client.get(f"/api/diagnostics/runtime-trace/{trace['turnId']}")
        assert by_id.status_code == 200
        assert by_id.json()["trace"]["turnId"] == trace["turnId"]
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_typescript_frontend_artifacts_stay_in_frontend_only() -> None:
    root = Path(__file__).resolve().parents[3]
    patterns = [
        "*.ts",
        "*.tsx",
        "package.json",
        "package-lock.json",
        "tsconfig*.json",
        "vite.config.*",
        "eslint.config.*",
    ]
    residue: list[Path] = []
    for pattern in patterns:
        residue.extend(root.glob(f"**/{pattern}"))

    filtered = [
        path
        for path in residue
        if "dist" not in path.parts
        and "node_modules" not in path.parts
        and ".venv" not in path.parts
        and "frontend" not in path.parts
    ]

    assert filtered == []
    assert (root / "frontend" / "package.json").exists()
    assert (root / "frontend" / "vite.config.ts").exists()


def test_default_launcher_is_api_provider_and_browser_open() -> None:
    root = Path(__file__).resolve().parents[3]
    launcher = root / "Start_RIN.command"

    launcher_text = launcher.read_text(encoding="utf-8")

    assert launcher.exists()
    assert not (root / "Start_RIN_Python_Local_Model.command").exists()
    assert not (root / "Start_RIN_Python.command").exists()
    assert not (root / "打开RIN项目.command").exists()
    assert sorted(path.name for path in root.glob("*.command")) == ["Start_RIN.command"]
    assert 'CHAT_PROVIDER="${RIN_CHAT_PROVIDER:-openai-compatible}"' in launcher_text
    assert 'API_CHAT_MODEL="${RIN_API_CHAT_MODEL:-deepseek-v4-flash}"' in launcher_text
    assert "RIN_API_CHAT_KEY" in launcher_text
    assert "RIN_API_CHAT_BASE_URL" in launcher_text
    assert "RIN_OLLAMA" not in launcher_text
    assert "rin-ollama-local" not in launcher_text
    assert 'LOCAL_URL="http://${LOCAL_HOST}:${LOCAL_PORT}"' in launcher_text
    assert "RIN_STARTUP_UI_PATH" in launcher_text
    assert 'open "$UI_URL"' in launcher_text
    assert 'MAX_WAIT="${RIN_STARTUP_TIMEOUT_SEC:-60}"' in launcher_text
