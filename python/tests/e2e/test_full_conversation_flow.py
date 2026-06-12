"""End-to-end conversation tests across FastAPI, SQLite, runtime, and memory."""

from __future__ import annotations

import shutil

from fastapi.testclient import TestClient

from rin.contracts import ModelRequest, ModelResponse, ModelResponseMetadata
from rin.database import create_temp_layout_database, inspect_database, list_messages
from rin.diagnostics.runtime_trace import RUNTIME_TRACE_STORE
from rin.diagnostics.safety import create_temp_data_dir
from rin.server import create_app
from rin.storage import RinDataLayout


class E2EAdapter:
    id = "rin-e2e-local"

    async def generate(self, request: ModelRequest) -> ModelResponse:
        return ModelResponse(
            content="Noted. I will keep the response concise.",
            adapterId=self.id,
            metadata=ModelResponseMetadata(
                externalProvider=False,
                memoryWriteRequested=False,
                toolCallRequested=False,
            ),
        )


def create_layout() -> RinDataLayout:
    temp = create_temp_data_dir("rin-python-e2e-")
    return create_temp_layout_database(temp.path)


def test_full_conversation_flow_persists_reply_and_safe_memory_trace() -> None:
    layout = create_layout()
    try:
        RUNTIME_TRACE_STORE.clear()
        client = TestClient(create_app(layout, adapter=E2EAdapter()))

        created = client.post("/conversations", json={"title": "E2E flow"})
        conversation_id = created.json()["id"]
        sent = client.post(
            f"/conversations/{conversation_id}/send",
            json={"content": "I prefer concise runtime updates."},
        )
        history = client.get(f"/conversations/{conversation_id}/history")
        trace = client.get("/api/diagnostics/runtime-trace/latest")
        status = inspect_database(layout)
        messages = list_messages(layout, conversation_id)

        assert created.status_code == 200
        assert sent.status_code == 200
        assert sent.json()["status"] == "completed"
        assert history.status_code == 200
        assert [message.role for message in messages] == ["owner", "rin"]
        assert messages[-1].content == "Noted. I will keep the response concise."
        assert status.counts.conversations == 1
        assert status.counts.messages == 2
        assert status.counts.conversationTurns == 1
        assert status.counts.memoryV2Traces == 1

        payload = trace.json()
        assert payload["fullTextIncluded"] is False
        assert payload["rawModelOutputIncluded"] is False
        assert payload["traces"][0]["status"] == "success"
        assert "I prefer concise runtime updates." not in trace.text
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)
