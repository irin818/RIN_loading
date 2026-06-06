import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rin.database import create_temp_layout_database
from rin.diagnostics.safety import create_temp_data_dir
from rin.server import create_app
from rin.storage import create_data_layout


def create_client():
    temp = create_temp_data_dir()
    layout = create_temp_layout_database(temp.path)
    return TestClient(create_app(layout)), layout


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
