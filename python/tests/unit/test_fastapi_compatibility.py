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
        assert "RIN Python Console" in response.text
        assert "Python-primary local RIN runtime." in response.text
        assert "Python FastAPI local-only" in response.text
        assert "Ready:" in response.text
        assert "Adapter:" in response.text
        assert "Local model:" in response.text
        assert "Profile status:" in response.text
        assert "Profile files:" in response.text
        assert "Memory V2 traces:" in response.text
        assert "Trace full text included:" in response.text
        assert "safe read-only refresh" in response.text
        assert "External API calls:" in response.text
        assert "0" in response.text
        assert "No messages yet." in response.text
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
        assert "Conversation History" in response.text
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
        assert "Local model:" in response.text
        assert "selected" in response.text
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_python_ui_error_rendering_is_visible() -> None:
    client, layout = create_client(adapter=FailingAdapter())
    try:
        response = client.post("/ui/chat", json={"content": "fail visibly"})

        assert response.status_code == 200
        assert "error" in response.text
        assert "test adapter failure" in response.text
        assert "RIN Python Console" in response.text
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)
