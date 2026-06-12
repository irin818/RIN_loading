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
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, ConfigDict

from rin.body import build_body_report
from rin.contracts import ModelRequest, ModelResponse, ModelResponseMetadata
from rin.conversation import ModelAdapterProtocol, RuntimeClock, run_conversation_turn
from rin.database import (
    create_conversation,
    get_conversation,
    inspect_database,
    list_conversations,
    list_legacy_memories,
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
from rin.version import __version__

SERVER_DIR = Path(__file__).parent
REPO_ROOT = SERVER_DIR.parents[3]
TEMPLATES = Jinja2Templates(directory=SERVER_DIR / "templates")
STATIC_DIR = SERVER_DIR / "static"
PUBLIC_LIVE2D_DIR = REPO_ROOT / "public" / "live2d"
FRONTEND_DIST_DIR = REPO_ROOT / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIST_DIR / "index.html"
FRONTEND_ASSETS_DIR = FRONTEND_DIST_DIR / "assets"
FRONTEND_DIST_PICTURE_DIR = FRONTEND_DIST_DIR / "picture"


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
    if FRONTEND_ASSETS_DIR.is_dir():
        app.mount(
            "/glitch-core/assets",
            StaticFiles(directory=FRONTEND_ASSETS_DIR),
            name="glitch-core-assets",
        )
    if PUBLIC_LIVE2D_DIR.is_dir():
        app.mount(
            "/live2d",
            StaticFiles(directory=PUBLIC_LIVE2D_DIR),
            name="live2d",
        )
    if FRONTEND_DIST_PICTURE_DIR.is_dir():
        app.mount(
            "/picture",
            StaticFiles(directory=FRONTEND_DIST_PICTURE_DIR),
            name="picture",
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
    def redirect_to_glitch_core() -> Response:
        return RedirectResponse(url="/glitch-core", status_code=307)

    @app.get("/")
    def ui_root() -> Response:
        return redirect_to_glitch_core()

    @app.get("/ui")
    def ui() -> Response:
        return redirect_to_glitch_core()

    @app.get("/ui-v2")
    def ui_v2() -> Response:
        return redirect_to_glitch_core()

    @app.get("/legacy-ui", response_class=HTMLResponse)
    def legacy_ui(
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

    @app.get("/glitch-core", response_class=HTMLResponse)
    def glitch_core_index() -> Response:
        return render_glitch_core_entry()

    @app.get("/glitch-core/{spa_path:path}", response_class=HTMLResponse)
    def glitch_core_spa(spa_path: str) -> Response:
        return render_glitch_core_entry()

    @app.get("/legacy-ui-v2", response_class=HTMLResponse)
    def legacy_ui_v2(
        request: Request,
        conversationId: str | None = None,
        new: bool = False,
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> Response:
        return render_console_v2_page(
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

    @app.get("/api/console-v2/snapshot")
    def api_console_v2_snapshot(
        conversationId: str | None = None,
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> dict[str, object]:
        return build_console_v2_snapshot(
            current_layout,
            current_adapter,
            selected_conversation_id=conversationId,
        )

    @app.get("/api/glitch-core/snapshot")
    def api_glitch_core_snapshot(
        conversationId: str | None = None,
        memoryQuery: str = "",
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> dict[str, object]:
        return build_glitch_core_snapshot(
            current_layout,
            current_adapter,
            selected_conversation_id=conversationId,
            memory_query=memoryQuery,
        )

    @app.get("/api/glitch-core/memories")
    def api_glitch_core_memories(
        query: str = "",
        limit: int = 40,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return {
            "ok": True,
            "mode": "glitch-core-memories",
            "readOnly": True,
            "localOnly": True,
            "fullTextIncluded": False,
            "cards": build_glitch_memory_cards(
                current_layout,
                query=query,
                limit=limit,
            ),
        }

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
        require_message_content(body.content)
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
        require_message_content(body.content)
        target_conversation_id = body.conversationId
        if target_conversation_id is None:
            reject_unsafe_write_layout(current_layout)
            conversation = create_conversation(
                current_layout,
                "Python UI conversation",
                current_clock.now(),
            )
            target_conversation_id = conversation.id
        require_existing_conversation(current_layout, target_conversation_id)
        reject_unsafe_write_layout(current_layout)
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
            require_message_content(body.content)
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
        require_message_content(body.content)
        require_existing_conversation(current_layout, conversation_id)
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


def render_console_v2_page(
    request: Request,
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol,
    *,
    selected_conversation_id: str | None = None,
    force_new_chat: bool = False,
    notice: str | None = None,
    error: str | None = None,
) -> Response:
    """Render Console V2 with the safe combined view model."""
    return TEMPLATES.TemplateResponse(
        request,
        "console-v2.html",
        build_console_v2_view_model(
            layout,
            adapter,
            selected_conversation_id=selected_conversation_id,
            force_new_chat=force_new_chat,
            notice=notice,
            error=error,
        ),
    )


def render_glitch_core_entry() -> Response:
    """Serve the built React shell when available, otherwise show run instructions."""
    if FRONTEND_INDEX.is_file():
        return FileResponse(FRONTEND_INDEX)
    return HTMLResponse(
        """
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>RIN Glitch Core Console</title>
            <style>
              body {
                margin: 0;
                min-height: 100vh;
                display: grid;
                place-items: center;
                background: #020403;
                color: #d8ffe5;
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              }
              main {
                width: min(720px, calc(100vw - 40px));
                border: 1px solid #00ff64;
                padding: 28px;
                box-shadow: 0 0 36px rgba(0, 255, 100, 0.24);
                background: rgba(0, 18, 9, 0.84);
              }
              code { color: #67e8f9; }
            </style>
          </head>
          <body>
            <main>
              <h1>RIN Glitch Core Console</h1>
              <p>React build not found. Run the frontend dev server:</p>
              <p><code>cd frontend && npm install && npm run dev</code></p>
              <p>Backend API remains available from this Python server.</p>
            </main>
          </body>
        </html>
        """,
        status_code=503,
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
        "avatar_asset_path": "/picture/rin-core-background.png",
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


def build_console_v2_view_model(
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol,
    *,
    selected_conversation_id: str | None = None,
    force_new_chat: bool = False,
    notice: str | None = None,
    error: str | None = None,
) -> dict[str, object]:
    """Assemble Console V2 template data while preserving safe diagnostics."""
    conversations = list_conversations(layout, limit=20)
    selected = (
        None
        if force_new_chat
        else (
            selected_conversation_id or (conversations[0].id if conversations else None)
        )
    )
    messages = list_messages(layout, selected) if selected else []
    snapshot = build_console_v2_snapshot(
        layout,
        adapter,
        selected_conversation_id=selected,
        messages=messages,
    )
    return {
        "title": "RIN Console V2",
        "version": __version__,
        "identity": "Python-first local RIN runtime.",
        "selected_conversation_id": selected,
        "conversations": conversations,
        "messages": messages,
        "snapshot": snapshot,
        "dashboard": snapshot["dashboard"],
        "diagnostics": snapshot["diagnostics"],
        "runtime_trace": snapshot["runtimeTrace"],
        "avatar_asset_path": "/picture/rin-core-background.png",
        "notice": notice,
        "error": error,
    }


def build_console_v2_snapshot(
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol,
    *,
    selected_conversation_id: str | None = None,
    messages: Sequence[object] | None = None,
) -> dict[str, object]:
    """Return the safe combined data payload used by Console V2."""
    dashboard = build_status_dashboard_summary(
        layout,
        adapter,
        selected_conversation_id=selected_conversation_id,
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
    conversations = list_conversations(layout, limit=20)
    return {
        "ok": True,
        "mode": "console-v2-snapshot",
        "readOnly": True,
        "localOnly": True,
        "version": __version__,
        "fullTextIncluded": False,
        "rawPromptIncluded": False,
        "rawModelOutputIncluded": False,
        "hiddenReasoningIncluded": False,
        "externalProviderCallCount": 0,
        "dashboard": dashboard,
        "diagnostics": diagnostics,
        "runtimeTrace": latest_trace.to_safe_dict() if latest_trace else None,
        "conversations": [
            {
                "id": conversation.id,
                "shortId": short_id(conversation.id),
                "title": conversation.title,
                "createdAt": conversation.createdAt,
                "updatedAt": conversation.updatedAt,
            }
            for conversation in conversations
        ],
        "selectedConversationId": selected_conversation_id,
        "storage": {
            "dataDirName": layout.rootDir.name,
            "manifestPresent": layout.manifestPath.is_file(),
            "databaseReadable": True,
            "fullPathIncluded": False,
        },
    }


def build_glitch_core_snapshot(
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol,
    *,
    selected_conversation_id: str | None = None,
    memory_query: str = "",
) -> dict[str, object]:
    """Return the read-only JSON model for the React Glitch Core console."""
    conversations = list_conversations(layout, limit=30)
    selected = selected_conversation_id or (
        conversations[0].id if conversations else None
    )
    messages = list_messages(layout, selected) if selected else []
    dashboard = build_status_dashboard_summary(
        layout,
        adapter,
        selected_conversation_id=selected,
        messages=messages,
    )
    model_diagnostics = build_diagnostics_payload(layout, adapter, "model")
    memory_cards = build_glitch_memory_cards(layout, query=memory_query, limit=40)
    latest_trace = RUNTIME_TRACE_STORE.latest()
    latest_trace_payload = latest_trace.to_safe_dict() if latest_trace else None
    traces = [trace.to_safe_dict() for trace in RUNTIME_TRACE_STORE.list()]
    readiness = cast(dict[str, object], dashboard["readiness"])
    return {
        "ok": True,
        "mode": "glitch-core-snapshot",
        "readOnly": True,
        "localOnly": True,
        "version": __version__,
        "fullTextIncluded": False,
        "rawPromptIncluded": False,
        "rawModelOutputIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
        "externalProviderCallCount": 0,
        "core": {
            "name": "RIN",
            "status": "online" if readiness["ok"] is True else "warning",
            "mode": "local-first",
            "avatarAssetPath": "/picture/rin-core-background.png",
            "replaceableImageNote": (
                "Replace public/picture/rin-core-background.png later."
            ),
            "animationEnabledByDefault": True,
        },
        "dashboard": dashboard,
        "conversations": [
            {
                "id": conversation.id,
                "shortId": short_id(conversation.id),
                "title": conversation.title,
                "createdAt": conversation.createdAt,
                "updatedAt": conversation.updatedAt,
            }
            for conversation in conversations
        ],
        "selectedConversationId": selected,
        "messages": [
            message
            for message in (safe_chat_message(item) for item in messages)
            if message is not None
        ],
        "memory": {
            "cards": memory_cards,
            "totalVisible": len(memory_cards),
            "query": memory_query,
            "compactDefault": True,
            "readOnly": True,
            "fullTextIncluded": False,
        },
        "trace": {
            "latest": latest_trace_payload,
            "recent": traces,
            "readOnly": True,
            "rawPromptIncluded": False,
            "rawModelOutputIncluded": False,
            "hiddenReasoningIncluded": False,
        },
        "provider": build_glitch_provider_payload(
            adapter,
            model_diagnostics,
            latest_trace_payload,
        ),
        "errors": build_glitch_error_items(latest_trace_payload),
        "windows": {
            "defaultTypes": ["core", "chat", "memory", "trace", "provider"],
            "temporaryTypes": ["error", "settings", "tasks", "tools", "system"],
            "persistentTypes": ["chat", "memory", "trace"],
            "layoutPersistence": "browser-local-storage",
        },
    }


def build_glitch_memory_cards(
    layout: RinDataLayout,
    *,
    query: str = "",
    limit: int = 40,
) -> list[dict[str, object]]:
    """Build safe, card-friendly memory summaries from SQLite read-only helpers."""
    safe_limit = max(1, min(limit, 80))
    cards = [
        build_glitch_trace_memory_card(trace)
        for trace in list_memory_v2_traces(layout, limit=safe_limit)
    ]
    cards.extend(
        build_glitch_legacy_memory_card(memory)
        for memory in list_legacy_memories(layout, limit=safe_limit)
    )
    normalized_query = query.strip().lower()
    if normalized_query:
        cards = [
            card
            for card in cards
            if normalized_query in str(card.get("searchText", "")).lower()
        ]
    return cards[:safe_limit]


def build_glitch_trace_memory_card(trace: object) -> dict[str, object]:
    """Serialize a Memory V2 trace as a safe HUD memory card."""
    item = safe_memory_trace_item(trace)
    trace_id = str(item["traceId"])
    signal_keys = item["signalKeys"] if isinstance(item["signalKeys"], list) else []
    preview = str(item["safePreview"])
    return {
        "id": trace_id,
        "shortId": str(item["traceShortId"]),
        "kind": "memory_v2_trace",
        "type": str(item["traceType"]),
        "title": f"Trace {item['traceShortId']}",
        "summary": "Safe Memory V2 trace metadata",
        "contentPreview": preview,
        "source": "memory_v2_traces",
        "sourceMessageId": str(item["sourceMessageId"]),
        "linkedSession": str(item["sourceShortId"]),
        "createdAt": str(item["createdAt"]),
        "updatedAt": str(item["updatedAt"]),
        "lastUsedAt": "n/a",
        "confidence": "n/a",
        "importance": "salience",
        "salienceScore": item["salienceScore"],
        "tags": signal_keys,
        "metadata": item,
        "readOnly": True,
        "fullTextIncluded": False,
        "searchText": (
            f"{trace_id} memory_v2_trace {item['traceType']} "
            f"{preview} {' '.join(signal_keys)}"
        ),
    }


def build_glitch_legacy_memory_card(memory: object) -> dict[str, object]:
    """Serialize a legacy memory item without exposing full raw memory JSON."""
    memory_id = str(getattr(memory, "id", "n/a"))
    metadata = getattr(memory, "metadata", None)
    content = getattr(memory, "content", {})
    tags = list(getattr(metadata, "tags", [])) if metadata is not None else []
    confidence = str(getattr(metadata, "confidence", "n/a"))
    importance = str(getattr(metadata, "importance", "n/a"))
    source = getattr(metadata, "source", None) if metadata is not None else None
    summary = legacy_memory_summary(content)
    return {
        "id": memory_id,
        "shortId": short_id(memory_id),
        "kind": "legacy_memory",
        "type": str(getattr(memory, "memoryType", "n/a")),
        "title": input_preview(summary or f"Memory {short_id(memory_id)}", limit=72),
        "summary": input_preview(summary or "Legacy memory metadata", limit=96),
        "contentPreview": input_preview(summary or "content preview hidden", limit=96),
        "source": str(source or "legacy_memory"),
        "sourceMessageId": str(getattr(memory, "sourceMessageId", "n/a")),
        "linkedSession": str(getattr(memory, "sourceMessageId", "n/a")),
        "createdAt": str(getattr(memory, "createdAt", "n/a")),
        "updatedAt": str(getattr(memory, "updatedAt", "n/a")),
        "lastUsedAt": "n/a",
        "confidence": confidence,
        "importance": importance,
        "salienceScore": "n/a",
        "tags": tags,
        "metadata": {
            "status": str(getattr(memory, "status", "n/a")),
            "reviewedAt": str(getattr(metadata, "reviewedAt", "n/a"))
            if metadata is not None
            else "n/a",
            "acceptedAt": str(getattr(metadata, "acceptedAt", "n/a"))
            if metadata is not None
            else "n/a",
        },
        "readOnly": True,
        "fullTextIncluded": False,
        "searchText": (
            f"{memory_id} legacy_memory {summary} "
            f"{' '.join(tags)} {confidence} {importance}"
        ),
    }


def legacy_memory_summary(content: object) -> str:
    """Return a bounded legacy memory summary using summary-like fields only."""
    if not isinstance(content, dict):
        return ""
    for key in ("title", "summary", "safeSummary", "name", "label"):
        value = content.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    keys = sorted(str(key) for key in content)
    return f"fields: {', '.join(keys[:8])}" if keys else ""


def build_glitch_provider_payload(
    adapter: ModelAdapterProtocol,
    model_diagnostics: dict[str, object],
    latest_trace: dict[str, object] | None,
) -> dict[str, object]:
    """Build provider status/config data without secret values."""
    last_error = "n/a"
    if latest_trace and latest_trace.get("status") == "failed":
        last_error = str(latest_trace.get("errorCode", "unknown"))
    return {
        "activeProvider": model_diagnostics.get("provider", "local"),
        "activeAdapter": adapter.id,
        "activeModel": model_diagnostics.get("model", "n/a"),
        "configured": bool(adapter.id),
        "streamingSupport": "not configured",
        "health": "error" if last_error != "n/a" else "ok",
        "lastLatencyMs": provider_latency_from_trace(latest_trace),
        "lastError": last_error,
        "availableProviders": [
            {
                "id": "rin-mock-local",
                "provider": "local",
                "configured": True,
                "secretRequired": False,
            },
            {
                "id": "rin-ollama-local",
                "provider": "local",
                "configured": True,
                "secretRequired": False,
            },
        ],
        "safeConfig": {
            "baseUrl": model_diagnostics.get("baseUrl", "n/a"),
            "timeoutMs": model_diagnostics.get("timeoutMs", "n/a"),
            "numPredict": model_diagnostics.get("numPredict", "n/a"),
            "temperature": model_diagnostics.get("temperature", "n/a"),
            "topP": model_diagnostics.get("topP", "n/a"),
            "apiKeyIncluded": False,
            "secretValuesIncluded": False,
        },
    }


def provider_latency_from_trace(trace: dict[str, object] | None) -> object:
    """Extract the latest provider latency from safe trace metadata when available."""
    if trace is None:
        return "n/a"
    stages = trace.get("stages", [])
    if not isinstance(stages, list):
        return "n/a"
    for stage in stages:
        if not isinstance(stage, dict) or stage.get("name") != "raw_model_response":
            continue
        operation = stage.get("operation", {})
        if isinstance(operation, dict):
            return operation.get("durationMs", "n/a")
    return "n/a"


def build_glitch_error_items(
    latest_trace: dict[str, object] | None,
) -> list[dict[str, object]]:
    """Build displayable error items from safe runtime trace metadata."""
    if latest_trace is None or latest_trace.get("status") != "failed":
        return []
    code = str(latest_trace.get("errorCode", "RUNTIME_ERROR"))
    stages = latest_trace.get("stages", [])
    last_step = "n/a"
    if isinstance(stages, list) and stages:
        maybe_stage = stages[-1]
        if isinstance(maybe_stage, dict):
            fallback_name = maybe_stage.get("name", "n/a")
            last_step = str(maybe_stage.get("displayName", fallback_name))
    severity = "critical" if code == "MODEL_RESPONSE_INVALID" else "error"
    return [
        {
            "id": f"trace-{latest_trace.get('turnShortId', 'latest')}-{code}",
            "code": code,
            "severity": severity,
            "module": "conversation-runtime",
            "message": "Latest runtime turn failed. Safe metadata only.",
            "lastStep": last_step,
            "turnId": latest_trace.get("turnId", "n/a"),
            "traceAvailable": True,
            "rawModelOutputIncluded": False,
            "hiddenReasoningIncluded": False,
        }
    ]


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
            "staticPresenceAsset": "/picture/rin-core-background.png",
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


def require_message_content(content: str) -> None:
    """Raise HTTP 400 when a write request has no message body."""
    if not content.strip():
        raise HTTPException(status_code=400, detail="Message content is required.")


def require_existing_conversation(layout: RinDataLayout, conversation_id: str) -> None:
    """Raise HTTP 404 when a write targets a missing conversation."""
    if get_conversation(layout, conversation_id) is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "CONVERSATION_NOT_FOUND",
                "message": "Conversation not found.",
            },
        )
