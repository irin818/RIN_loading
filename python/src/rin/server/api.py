from __future__ import annotations

import os
from pathlib import Path
from typing import cast

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, ConfigDict

from rin.body import build_body_report
from rin.contracts import ModelRequest, ModelResponse, ModelResponseMetadata
from rin.conversation import ModelAdapterProtocol, RuntimeClock, run_conversation_turn
from rin.database import (
    create_conversation,
    inspect_database,
    list_conversations,
    list_messages,
)
from rin.diagnostics.readiness import build_python_readiness_report
from rin.diagnostics.safety import assert_safe_python_write_data_dir
from rin.profiles import build_profile_report
from rin.storage import RinDataLayout

SERVER_DIR = Path(__file__).parent
TEMPLATES = Jinja2Templates(directory=SERVER_DIR / "templates")
STATIC_DIR = SERVER_DIR / "static"


class ConversationCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = "Python API conversation"


class ConversationSendBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str
    conversationId: str | None = None
    turnId: str | None = None


class ApiState(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: str
    localOnly: bool
    writesTempOnly: bool
    productionDataProtected: bool
    conversations: int
    messages: int


class MockApiAdapter:
    id = "rin-mock-local"

    async def generate(self, request: ModelRequest) -> ModelResponse:
        return ModelResponse(
            content="Python API mock reply.",
            adapterId=self.id,
            metadata=ModelResponseMetadata(
                externalProvider=False,
                memoryWriteRequested=False,
                toolCallRequested=False,
            ),
        )


def create_app(
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol | None = None,
    clock: RuntimeClock | None = None,
) -> FastAPI:
    app = FastAPI(title="RIN Python Compatibility API", version="0.0.0")
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    selected_adapter = adapter or MockApiAdapter()
    selected_clock = clock or RuntimeClock()

    def get_layout() -> RinDataLayout:
        return layout

    def get_adapter() -> ModelAdapterProtocol:
        return selected_adapter

    def get_clock() -> RuntimeClock:
        return selected_clock

    layout_dependency = Depends(get_layout)
    adapter_dependency = Depends(get_adapter)
    clock_dependency = Depends(get_clock)

    @app.get("/", response_class=HTMLResponse)
    def ui_root(
        request: Request,
        conversationId: str | None = None,
        new: bool = False,
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> Response:
        return render_console_page(
            request,
            current_layout,
            current_adapter,
            selected_conversation_id=conversationId,
            force_new_chat=new,
        )

    @app.get("/ui", response_class=HTMLResponse)
    def ui(
        request: Request,
        conversationId: str | None = None,
        new: bool = False,
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> Response:
        return render_console_page(
            request,
            current_layout,
            current_adapter,
            selected_conversation_id=conversationId,
            force_new_chat=new,
        )

    @app.get("/readiness")
    def readiness() -> dict[str, object]:
        return build_python_readiness_report().to_dict()

    @app.get("/state")
    def state(current_layout: RinDataLayout = layout_dependency) -> dict[str, object]:
        return api_state_payload(current_layout)

    @app.get("/api/local-state")
    def api_local_state(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return local_console_snapshot(current_layout)

    @app.get("/api/readiness")
    def api_readiness() -> dict[str, object]:
        return {"ok": True, "readiness": build_python_readiness_report().to_dict()}

    def api_state_payload(current_layout: RinDataLayout) -> dict[str, object]:
        status = inspect_database(current_layout)
        return ApiState(
            mode="python-fastapi-compatibility",
            localOnly=True,
            writesTempOnly=True,
            productionDataProtected=True,
            conversations=status.counts.conversations,
            messages=status.counts.messages,
        ).model_dump(mode="json")

    @app.get("/profile/status")
    def profile_status(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return build_profile_report(current_layout).model_dump(mode="json")

    @app.get("/memory/context-trace/status")
    def memory_context_trace_status(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        status = inspect_database(current_layout)
        return {
            "mode": "memory-context-trace-status",
            "memoryV2Traces": status.counts.memoryV2Traces,
            "messageMemoryContexts": status.counts.messageMemoryContexts,
            "providerCallCount": 0,
            "fullTextIncluded": False,
        }

    @app.post("/conversations")
    def create_conversation_endpoint(
        body: ConversationCreateBody,
        current_layout: RinDataLayout = layout_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        conversation = create_conversation(
            current_layout,
            body.title,
            current_clock.now(),
        )
        return conversation.model_dump(mode="json")

    @app.post("/api/conversations")
    async def api_conversation_send(
        body: ConversationSendBody,
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        target_conversation_id = body.conversationId
        if target_conversation_id is None:
            reject_unsafe_write_layout(current_layout)
            conversation = create_conversation(
                current_layout,
                "Python API conversation",
                current_clock.now(),
            )
            target_conversation_id = conversation.id
        result = await send_message(
            target_conversation_id,
            body,
            current_layout,
            current_adapter,
            current_clock,
        )
        return {
            "ok": True,
            "turn": result,
            "snapshot": local_console_snapshot(current_layout),
        }

    @app.post("/ui/chat", response_class=HTMLResponse)
    async def ui_chat(
        request: Request,
        body: ConversationSendBody,
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> Response:
        try:
            target_conversation_id = body.conversationId
            if target_conversation_id is None:
                reject_unsafe_write_layout(current_layout)
                conversation = create_conversation(
                    current_layout,
                    "Python UI conversation",
                    current_clock.now(),
                )
                target_conversation_id = conversation.id
            result = await send_message(
                target_conversation_id,
                body,
                current_layout,
                current_adapter,
                current_clock,
            )
            return render_console_page(
                request,
                current_layout,
                current_adapter,
                selected_conversation_id=target_conversation_id,
                notice=f"Reply stored with turn {result['turnId']}.",
            )
        except Exception as error:
            return render_console_page(
                request,
                current_layout,
                current_adapter,
                selected_conversation_id=body.conversationId,
                error=f"{type(error).__name__}: {error}",
            )

    @app.get("/conversations")
    def list_conversations_endpoint(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return {
            "conversations": [
                item.model_dump(mode="json")
                for item in list_conversations(current_layout, limit=50)
            ],
            "fullTextIncluded": False,
        }

    @app.get("/api/conversations")
    def api_list_conversations(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return {
            "ok": True,
            "conversations": [
                item.model_dump(mode="json")
                for item in list_conversations(current_layout, limit=20)
            ],
            "snapshot": local_console_snapshot(current_layout),
        }

    @app.get("/conversations/{conversation_id}/history")
    def conversation_history(
        conversation_id: str,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return {
            "conversationId": conversation_id,
            "messages": [
                item.model_dump(mode="json")
                for item in list_messages(current_layout, conversation_id)
            ],
        }

    @app.get("/api/conversations/{conversation_id}")
    def api_conversation_history(
        conversation_id: str,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        conversations = [
            item.model_dump(mode="json")
            for item in list_conversations(current_layout, limit=50)
            if item.id == conversation_id
        ]
        return {
            "ok": True,
            "conversation": conversations[0] if conversations else None,
            "messages": [
                item.model_dump(mode="json")
                for item in list_messages(current_layout, conversation_id)
            ],
            "snapshot": local_console_snapshot(current_layout),
        }

    @app.post("/conversations/{conversation_id}/send")
    async def send_message(
        conversation_id: str,
        body: ConversationSendBody,
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        if not body.content.strip():
            raise HTTPException(status_code=400, detail="Message content is required.")
        result = await run_conversation_turn(
            current_layout,
            body.content,
            current_adapter,
            conversation_id=conversation_id,
            clock=current_clock,
        )
        status_code = 200 if result.status == "completed" else 502
        if result.status != "completed":
            raise HTTPException(status_code=status_code, detail=result.model_dump())
        return result.model_dump(mode="json")

    return app


def render_console_page(
    request: Request,
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol,
    *,
    selected_conversation_id: str | None = None,
    force_new_chat: bool = False,
    notice: str | None = None,
    error: str | None = None,
) -> Response:
    return TEMPLATES.TemplateResponse(
        request,
        "console.html",
        build_console_view_model(
            layout,
            adapter,
            selected_conversation_id=selected_conversation_id,
            force_new_chat=force_new_chat,
            notice=notice,
            error=error,
        ),
    )


def build_console_view_model(
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol,
    *,
    selected_conversation_id: str | None = None,
    force_new_chat: bool = False,
    notice: str | None = None,
    error: str | None = None,
) -> dict[str, object]:
    snapshot = local_console_snapshot(layout)
    database = cast(dict[str, object], snapshot["database"])
    memory_context = cast(dict[str, object], snapshot["memoryContext"])
    readiness = build_python_readiness_report().to_dict()
    body_report = build_body_report().to_dict()
    conversations = list_conversations(layout, limit=20)
    selected = (
        None
        if force_new_chat
        else (
            selected_conversation_id or (conversations[0].id if conversations else None)
        )
    )
    messages = list_messages(layout, selected) if selected else []
    profile = snapshot["profile"]
    profile_status = (
        profile.get("status", "unknown") if isinstance(profile, dict) else "unknown"
    )
    profile_files = profile.get("files", []) if isinstance(profile, dict) else []
    profile_file_count = len(profile_files) if isinstance(profile_files, list) else 0
    adapter_id = adapter.id
    model_name = (
        os.environ.get("RIN_OLLAMA_MODEL", "qwen3:4b")
        if adapter_id == "rin-ollama-local"
        else "provider-free mock"
    )
    local_model_status = (
        "selected" if adapter_id == "rin-ollama-local" else "not selected"
    )
    return {
        "title": "RIN Python Local Console",
        "identity": "Python-primary local RIN runtime.",
        "snapshot": snapshot,
        "database": database,
        "readiness": readiness,
        "conversations": conversations,
        "selected_conversation_id": selected,
        "messages": messages,
        "message_count": len(messages),
        "profile_status": profile_status,
        "profile_file_count": profile_file_count,
        "memory_context": memory_context,
        "body_report": body_report,
        "adapter_id": adapter_id,
        "model_name": model_name,
        "local_model_status": local_model_status,
        "notice": notice,
        "error": error,
    }


def local_console_snapshot(layout: RinDataLayout) -> dict[str, object]:
    status = inspect_database(layout)
    profile = build_profile_report(layout).model_dump(mode="json")
    return {
        "ok": True,
        "mode": "python-fastapi-compatibility",
        "localOnly": True,
        "providerCallCount": 0,
        "externalProviderCallCount": 0,
        "fullTextIncluded": False,
        "database": {
            "schemaVersion": status.schemaVersion,
            "conversations": status.counts.conversations,
            "messages": status.counts.messages,
            "memoryV2Traces": status.counts.memoryV2Traces,
        },
        "profile": profile,
        "modelRuntime": {
            "activeAdapter": "rin-mock-local",
            "provider": "local",
            "localOnly": True,
        },
        "memoryContext": {
            "available": True,
            "memoryV2Traces": status.counts.memoryV2Traces,
            "fullTextIncluded": False,
        },
    }


def reject_unsafe_write_layout(layout: RinDataLayout) -> None:
    try:
        assert_safe_python_write_data_dir(layout.rootDir)
    except Exception as error:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "UNSAFE_DATA_PATH",
                "message": (
                    "Python compatibility API writes require /tmp/rin-python-* "
                    "or the approved persistent sandbox."
                ),
            },
        ) from error
