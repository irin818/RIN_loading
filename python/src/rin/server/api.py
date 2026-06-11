"""FastAPI application factory with UI, API, and diagnostics routes.

Creates a FastAPI app wired to a RinDataLayout, optional model adapter, and optional
clock.
Routes are grouped into: UI rendering, readiness/state, diagnostics, conversation/chat,
profile/memory status, and safe serialization helpers.
"""

from __future__ import annotations

import os
from collections.abc import Sequence
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
    list_memory_v2_traces,
    list_messages,
)
from rin.diagnostics.readiness import build_python_readiness_report
from rin.diagnostics.runtime_trace import (
    RUNTIME_TRACE_STORE,
    input_preview,
    safe_trace_response,
    short_id,
)
from rin.diagnostics.safety import assert_safe_python_write_data_dir
from rin.profiles import build_profile_report
from rin.storage import RinDataLayout

SERVER_DIR = Path(__file__).parent
REPO_ROOT = SERVER_DIR.parents[3]
TEMPLATES = Jinja2Templates(directory=SERVER_DIR / "templates")
STATIC_DIR = SERVER_DIR / "static"
PUBLIC_LIVE2D_DIR = REPO_ROOT / "public" / "live2d"


class ConversationCreateBody(BaseModel):
    """Request body for POST /conversations — create a new conversation."""

    model_config = ConfigDict(extra="forbid")

    title: str = "Python API conversation"


class ConversationSendBody(BaseModel):
    """
    Request body for chat send endpoints — message content with optional
    conversation/turn ids.
    """

    model_config = ConfigDict(extra="forbid")

    content: str
    conversationId: str | None = None
    turnId: str | None = None


class ApiState(BaseModel):
    """Snapshot of the API server state: mode, counts, protection flags."""

    model_config = ConfigDict(extra="forbid")

    mode: str
    localOnly: bool
    writesTempOnly: bool
    productionDataProtected: bool
    conversations: int
    messages: int


