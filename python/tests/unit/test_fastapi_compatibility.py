import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rin.contracts import ModelRequest, ModelResponse, ModelResponseMetadata
from rin.conversation import ModelAdapterProtocol
from rin.database import create_temp_layout_database
from rin.diagnostics.safety import create_temp_data_dir
from rin.server import create_app
from rin.storage import RinDataLayout, create_data_layout


def create_client(
    adapter: ModelAdapterProtocol | None = None,
) -> tuple[TestClient, RinDataLayout]:
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
        assert trace.json()["memoryV2Traces"] == 1
        assert trace.json()["fullTextIncluded"] is False
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_write_routes_reject_unmarked_production_data_path(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import rin.diagnostics.safety as safety

    production = tmp_path / ".rin-data"
    monkeypatch.setattr(safety, "PRODUCTION_RIN_DATA_DIR", production)
    layout = create_data_layout(str(production), cwd="/")
    client = TestClient(create_app(layout))

    response = client.post("/conversations", json={"title": "blocked"})

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "UNSAFE_DATA_PATH"


def test_python_ui_renders_local_status_and_profile_summary() -> None:
    client, layout = create_client()
    try:
        response = client.get("/")

        assert response.status_code == 200
        assert "minimal AI OS" in response.text
        assert 'class="ai-os-shell"' in response.text
        assert 'class="system-bar"' in response.text
        assert 'class="os-grid"' in response.text
        assert 'class="conversation-rail"' in response.text
        assert 'class="chat-plane"' in response.text
        assert 'class="composer-dock"' in response.text
        assert 'class="status-dashboard"' in response.text
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
        assert "RIN ONLINE" in response.text
        assert "/live2d/rin/rin-bust-front.png" in response.text
        assert "static presence / future Live2D" in response.text
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

        assert css.status_code == 200
        assert "ai-os-shell" in css.text
        assert "os-grid" in css.text
        assert "conversation-rail" in css.text
        assert "chat-plane" in css.text
        assert "composer-dock" in css.text
        assert "status-dashboard" in css.text
        assert "trace-ring" in css.text
        assert "health-grid" in css.text
        assert "avatar-stage" in css.text
        assert "ambient-grid" in css.text
        assert "RIN console submit failed" in js.text
        assert "requestSubmit" in js.text
        assert "refreshDashboard" in js.text
        assert "/api/status-dashboard" not in js.text
        assert avatar.status_code == 200
        assert avatar.headers["content-type"] == "image/png"
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_python_ui_chat_submit_renders_conversation_history() -> None:
    client, layout = create_client()
    try:
        response = client.post("/ui/chat", json={"content": "hello from UI"})
        state = client.get("/api/local-state").json()

        assert response.status_code == 200
        assert "Reply stored with turn" in response.text
        assert "hello from UI" in response.text
        assert "Python API mock reply." in response.text
        assert 'class="message-bubble owner"' in response.text
        assert 'class="message-bubble rin"' in response.text
        assert "Local conversation" in response.text
        assert 'class="composer-dock"' in response.text
        assert state["externalProviderCallCount"] == 0
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
        assert "minimal AI OS" in response.text
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
    assert 'RIN_MODEL_ADAPTER="rin-ollama-local"' in launcher_text
    assert "http://127.0.0.1:11434" in launcher_text
    assert "qwen3:4b" in launcher_text
    assert 'RIN_OLLAMA_MODEL="$OLLAMA_MODEL"' in launcher_text
    assert "RIN_OLLAMA_TIMEOUT_MS" in launcher_text
    assert "RIN_OLLAMA_NUM_PREDICT" in launcher_text
    assert 'LOCAL_URL="http://127.0.0.1:8765/"' in launcher_text
    assert 'open "$LOCAL_URL"' in launcher_text
    assert "for _ in {1..60}" in launcher_text
