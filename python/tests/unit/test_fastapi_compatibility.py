import re
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rin.contracts import ModelRequest, ModelResponse, ModelResponseMetadata
from rin.conversation import ModelAdapterProtocol
from rin.database import create_temp_layout_database
from rin.diagnostics.runtime_trace import RUNTIME_TRACE_STORE
from rin.diagnostics.safety import create_temp_data_dir
from rin.server import create_app
from rin.storage import RinDataLayout, create_data_layout


def create_client(
    adapter: ModelAdapterProtocol | None = None,
) -> tuple[TestClient, RinDataLayout]:
    RUNTIME_TRACE_STORE.clear()
    temp = create_temp_data_dir()
    layout = create_temp_layout_database(temp.path)
    return TestClient(create_app(layout, adapter=adapter)), layout


class FailingAdapter:
    id = "failing-test-adapter"

    async def generate(self, request: ModelRequest) -> ModelResponse:
        raise RuntimeError("test adapter failure")


class LocalModelAdapter:
    id = "rin-ollama-local"

    async def generate(self, request: ModelRequest) -> ModelResponse:
        return ModelResponse(
            content="Python local model test reply.",
            adapterId=self.id,
            metadata=ModelResponseMetadata(
                externalProvider=False,
                memoryWriteRequested=False,
                toolCallRequested=False,
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
        response = client.get("/")

        assert response.status_code == 200
        assert "RIN Control Console" in response.text
        assert "Observe, test, and understand RIN." in response.text
        assert 'class="control-console-shell"' in response.text
        assert 'class="console-topbar"' in response.text
        assert 'class="console-nav glass-panel"' in response.text
        assert 'data-console-tab="overview"' in response.text
        assert 'data-console-tab="chat"' in response.text
        assert 'data-console-tab="runtime-trace"' in response.text
        assert 'data-console-tab="model"' in response.text
        assert 'data-console-tab="memory"' in response.text
        assert 'data-console-tab="context"' in response.text
        assert 'data-console-tab="database"' in response.text
        assert 'data-console-tab="conversations"' in response.text
        assert 'data-console-tab="profiles"' in response.text
        assert 'data-console-tab="body"' in response.text
        assert 'data-console-tab="events"' in response.text
        assert 'data-console-tab="developer"' in response.text
        assert 'data-console-page="overview"' in response.text
        assert 'data-console-page="chat"' in response.text
        assert 'data-console-page="runtime-trace"' in response.text
        assert "Runtime Dataflow Analyzer" in response.text
        assert "Manual Runtime Test Chat" in response.text
        assert 'class="rin-character"' in response.text
        assert 'class="presence-panel glass-panel"' in response.text
        assert 'class="composer-dock"' in response.text
        assert 'class="trace-ring"' in response.text
        assert 'class="metric-card balance-card"' in response.text
        assert 'class="health-grid"' in response.text
        assert "/api/status-dashboard" in response.text
        assert "console.css" in response.text
        assert "console.js" in response.text
        assert "Python-primary local RIN runtime." in response.text
        assert "rin-mock-local" in response.text
        assert "Memory V2" in response.text
        assert "PROFILE" in response.text
        assert "Profile files" in response.text
        assert "Trace full text" in response.text
        assert "Body" in response.text
        assert "RIN PRESENCE" in response.text
        assert "/live2d/rin/rin-front-fullbody.png" in response.text
        assert "STATIC BODY / LIVE2D FUTURE" in response.text
        assert "external" in response.text
        assert "0" in response.text
        assert "Start a local conversation." in response.text
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


def test_console_tab_buttons_are_explicit_button_type() -> None:
    client, layout = create_client()
    try:
        response = client.get("/")

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
        reloaded = client.get("/ui")
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


def test_python_ui_renders_local_model_status() -> None:
    client, layout = create_client(adapter=LocalModelAdapter())
    try:
        response = client.get("/")

        assert response.status_code == 200
        assert "rin-ollama-local" in response.text
        assert "local model" in response.text
        assert "qwen3:4b" in response.text
        assert "selected" in response.text
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
        response = client.get("/ui?new=1")
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
        assert payload["adapter"] == "rin-mock-local"
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
        submitted = client.post(
            "/ui/chat",
            json={"content": "private diagnostic endpoint check"},
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
        assert "No Memory V2 traces available for retrieval." in response.text
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
        assert trace["analysis"]["memorySkipReason"] == "no_memory_v2_traces"
        assert [stage["name"] for stage in trace["stages"]] == [
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
        assert memory["decision"]["skipReason"] == "no_memory_v2_traces"
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
        assert memory_update["output"]["tracesCreatedCount"] == 1
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


def test_no_typescript_or_node_artifacts_reintroduced() -> None:
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
    ]

    assert filtered == []


def test_default_launcher_is_local_model_and_browser_open() -> None:
    root = Path(__file__).resolve().parents[3]
    launcher = root / "Start_RIN.command"

    launcher_text = launcher.read_text(encoding="utf-8")

    assert launcher.exists()
    assert not (root / "Start_RIN_Python_Local_Model.command").exists()
    assert not (root / "Start_RIN_Python.command").exists()
    assert not (root / "打开RIN项目.command").exists()
    assert sorted(path.name for path in root.glob("*.command")) == ["Start_RIN.command"]
    assert 'MODEL_ADAPTER="${RIN_MODEL_ADAPTER:-rin-ollama-local}"' in launcher_text
    assert "http://127.0.0.1:11434" in launcher_text
    assert "qwen3:4b" in launcher_text
    assert 'RIN_OLLAMA_MODEL="$OLLAMA_MODEL"' in launcher_text
    assert "RIN_OLLAMA_TIMEOUT_MS" in launcher_text
    assert "RIN_OLLAMA_NUM_PREDICT" in launcher_text
    assert 'LOCAL_URL="http://127.0.0.1:8765"' in launcher_text
    assert 'open "$LOCAL_URL"' in launcher_text
    assert 'MAX_WAIT="${RIN_STARTUP_TIMEOUT_SEC:-60}"' in launcher_text
