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
    list_messages,
)
from rin.diagnostics.readiness import build_python_readiness_report
from rin.diagnostics.runtime_trace import RUNTIME_TRACE_STORE, safe_trace_response
from rin.diagnostics.safety import assert_safe_python_write_data_dir
from rin.profiles import build_profile_report
from rin.storage import RinDataLayout

SERVER_DIR = Path(__file__).parent
REPO_ROOT = SERVER_DIR.parents[3]
TEMPLATES = Jinja2Templates(directory=SERVER_DIR / "templates")
STATIC_DIR = SERVER_DIR / "static"
PUBLIC_LIVE2D_DIR = REPO_ROOT / "public" / "live2d"


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
        "memory": {
            "mode": "diagnostics-memory",
            "readOnly": True,
            "fullTextIncluded": False,
            "memoryV2Traces": database["memoryV2Traces"],
            "messageMemoryContexts": database.get("messageMemoryContexts", "n/a"),
            "available": memory_context.get("available") is True,
            "privacy": "counts and metadata only; no full memory text",
            "retentionSummary": (
                "Memory V2 traces are inspected by count only in this console."
            ),
        },
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
            "backupDirPresent": (REPO_ROOT / ".rin-python-backups").is_dir(),
            "pythonCutoverMarkerPresent": (
                Path(str(layout.rootDir)) / "config" / "python_cutover_marker.json"
            ).is_file(),
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