class MockApiAdapter:
    """
    Fallback adapter that returns a static mock reply when no real model is configured.
    """

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
    """Build and return a FastAPI app wired to the given layout, adapter, and clock.

    If no adapter is provided, a MockApiAdapter is used. Routes are grouped by concern:
    UI, diagnostics, chat/conversation, profiles, and memory status.
    """
    app = FastAPI(title="RIN Python Compatibility API", version="0.0.0")
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    if PUBLIC_LIVE2D_DIR.is_dir():
        app.mount(
            "/live2d",
            StaticFiles(directory=PUBLIC_LIVE2D_DIR),
            name="live2d",
        )
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

    # ---- UI rendering ----
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

    # ---- Readiness and state ----
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

    # ---- Status dashboard ----
    @app.get("/api/status-dashboard")
    def api_status_dashboard(
        conversationId: str | None = None,
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> dict[str, object]:
        return build_status_dashboard_summary(
            current_layout,
            current_adapter,
            selected_conversation_id=conversationId,
        )

    # ---- Diagnostics endpoints ----
    @app.get("/api/diagnostics/overview")
    def diagnostics_overview(
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> dict[str, object]:
        return build_diagnostics_payload(current_layout, current_adapter, "overview")

    @app.get("/api/diagnostics/model")
    def diagnostics_model(
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> dict[str, object]:
        return build_diagnostics_payload(current_layout, current_adapter, "model")

    @app.get("/api/diagnostics/memory")
    def diagnostics_memory(
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> dict[str, object]:
        return build_diagnostics_payload(current_layout, current_adapter, "memory")

    @app.get("/api/diagnostics/context")
    def diagnostics_context(
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> dict[str, object]:
        return build_diagnostics_payload(current_layout, current_adapter, "context")

    @app.get("/api/diagnostics/database")
    def diagnostics_database(
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> dict[str, object]:
        return build_diagnostics_payload(current_layout, current_adapter, "database")

    @app.get("/api/diagnostics/profiles")
    def diagnostics_profiles(
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> dict[str, object]:
        return build_diagnostics_payload(current_layout, current_adapter, "profiles")

    @app.get("/api/diagnostics/body")
    def diagnostics_body(
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> dict[str, object]:
        return build_diagnostics_payload(current_layout, current_adapter, "body")

    @app.get("/api/diagnostics/events")
    def diagnostics_events(
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> dict[str, object]:
        return build_diagnostics_payload(current_layout, current_adapter, "events")

    # ---- Runtime trace endpoints ----
    @app.get("/api/diagnostics/runtime-trace")
    def diagnostics_runtime_trace() -> dict[str, object]:
        return safe_trace_response(RUNTIME_TRACE_STORE.list())

    @app.get("/api/diagnostics/runtime-trace/latest")
    def diagnostics_runtime_trace_latest() -> dict[str, object]:
        latest = RUNTIME_TRACE_STORE.latest()
        return safe_trace_response([latest] if latest else [])

    @app.get("/api/diagnostics/runtime-trace/{turn_id}")
    def diagnostics_runtime_trace_by_turn(turn_id: str) -> dict[str, object]:
        trace = RUNTIME_TRACE_STORE.get(turn_id)
        if trace is None:
            raise HTTPException(status_code=404, detail="Runtime trace not found.")
        return {
            "privacyMode": "safe",
            "readOnly": True,
            "localOnly": True,
            "externalProviderCallCount": 0,
            "fullTextIncluded": False,
            "rawModelOutputIncluded": False,
            "rawPromptIncluded": False,
            "trace": trace.to_safe_dict(),
        }

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

    # ---- Profile and memory status ----
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

    # ---- Conversation and chat endpoints ----
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

    @app.post("/api/chat-test/send")
    async def api_chat_test_send(
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
                "Python UI conversation",
                current_clock.now(),
            )
            target_conversation_id = conversation.id
        reject_unsafe_write_layout(current_layout)
        if not body.content.strip():
            raise HTTPException(status_code=400, detail="Message content is required.")
        result = await run_conversation_turn(
            current_layout,
            body.content,
            current_adapter,
            conversation_id=target_conversation_id,
            clock=current_clock,
        )
        messages = list_messages(current_layout, target_conversation_id)
        owner_message = next(
            (message for message in messages if message.id == result.ownerMessageId),
            None,
        )
        rin_message = (
            next(
                (message for message in messages if message.id == result.rinMessageId),
                None,
            )
            if result.rinMessageId
            else None
        )
        return {
            "ok": result.status == "completed",
            "status": result.status,
            "conversationId": target_conversation_id,
            "turnId": result.turnId,
            "elapsedMs": result.elapsedMs,
            "errorCode": result.errorCode,
            "ownerMessage": safe_chat_message(owner_message),
            "rinMessage": safe_chat_message(rin_message),
            "finalAnswer": rin_message.content if rin_message else "",
            "externalProviderCallCount": 0,
            "rawThinkingStored": False,
            "rawModelOutputIncluded": False,
            "hiddenReasoningIncluded": False,
            "dashboard": build_status_dashboard_summary(
                current_layout,
                current_adapter,
                selected_conversation_id=target_conversation_id,
            ),
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
                active_tab="chat",
                notice=f"Reply stored with turn {result['turnId']}.",
            )
        except Exception as error:
            return render_console_page(
                request,
                current_layout,
                current_adapter,
                selected_conversation_id=body.conversationId,
                active_tab="chat",
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


def safe_chat_message(message: object | None) -> dict[str, object] | None:
    """
    Serialize a message for the chat test response, including full text (trusted local
    context).
    """
    if message is None:
        return None
    return {
        "id": getattr(message, "id", "n/a"),
        "shortId": short_id(str(getattr(message, "id", ""))),
        "role": getattr(message, "role", "n/a"),
        "content": getattr(message, "content", ""),
        "createdAt": getattr(message, "createdAt", "n/a"),
        "fullTextIncluded": True,
    }


def render_console_page(
    request: Request,
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol,
    *,
    selected_conversation_id: str | None = None,
    force_new_chat: bool = False,
    active_tab: str = "overview",
    notice: str | None = None,
    error: str | None = None,
) -> Response:
    """Render the Jinja2 console.html template with the full console view model."""
    return TEMPLATES.TemplateResponse(
        request,
        "console.html",
        build_console_view_model(
            layout,
            adapter,
            selected_conversation_id=selected_conversation_id,
            force_new_chat=force_new_chat,
            active_tab=active_tab,
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
    active_tab: str = "overview",
    notice: str | None = None,
    error: str | None = None,
) -> dict[str, object]:
    """Assemble the full data dictionary for the Jinja2 console template.

    Aggregates snapshot, readiness, conversations, messages, profiles, body, dashboard,
    diagnostics, and runtime trace into one view model.
    """
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
    dashboard = build_status_dashboard_summary(
        layout,
        adapter,
        selected_conversation_id=selected,
        messages=messages,
    )
    diagnostics = {
        section: build_diagnostics_payload(layout, adapter, section)
        for section in (
            "overview",
            "model",
            "memory",
            "context",
            "database",
            "profiles",
            "body",
            "events",
        )
    }
    latest_trace = RUNTIME_TRACE_STORE.latest()
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
        "avatar_asset_path": "/live2d/rin/rin-front-fullbody.png",
        "adapter_id": adapter_id,
        "model_name": model_name,
        "local_model_status": local_model_status,
        "dashboard": dashboard,
        "diagnostics": diagnostics,
        "runtime_trace": latest_trace.to_safe_dict() if latest_trace else None,
        "active_tab": active_tab,
        "notice": notice,
        "error": error,
    }


def build_status_dashboard_summary(
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol,
    *,
    selected_conversation_id: str | None = None,
    messages: Sequence[object] | None = None,
) -> dict[str, object]:
    """
    Build a structured dashboard summary.

    Used by both the console page and the /api/status-dashboard endpoint.
    """
    snapshot = local_console_snapshot(layout)
    database = cast(dict[str, object], snapshot["database"])
    memory_context = cast(dict[str, object], snapshot["memoryContext"])
    readiness = build_python_readiness_report().to_dict()
    body_report = build_body_report().to_dict()
    profile = snapshot["profile"]
    profile_status = (
        profile.get("status", "unknown") if isinstance(profile, dict) else "unknown"
    )
    profile_files = profile.get("files", []) if isinstance(profile, dict) else []
    profile_file_count = len(profile_files) if isinstance(profile_files, list) else 0
    conversations = list_conversations(layout, limit=1)
    active_conversation_id = selected_conversation_id or (
        conversations[0].id if conversations else None
    )
    active_messages = (
        messages
        if messages is not None
        else list_messages(layout, active_conversation_id)
        if active_conversation_id
        else []
    )
    owner_message_count = sum(
        1 for message in active_messages if getattr(message, "role", "") == "owner"
    )
    rin_message_count = sum(
        1 for message in active_messages if getattr(message, "role", "") == "rin"
    )
    active_message_count = len(active_messages)
    owner_message_percent = (
        round((owner_message_count / active_message_count) * 100)
        if active_message_count
        else 0
    )
    rin_message_percent = (
        round((rin_message_count / active_message_count) * 100)
        if active_message_count
        else 0
    )
    raw_memory_trace_count = database.get("memoryV2Traces", 0)
    memory_trace_count = (
        raw_memory_trace_count if isinstance(raw_memory_trace_count, int) else 0
    )
    memory_ring_percent = min(100, round((memory_trace_count / 20) * 100))
    adapter_id = adapter.id
    model_name = (
        os.environ.get("RIN_OLLAMA_MODEL", "qwen3:4b")
        if adapter_id == "rin-ollama-local"
        else "provider-free mock"
    )
    raw_schema_version = database.get("schemaVersion", 0)
    schema_version = raw_schema_version if isinstance(raw_schema_version, int) else 0
    memory_available = memory_context.get("available") is True
    return {
        "readiness": {
            "ok": readiness.get("ok") is True,
            "label": "ok" if readiness.get("ok") is True else "warning",
        },
        "adapter": adapter_id,
        "model": model_name,
        "serverMode": "local-only",
        "externalProviderCallCount": snapshot["externalProviderCallCount"],
        "database": {
            "schemaVersion": schema_version,
            "conversations": database["conversations"],
            "messages": database["messages"],
        },
        "profile": {
            "status": profile_status,
            "fileCount": profile_file_count,
        },
        "memoryContext": {
            "available": memory_available,
            "memoryV2Traces": memory_trace_count,
            "fullTextIncluded": memory_context["fullTextIncluded"],
            "ringFillPercent": memory_ring_percent,
        },
        "activeConversation": {
            "id": active_conversation_id,
            "messageCount": active_message_count,
            "ownerMessages": owner_message_count,
            "rinMessages": rin_message_count,
            "ownerMessagePercent": owner_message_percent,
            "rinMessagePercent": rin_message_percent,
        },
        "body": {
            "status": body_report["status"],
            "adapterId": body_report["adapterId"],
        },
        "health": {
            "database": "ok" if schema_version >= 6 else "warning",
            "model": "ok" if adapter_id else "warning",
            "profile": "ok" if profile_status == "valid" else "warning",
            "memory": "ok" if memory_available else "warning",
            "local": "ok" if snapshot["localOnly"] is True else "warning",
        },
    }


def build_diagnostics_payload(
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol,
    section: str,
) -> dict[str, object]:
    """
    Build a detailed diagnostics payload for one section (overview, model, memory,
    etc.).
    """
    dashboard = build_status_dashboard_summary(layout, adapter)
    snapshot = local_console_snapshot(layout)
    database = cast(dict[str, object], snapshot["database"])
    memory_context = cast(dict[str, object], snapshot["memoryContext"])
    profile = snapshot["profile"]
    profile_status = (
        profile.get("status", "unknown") if isinstance(profile, dict) else "unknown"
    )
    profile_files = profile.get("files", []) if isinstance(profile, dict) else []
    profile_file_count = len(profile_files) if isinstance(profile_files, list) else 0
    body_report = build_body_report().to_dict()
    conversations = list_conversations(layout, limit=8)
    conversation_summaries = []
    for conversation in conversations:
        messages = list_messages(layout, conversation.id)
        owner_count = sum(1 for message in messages if message.role == "owner")
        rin_count = sum(1 for message in messages if message.role == "rin")
        conversation_summaries.append(
            {
                "id": conversation.id,
                "title": conversation.title,
                "messageCount": len(messages),
                "ownerMessages": owner_count,
                "rinMessages": rin_count,
                "createdAt": getattr(conversation, "createdAt", "n/a"),
                "updatedAt": getattr(conversation, "updatedAt", "n/a"),
            }
        )
    model_name = str(dashboard["model"])
    adapter_id = adapter.id
    ollama_base_url = (
        os.environ.get("RIN_OLLAMA_BASE_URL", "http://127.0.0.1:11434")
        if adapter_id == "rin-ollama-local"
        else "n/a"
    )
    memory_diagnostics = build_memory_diagnostics_payload(layout)
    payloads: dict[str, dict[str, object]] = {
        "overview": {
            "mode": "diagnostics-overview",
            "readOnly": True,
            "localOnly": True,
            "fullTextIncluded": False,
            "dashboard": dashboard,
            "lastKnownError": "n/a",
        },
        "model": {
            "mode": "diagnostics-model",
            "readOnly": True,
            "providerCallsMade": 0,
            "adapter": adapter_id,
            "provider": "local",
            "model": model_name,
            "baseUrl": ollama_base_url,
            "timeoutMs": os.environ.get("RIN_OLLAMA_TIMEOUT_MS", "180000"),
            "numPredict": os.environ.get("RIN_OLLAMA_NUM_PREDICT", "1024"),
            "temperature": os.environ.get("RIN_OLLAMA_TEMPERATURE", "n/a"),
            "topP": os.environ.get("RIN_OLLAMA_TOP_P", "n/a"),
            "externalApiDisabled": True,
            "smokeStatus": "not run automatically",
            "sanitizerStatus": "thinking output is guarded by adapter tests",
        },
        "memory": memory_diagnostics,
        "context": {
            "mode": "diagnostics-context",
            "readOnly": True,
            "fullPromptIncluded": False,
            "fullTextIncluded": False,
            "recentWindowPolicy": "short-term recent context window",
            "profileInjection": "available" if profile_status == "valid" else "warning",
            "memoryInjection": "available"
            if memory_context.get("available") is True
            else "warning",
            "deduplication": "managed by Context V2 algorithms",
            "budgetPolicy": "no raw prompt dump exposed by diagnostics",
            "droppedItemCount": "n/a",
        },
        "database": {
            "mode": "diagnostics-database",
            "readOnly": True,
            "dataDirName": Path(str(layout.rootDir)).name,
            "manifestPresent": layout.manifestPath.is_file(),
            "databaseSchemaVersion": database["schemaVersion"],
            "conversationCount": database["conversations"],
            "messageCount": database["messages"],
            "profileFileCount": profile_file_count,
        },
        "profiles": {
            "mode": "diagnostics-profiles",
            "readOnly": True,
            "fullTextIncluded": False,
            "status": profile_status,
            "fileCount": profile_file_count,
            "summary": "profile validation status and file counts only",
        },
        "body": {
            "mode": "diagnostics-body",
            "readOnly": True,
            "status": body_report["status"],
            "adapterId": body_report["adapterId"],
            "staticPresenceAsset": "/live2d/rin/rin-front-fullbody.png",
            "cubismRuntimeActive": False,
            "futureDesktopBody": "future Live2D body may run separately",
        },
        "events": {
            "mode": "diagnostics-events",
            "readOnly": True,
            "fullPayloadIncluded": False,
            "recentAuditEventCount": "n/a",
            "errorCount": "n/a",
            "lastErrorCode": "n/a",
            "notes": "safe diagnostics only; no raw prompts or hidden reasoning",
        },
    }
    return payloads[section] | {
        "section": section,
        "externalProviderCallCount": snapshot["externalProviderCallCount"],
        "conversations": conversation_summaries,
    }


def build_memory_diagnostics_payload(layout: RinDataLayout) -> dict[str, object]:
    """
    Build the detailed memory diagnostics payload: algorithm, state, AI memory state,
    contents, curve, health.
    """
    status = inspect_database(layout)
    traces = list_memory_v2_traces(layout, limit=12)
    latest_trace = RUNTIME_TRACE_STORE.latest()
    memory_retrieval_stage = (
        next(
            (
                stage
                for stage in latest_trace.stages
                if stage.name == "memory_v2_retrieval"
            ),
            None,
        )
        if latest_trace
        else None
    )
    memory_update_stage = (
        next(
            (stage for stage in latest_trace.stages if stage.name == "memory_update"),
            None,
        )
        if latest_trace
        else None
    )
    context_stage = (
        next(
            (
                stage
                for stage in latest_trace.stages
                if stage.name == "context_assembly"
            ),
            None,
        )
        if latest_trace
        else None
    )
    retrieval_wired = (
        bool(memory_retrieval_stage.operation.get("retrievalEnabled"))
        if memory_retrieval_stage
        else False
    )
    retrieval_skip_reason = (
        str(memory_retrieval_stage.decision.get("skipReason", "n/a"))
        if memory_retrieval_stage
        else "no_runtime_trace_available"
    )
    memory_used_in_last_request = (
        context_stage.output.get("memoryTracesIncludedCount", 0) != 0
        if context_stage is not None
        else False
    )
    recent_history_used_in_last_request = (
        context_stage.output.get("recentHistoryIncludedCount", 0) != 0
        if context_stage is not None
        else False
    )
    return {
        "mode": "diagnostics-memory",
        "readOnly": True,
        "localOnly": True,
        "fullTextIncluded": False,
        "algorithm": {
            "shortTermWindowPolicy": "last six prior messages in active conversation",
            "memoryV2WritePolicy": (
                "successful turns write safe long-term candidate trace summaries"
            ),
            "retrievalStatus": "active" if retrieval_wired else "skipped",
            "retentionFormula": (
                "n/a - Memory V2 retention curve is not parameterized yet"
            ),
            "scoringSummary": (
                "current writes create safe long-term candidate traces with a "
                "salience score; runtime retrieval selects top traces by score"
            ),
            "privacyPolicy": (
                "safe counts, hashes, ids, scores, and short previews only"
            ),
            "fullTextIncluded": False,
        },
        "state": {
            "traceCount": status.counts.memoryV2Traces,
            "signalCount": status.counts.memoryV2TraceSignals,
            "messageMemoryContexts": status.counts.messageMemoryContexts,
            "recentUpdateStatus": memory_update_stage.status
            if memory_update_stage
            else "n/a",
            "retrievalWiredIntoPrompt": retrieval_wired,
            "retrievalSkipReason": retrieval_skip_reason,
            "memoryInjectedIntoLastContextCount": memory_retrieval_stage.output.get(
                "selectedTraceCount",
                0,
            )
            if memory_retrieval_stage
            else 0,
            "lastMemoryUpdateCounts": memory_update_stage.output
            if memory_update_stage
            else {},
            "lastTraceIds": [short_id(trace.id) for trace in traces[:5]],
        },
        "aiMemoryState": {
            "shortTermContextActive": True,
            "longTermTracesWritten": status.counts.memoryV2Traces > 0,
            "longTermRetrievalActive": retrieval_wired,
            "memoryUsedInLastModelRequest": memory_used_in_last_request,
            "recentHistoryUsedInLastModelRequest": recent_history_used_in_last_request,
        },
        "contents": [safe_memory_trace_item(trace) for trace in traces],
        "curve": {
            "formula": "n/a - no decay/stability parameter is active in runtime yet",
            "status": "not parameterized yet",
            "display": "design placeholder only",
            "samplePoints": [
                {"label": "now", "retentionEstimate": "n/a"},
                {"label": "1h", "retentionEstimate": "n/a"},
                {"label": "6h", "retentionEstimate": "n/a"},
                {"label": "24h", "retentionEstimate": "n/a"},
                {"label": "7d", "retentionEstimate": "n/a"},
            ],
        },
        "health": {
            "databaseReadable": True,
            "traceTableStatus": "ok"
            if any(
                table.name == "memory_v2_traces" and table.exists
                for table in status.tables
            )
            else "missing",
            "recentHistoryAvailable": status.counts.messages > 0,
            "retrievalStatus": "active" if retrieval_wired else "skipped",
            "updateStatus": memory_update_stage.status
            if memory_update_stage
            else "n/a",
            "privacySafe": True,
        },
        "warnings": [
            "Short-term conversation context is active and separate from Memory V2.",
            "No Memory V2 traces available for retrieval."
            if retrieval_skip_reason == "no_memory_v2_traces"
            else "Memory V2 retrieval is active with safe trace summaries.",
            "Memory curve is not parameterized yet; retention estimates are n/a.",
        ],
        "memoryV2Traces": status.counts.memoryV2Traces,
        "messageMemoryContexts": status.counts.messageMemoryContexts,
        "available": True,
        "privacy": "counts and metadata only; no full memory text",
        "retentionSummary": (
            "Memory V2 writes safe candidate traces and retrieves top trace "
            "summaries; retention curve visualization remains a placeholder."
        ),
    }


def safe_memory_trace_item(trace: object) -> dict[str, object]:
    """
    Serialize one memory trace for the diagnostics view (no raw text — counts, hashes,
    previews only).
    """
    signal_summary = getattr(trace, "signalSummary", {})
    content_length = (
        signal_summary.get("contentCharacterCount", "n/a")
        if isinstance(signal_summary, dict)
        else "n/a"
    )
    source = (
        signal_summary.get("source", "n/a")
        if isinstance(signal_summary, dict)
        else "n/a"
    )
    raw_included = (
        signal_summary.get("rawTextIncluded", False)
        if isinstance(signal_summary, dict)
        else False
    )
    return {
        "traceId": getattr(trace, "id", "n/a"),
        "traceShortId": short_id(str(getattr(trace, "id", ""))),
        "sourceMessageId": getattr(trace, "sourceId", "n/a"),
        "sourceShortId": short_id(str(getattr(trace, "sourceId", ""))),
        "traceType": getattr(trace, "traceType", "n/a"),
        "createdAt": getattr(trace, "createdAt", "n/a"),
        "updatedAt": getattr(trace, "updatedAt", "n/a"),
        "salienceScore": getattr(trace, "salienceScore", "n/a"),
        "age": "n/a",
        "retentionEstimate": "n/a",
        "signalKeys": sorted(signal_summary.keys())
        if isinstance(signal_summary, dict)
        else [],
        "rawTextIncluded": raw_included,
        "contentCharacterCount": content_length,
        "safePreview": input_preview(
            f"{source}; {content_length} chars; rawTextIncluded={raw_included}",
            limit=72,
        ),
        "fullTextIncluded": False,
    }


def local_console_snapshot(layout: RinDataLayout) -> dict[str, object]:
    """
    Build a lightweight snapshot of the local console state (database counts, profile,
    model runtime).
    """
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
    """Raise HTTP 403 if the layout's root directory is not safe for writes."""
    try:
        assert_safe_python_write_data_dir(layout.rootDir)
    except Exception as error:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "UNSAFE_DATA_PATH",
                "message": (
                    "Python API writes require /tmp/rin-python-* "
                    "or the production .rin-data directory."
                ),
            },
        ) from error
