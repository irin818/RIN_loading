"""FastAPI application factory with UI, API, and diagnostics routes.

Creates a FastAPI app wired to a RinDataLayout, optional model adapter, and optional
clock.
Routes are grouped into: UI rendering, readiness/state, diagnostics, conversation/chat,
profile/memory status, and safe serialization helpers.
"""

from __future__ import annotations

import math
import re
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import cast

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, ConfigDict

from rin.body import build_body_report
from rin.body.state_assets import (
    BodyCurrentStateBody,
    delete_body_state,
    get_body_state_file,
    list_body_states,
    read_current_state,
    restore_default_states,
    store_uploaded_body_state,
    write_current_state,
)
from rin.config.chat_provider import (
    ChatProviderConfig,
    CostConfig,
    load_chat_provider_config,
    load_cost_config,
)
from rin.contracts import ModelRequest, ModelResponse, ModelResponseMetadata
from rin.conversation import ModelAdapterProtocol, RuntimeClock, run_conversation_turn
from rin.database import (
    ApiUsageEventRecord,
    create_conversation,
    create_self_review_report_record,
    get_conversation,
    get_improvement_proposal,
    get_latest_mind_snapshot,
    get_mind_snapshot_for_turn,
    inspect_database,
    list_api_usage_events,
    list_audit_summaries,
    list_conversations,
    list_improvement_proposals,
    list_legacy_memories,
    list_memory_embeddings,
    list_memory_v2_traces,
    list_messages,
    list_mind_memory_candidates,
    list_recent_mind_snapshots,
    list_rin_growth_events,
    list_self_review_reports,
    list_tool_invocation_requests,
    summarize_api_usage,
    update_improvement_proposal_status,
    update_memory_candidate_review,
    update_memory_candidate_safe_fields,
    update_rin_growth_event_review,
    update_tool_invocation_request_status,
)
from rin.diagnostics.readiness import build_python_readiness_report
from rin.diagnostics.runtime_trace import (
    RUNTIME_TRACE_STORE,
    input_preview,
    safe_trace_response,
    short_id,
)
from rin.diagnostics.safety import assert_safe_python_write_data_dir
from rin.mind import RinMindSnapshot, load_mind_policy
from rin.model import create_api_chat_adapter_from_env
from rin.model.sanitizer import sanitize_assistant_content_details
from rin.model.usage import (
    PROVIDER_USAGE_METHOD,
    TOKEN_ESTIMATE_HEURISTIC,
    estimate_cost_range,
)
from rin.profiles import build_profile_report
from rin.server.archive_assets import (
    ArchiveAssetPatchBody,
    ArchiveStoryContentBody,
    delete_archive_asset,
    get_archive_asset_file,
    get_archive_asset_preview_file,
    get_archive_asset_thumbnail_file,
    get_archive_story,
    list_archive_assets,
    patch_archive_asset,
    save_archive_story,
    store_uploaded_archive_asset,
)
from rin.server.character_assets import (
    CharacterViewPayload,
    WelcomeCharacterSelectionPayload,
    delete_character_asset,
    get_character_asset_file,
    list_character_assets,
    reset_character_asset_view,
    reset_welcome_character_asset,
    restore_character_defaults,
    save_character_asset_view,
    select_welcome_character_asset,
    store_uploaded_character_asset,
)
from rin.storage import RinDataLayout
from rin.version import __version__

SERVER_DIR = Path(__file__).parent
REPO_ROOT = SERVER_DIR.parents[3]
TEMPLATES = Jinja2Templates(directory=SERVER_DIR / "templates")
STATIC_DIR = SERVER_DIR / "static"
PUBLIC_BODY_DIR = REPO_ROOT / "public" / "body"
FRONTEND_DIST_DIR = REPO_ROOT / "frontend" / "dist"
FRONTEND_INDEX = FRONTEND_DIST_DIR / "index.html"
FRONTEND_ASSETS_DIR = FRONTEND_DIST_DIR / "assets"
FRONTEND_PUBLIC_PICTURE_DIR = REPO_ROOT / "frontend" / "public" / "picture"
FRONTEND_DIST_PICTURE_DIR = FRONTEND_DIST_DIR / "picture"
BODY_DEFAULT_AVATAR_ASSET_PATH = "/body-assets/rin/states/默认.png"
SECRET_LIKE_PATTERNS = (
    re.compile(r"sk-[A-Za-z0-9_-]{12,}", re.IGNORECASE),
    re.compile(r"github_pat_[A-Za-z0-9_]{12,}", re.IGNORECASE),
    re.compile(r"ghp_[A-Za-z0-9_]{12,}", re.IGNORECASE),
    re.compile(r"xox[baprs]-[A-Za-z0-9-]{12,}", re.IGNORECASE),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----", re.IGNORECASE),
    re.compile(
        r"\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|secret)\b",
        re.IGNORECASE,
    ),
)


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


class MemoryCandidateSafePatchBody(BaseModel):
    """Safe editable fields for a memory candidate. Raw source text is not accepted."""

    model_config = ConfigDict(extra="forbid")

    safeSummary: str | None = None
    normalizedValue: str | None = None
    tags: list[str] | None = None


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
    Test-only adapter used by unit tests. It is never selected as production fallback.
    """

    id = "rin-mock-test"

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

    If no adapter is provided, the external API adapter is constructed from
    environment config. Missing API config fails safely at chat-call time.
    """
    app = FastAPI(title="RIN Python Compatibility API", version="0.0.0")
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    if FRONTEND_ASSETS_DIR.is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=FRONTEND_ASSETS_DIR),
            name="frontend-assets",
        )
        app.mount(
            "/glitch-core/assets",
            StaticFiles(directory=FRONTEND_ASSETS_DIR),
            name="glitch-core-assets",
        )
    if PUBLIC_BODY_DIR.is_dir():
        app.mount(
            "/body-assets",
            StaticFiles(directory=PUBLIC_BODY_DIR),
            name="body-assets",
        )
    _picture_dir = (
        FRONTEND_PUBLIC_PICTURE_DIR
        if FRONTEND_PUBLIC_PICTURE_DIR.is_dir()
        else FRONTEND_DIST_PICTURE_DIR
    )
    if _picture_dir.is_dir():
        app.mount(
            "/picture",
            StaticFiles(directory=_picture_dir),
            name="picture",
        )
    selected_adapter = cast(
        ModelAdapterProtocol,
        adapter or create_api_chat_adapter_from_env(),
    )
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

    @app.get("/body", response_class=HTMLResponse)
    def body_index() -> Response:
        return render_glitch_core_entry()

    @app.get("/body/floating", response_class=HTMLResponse)
    def body_floating() -> Response:
        return render_glitch_core_entry()

    @app.get("/comics", response_class=HTMLResponse)
    @app.get("/comics/{spa_path:path}", response_class=HTMLResponse)
    @app.get("/games", response_class=HTMLResponse)
    @app.get("/games/{spa_path:path}", response_class=HTMLResponse)
    @app.get("/library", response_class=HTMLResponse)
    @app.get("/library/{spa_path:path}", response_class=HTMLResponse)
    @app.get("/archive", response_class=HTMLResponse)
    @app.get("/archive/{spa_path:path}", response_class=HTMLResponse)
    @app.get("/portfolio", response_class=HTMLResponse)
    @app.get("/admin/archive", response_class=HTMLResponse)
    def reserved_web_shell_spa(spa_path: str = "") -> Response:
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

    @app.get("/api/console/data-map")
    def api_console_data_map() -> dict[str, object]:
        return build_console_data_map_payload()

    @app.get("/api/body/character-assets")
    def api_body_character_assets(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return list_character_assets(current_layout)

    @app.post("/api/body/character-assets")
    async def api_body_character_asset_upload(
        request: Request,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return await store_uploaded_character_asset(current_layout, request)

    @app.post("/api/body/character-assets/welcome")
    async def api_body_welcome_character_asset_upload(
        request: Request,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return await store_uploaded_character_asset(
            current_layout,
            request,
            select_for_welcome=True,
        )

    @app.put("/api/body/character-assets/welcome")
    def api_body_welcome_character_asset_select(
        body: WelcomeCharacterSelectionPayload,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return select_welcome_character_asset(current_layout, body.assetId)

    @app.delete("/api/body/character-assets/welcome")
    def api_body_welcome_character_asset_reset(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return reset_welcome_character_asset(current_layout)

    @app.delete("/api/body/character-assets/{asset_id}")
    def api_body_character_asset_delete(
        asset_id: str,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return delete_character_asset(current_layout, asset_id)

    @app.post("/api/body/character-assets/defaults/restore")
    def api_body_character_defaults_restore(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return restore_character_defaults(current_layout)

    @app.put("/api/body/character-assets/{asset_id}/view")
    def api_body_character_asset_view_save(
        asset_id: str,
        body: CharacterViewPayload,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return save_character_asset_view(current_layout, asset_id, body)

    @app.delete("/api/body/character-assets/{asset_id}/view")
    def api_body_character_asset_view_reset(
        asset_id: str,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return reset_character_asset_view(current_layout, asset_id)

    @app.get("/api/body/character-assets/files/{asset_id}")
    def api_body_character_asset_file(
        asset_id: str,
        current_layout: RinDataLayout = layout_dependency,
    ) -> FileResponse:
        path, media_type = get_character_asset_file(current_layout, asset_id)
        return FileResponse(path, media_type=media_type)

    @app.get("/api/body/state-assets")
    def api_body_state_assets(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return list_body_states(current_layout)

    @app.post("/api/body/state-assets")
    async def api_body_state_asset_upload(
        request: Request,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return await store_uploaded_body_state(current_layout, request)

    @app.delete("/api/body/state-assets/{state_id}")
    def api_body_state_asset_delete(
        state_id: str,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return delete_body_state(current_layout, state_id)

    @app.post("/api/body/state-assets/defaults/restore")
    def api_body_state_defaults_restore(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return restore_default_states(current_layout)

    @app.get("/api/body/state-assets/files/{state_id}")
    def api_body_state_asset_file(
        state_id: str,
        current_layout: RinDataLayout = layout_dependency,
    ) -> FileResponse:
        path, media_type = get_body_state_file(current_layout, state_id)
        return FileResponse(path, media_type=media_type)

    @app.put("/api/body/current-state")
    def api_body_current_state_set(
        payload: BodyCurrentStateBody,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        write_current_state(current_layout, payload.stateId)
        return build_body_report(current_layout).to_dict()

    @app.get("/api/body/current-state")
    def api_body_current_state_get(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return {"ok": True, "stateId": read_current_state(current_layout)}

    # ---- Archive asset management ----
    @app.get("/api/archive/assets")
    def api_archive_assets_list(
        type: str | None = None,
        status: str | None = None,
        tag: str | None = None,
        category: str | None = None,
        q: str | None = None,
        seriesId: str | None = None,
        limit: int | None = None,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return list_archive_assets(
            current_layout,
            asset_type=type,
            status=status,
            tag=tag,
            category=category,
            q=q,
            series_id=seriesId,
            limit=limit,
        )

    @app.post("/api/archive/assets")
    async def api_archive_asset_upload(
        request: Request,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return await store_uploaded_archive_asset(current_layout, request)

    @app.patch("/api/archive/assets/{asset_id}")
    def api_archive_asset_patch(
        asset_id: str,
        body: ArchiveAssetPatchBody,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return patch_archive_asset(current_layout, asset_id, body)

    @app.delete("/api/archive/assets/{asset_id}")
    def api_archive_asset_delete(
        asset_id: str,
        hard: bool = False,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return delete_archive_asset(current_layout, asset_id, hard=hard)

    @app.get("/api/archive/assets/files/{asset_id}")
    def api_archive_asset_file(
        asset_id: str,
        current_layout: RinDataLayout = layout_dependency,
    ) -> FileResponse:
        path, media_type = get_archive_asset_file(current_layout, asset_id)
        return FileResponse(path, media_type=media_type)

    @app.get("/api/archive/assets/previews/{asset_id}")
    def api_archive_asset_preview(
        asset_id: str,
        current_layout: RinDataLayout = layout_dependency,
    ) -> FileResponse:
        path, media_type = get_archive_asset_preview_file(current_layout, asset_id)
        return FileResponse(path, media_type=media_type)

    @app.get("/api/archive/assets/thumbnails/{asset_id}")
    def api_archive_asset_thumbnail(
        asset_id: str,
        current_layout: RinDataLayout = layout_dependency,
    ) -> FileResponse:
        path, media_type = get_archive_asset_thumbnail_file(current_layout, asset_id)
        return FileResponse(path, media_type=media_type)

    @app.get("/api/archive/stories/{story_id}")
    def api_archive_story_get(
        story_id: str,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return get_archive_story(current_layout, story_id)

    @app.put("/api/archive/stories/{story_id}")
    def api_archive_story_save(
        story_id: str,
        body: ArchiveStoryContentBody,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        return save_archive_story(current_layout, story_id, body)

    @app.get("/api/cost/summary")
    def api_cost_summary(
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> dict[str, object]:
        return build_cost_summary_payload(current_layout, current_adapter)

    @app.get("/api/cost/recent")
    def api_cost_recent(
        limit: int = 20,
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> dict[str, object]:
        return build_cost_recent_payload(current_layout, current_adapter, limit=limit)

    @app.get("/api/mind/latest")
    def api_mind_latest(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return build_mind_latest_payload(current_layout)

    @app.get("/api/mind/turn/{turn_id}")
    def api_mind_turn(
        turn_id: str,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        snapshot = get_mind_snapshot_for_turn(current_layout, turn_id)
        if snapshot is None:
            raise HTTPException(status_code=404, detail="RIN Mind snapshot not found.")
        return build_mind_snapshot_response(snapshot)

    @app.get("/api/mind/memory-candidates")
    def api_mind_memory_candidates(
        limit: int = 50,
        reviewStatus: str | None = None,
        type: str | None = None,
        riskLevel: str | None = None,
        active: bool | None = None,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        candidates = list_mind_memory_candidates(
            current_layout,
            limit=limit,
            review_status=reviewStatus,
            candidate_type=type,
            risk_level=riskLevel,
            active=active,
        )
        return {
            "ok": True,
            "mode": "rin-mind-memory-candidates",
            "readOnly": True,
            "localOnly": True,
            "candidates": [item.model_dump(mode="json") for item in candidates],
            "rawTextIncluded": False,
            "secretValuesIncluded": False,
        }

    @app.get("/api/mind/analytics")
    def api_mind_analytics(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return build_mind_analytics_payload(current_layout)

    @app.get("/api/mind/memory-analytics")
    def api_mind_memory_analytics(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return build_memory_analytics_payload(current_layout)

    @app.get("/api/mind/memory-candidates/{candidate_id}/analytics")
    def api_mind_memory_candidate_analytics(
        candidate_id: str,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        payload = build_memory_candidate_analytics_payload(
            current_layout,
            candidate_id,
        )
        if payload is None:
            raise HTTPException(status_code=404, detail="Memory candidate not found.")
        return payload

    @app.get("/api/mind/context-analytics")
    def api_mind_context_analytics(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return build_context_analytics_payload(current_layout)

    @app.get("/api/mind/owner-state-trend")
    def api_mind_owner_state_trend(
        limit: int = 20,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return build_owner_state_trend_payload(current_layout, limit=limit)

    @app.get("/api/mind/trace-analytics")
    def api_mind_trace_analytics() -> dict[str, object]:
        return build_trace_analytics_payload()

    @app.get("/api/mind/cognition-flow/latest")
    def api_mind_cognition_flow_latest(
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return build_cognition_flow_payload(current_layout)

    @app.get("/api/mind/cognition-flow/{turn_id}")
    def api_mind_cognition_flow_turn(
        turn_id: str,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        payload = build_cognition_flow_payload(current_layout, turn_id=turn_id)
        if payload["traceAvailable"] is False and payload["snapshotAvailable"] is False:
            raise HTTPException(status_code=404, detail="Cognition flow not found.")
        return payload

    @app.get("/api/config/registry")
    def api_config_registry(
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> dict[str, object]:
        return build_config_registry_payload(current_layout, current_adapter)

    @app.patch("/api/mind/memory-candidates/{candidate_id}")
    def api_mind_memory_candidate_patch(
        candidate_id: str,
        body: MemoryCandidateSafePatchBody,
        current_layout: RinDataLayout = layout_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        updates = validate_memory_candidate_safe_patch(body)
        result = update_memory_candidate_safe_fields(
            current_layout,
            candidate_id=candidate_id,
            updates=updates,
            now=current_clock.now(),
        )
        if result == "missing":
            raise HTTPException(status_code=404, detail="Memory candidate not found.")
        if result == "blocked":
            raise HTTPException(
                status_code=409,
                detail="Blocked memory candidate cannot be edited.",
            )
        if result == "no_changes":
            raise HTTPException(status_code=400, detail="No safe edit fields provided.")
        return build_memory_candidate_action_response(current_layout, candidate_id)

    @app.post("/api/mind/memory-candidates/{candidate_id}/approve")
    def api_mind_memory_candidate_approve(
        candidate_id: str,
        current_layout: RinDataLayout = layout_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        updated = update_memory_candidate_review(
            current_layout,
            candidate_id=candidate_id,
            review_status="owner_approved",
            active=True,
            owner_confirmed=True,
            now=current_clock.now(),
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Memory candidate not found.")
        return build_memory_candidate_action_response(current_layout, candidate_id)

    @app.post("/api/mind/memory-candidates/{candidate_id}/deactivate")
    def api_mind_memory_candidate_deactivate(
        candidate_id: str,
        current_layout: RinDataLayout = layout_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        updated = update_memory_candidate_review(
            current_layout,
            candidate_id=candidate_id,
            review_status="inactive",
            active=False,
            owner_confirmed=False,
            now=current_clock.now(),
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Memory candidate not found.")
        return build_memory_candidate_action_response(current_layout, candidate_id)

    @app.post("/api/mind/memory-candidates/{candidate_id}/reactivate")
    def api_mind_memory_candidate_reactivate(
        candidate_id: str,
        current_layout: RinDataLayout = layout_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        existing = next(
            (
                item
                for item in list_mind_memory_candidates(current_layout, limit=100)
                if item.id == candidate_id
            ),
            None,
        )
        if existing is None:
            raise HTTPException(status_code=404, detail="Memory candidate not found.")
        if existing.riskLevel == "blocked":
            raise HTTPException(
                status_code=409,
                detail="Blocked memory candidate cannot be reactivated.",
            )
        updated = update_memory_candidate_review(
            current_layout,
            candidate_id=candidate_id,
            review_status="candidate",
            active=True,
            owner_confirmed=False,
            now=current_clock.now(),
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Memory candidate not found.")
        return build_memory_candidate_action_response(current_layout, candidate_id)

    @app.get("/api/mind/growth-events")
    def api_mind_growth_events(
        limit: int = 50,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return {
            "ok": True,
            "mode": "rin-mind-growth-events",
            "readOnly": True,
            "localOnly": True,
            "events": [
                item.model_dump(mode="json")
                for item in list_rin_growth_events(current_layout, limit=limit)
            ],
            "rawTextIncluded": False,
            "secretValuesIncluded": False,
        }

    @app.get("/api/mind/tool-requests")
    def api_mind_tool_requests(
        limit: int = 50,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return {
            "ok": True,
            "mode": "rin-mind-tool-requests",
            "readOnly": True,
            "localOnly": True,
            "requests": [
                item.model_dump(mode="json")
                for item in list_tool_invocation_requests(
                    current_layout,
                    limit=limit,
                )
            ],
            "executionEnabled": False,
            "rawInputIncluded": False,
            "secretValuesIncluded": False,
        }

    @app.post("/api/mind/growth-events/{event_id}/approve")
    def api_mind_growth_event_approve(
        event_id: str,
        current_layout: RinDataLayout = layout_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        updated = update_rin_growth_event_review(
            current_layout,
            event_id=event_id,
            review_status="owner_approved",
            active=True,
            now=current_clock.now(),
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Growth event not found.")
        return build_growth_event_action_response(current_layout, event_id)

    @app.post("/api/mind/growth-events/{event_id}/reject")
    def api_mind_growth_event_reject(
        event_id: str,
        current_layout: RinDataLayout = layout_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        updated = update_rin_growth_event_review(
            current_layout,
            event_id=event_id,
            review_status="rejected",
            active=False,
            now=current_clock.now(),
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Growth event not found.")
        return build_growth_event_action_response(current_layout, event_id)

    @app.post("/api/mind/tool-requests/{request_id}/approve")
    def api_mind_tool_request_approve(
        request_id: str,
        current_layout: RinDataLayout = layout_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        updated = update_tool_invocation_request_status(
            current_layout,
            request_id=request_id,
            status="approved",
            now=current_clock.now(),
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Tool request not found.")
        return build_tool_request_action_response(current_layout, request_id)

    @app.post("/api/mind/tool-requests/{request_id}/reject")
    def api_mind_tool_request_reject(
        request_id: str,
        current_layout: RinDataLayout = layout_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        updated = update_tool_invocation_request_status(
            current_layout,
            request_id=request_id,
            status="rejected",
            now=current_clock.now(),
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Tool request not found.")
        return build_tool_request_action_response(current_layout, request_id)

    @app.post("/api/mind/memory-candidates/{candidate_id}/reject")
    def api_mind_memory_candidate_reject(
        candidate_id: str,
        current_layout: RinDataLayout = layout_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        updated = update_memory_candidate_review(
            current_layout,
            candidate_id=candidate_id,
            review_status="rejected",
            active=False,
            owner_confirmed=False,
            now=current_clock.now(),
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Memory candidate not found.")
        return build_memory_candidate_action_response(current_layout, candidate_id)

    @app.get("/api/self-review/reports")
    def api_self_review_reports(
        limit: int = 20,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return build_self_review_reports_payload(current_layout, limit=limit)

    @app.post("/api/self-review/run")
    def api_self_review_run(
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        draft = build_manual_self_review_draft(current_layout, current_adapter)
        report_id = create_self_review_report_record(
            current_layout,
            summary=str(draft["summary"]),
            observations=cast(list[dict[str, object]], draft["observations"]),
            proposals=cast(list[dict[str, object]], draft["proposals"]),
            risk_level=str(draft["riskLevel"]),
            status=str(draft["status"]),
            now=current_clock.now(),
        )
        return build_self_review_reports_payload(
            current_layout,
            limit=20,
            latest_report_id=report_id,
        )

    @app.get("/api/improvement-proposals")
    def api_improvement_proposals(
        limit: int = 50,
        current_layout: RinDataLayout = layout_dependency,
    ) -> dict[str, object]:
        return build_improvement_proposals_payload(current_layout, limit=limit)

    @app.post("/api/improvement-proposals/{proposal_id}/approve")
    def api_improvement_proposal_approve(
        proposal_id: str,
        current_layout: RinDataLayout = layout_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        updated = update_improvement_proposal_status(
            current_layout,
            proposal_id=proposal_id,
            status="approved",
            now=current_clock.now(),
        )
        if not updated:
            raise HTTPException(
                status_code=404, detail="Improvement proposal not found."
            )
        return build_improvement_proposal_action_response(current_layout, proposal_id)

    @app.post("/api/improvement-proposals/{proposal_id}/reject")
    def api_improvement_proposal_reject(
        proposal_id: str,
        current_layout: RinDataLayout = layout_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        updated = update_improvement_proposal_status(
            current_layout,
            proposal_id=proposal_id,
            status="rejected",
            now=current_clock.now(),
        )
        if not updated:
            raise HTTPException(
                status_code=404, detail="Improvement proposal not found."
            )
        return build_improvement_proposal_action_response(current_layout, proposal_id)

    @app.post("/api/improvement-proposals/{proposal_id}/convert-to-codex-draft")
    def api_improvement_proposal_convert(
        proposal_id: str,
        current_layout: RinDataLayout = layout_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> dict[str, object]:
        reject_unsafe_write_layout(current_layout)
        proposal = get_improvement_proposal(current_layout, proposal_id)
        if proposal is None:
            raise HTTPException(
                status_code=404, detail="Improvement proposal not found."
            )
        draft = build_codex_prompt_draft(proposal.model_dump(mode="json"))
        updated = update_improvement_proposal_status(
            current_layout,
            proposal_id=proposal_id,
            status="converted_to_codex_task",
            codex_prompt_draft=draft,
            now=current_clock.now(),
        )
        if not updated:
            raise HTTPException(
                status_code=404, detail="Improvement proposal not found."
            )
        return build_improvement_proposal_action_response(current_layout, proposal_id)

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
    Serialize a message for chat UI while blocking legacy hidden-reasoning leaks.
    """
    if message is None:
        return None
    role = str(getattr(message, "role", "n/a"))
    content = str(getattr(message, "content", ""))
    hidden_reasoning_redacted = False
    full_text_included = True
    if role == "rin":
        sanitized = sanitize_assistant_content_details(content)
        if sanitized.rejected:
            content = "[RIN reply hidden: unsafe reasoning-like content was redacted.]"
            hidden_reasoning_redacted = True
            full_text_included = False
        elif sanitized.removed:
            content = sanitized.content
            hidden_reasoning_redacted = True
            full_text_included = False
    return {
        "id": getattr(message, "id", "n/a"),
        "shortId": short_id(str(getattr(message, "id", ""))),
        "role": role,
        "content": content,
        "createdAt": getattr(message, "createdAt", "n/a"),
        "fullTextIncluded": full_text_included,
        "hiddenReasoningIncluded": False,
        "hiddenReasoningRedacted": hidden_reasoning_redacted,
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
    body_report = build_body_report(layout).to_dict()
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
    chat_config = active_chat_config(adapter)
    model_name = getattr(adapter, "model", chat_config.model)
    local_model_status = "not active"
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
        "avatar_asset_path": BODY_DEFAULT_AVATAR_ASSET_PATH,
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
        "avatar_asset_path": BODY_DEFAULT_AVATAR_ASSET_PATH,
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
    cost_payload = build_cost_summary_payload(layout, adapter)
    mind_payload = build_mind_latest_payload(layout)
    data_map_payload = build_console_data_map_payload()
    cognition_flow_payload = build_cognition_flow_payload(layout)
    config_registry_payload = build_config_registry_payload(layout, adapter)
    self_review_payload = build_self_review_reports_payload(layout)
    improvement_proposals_payload = build_improvement_proposals_payload(layout)
    memory_cards = build_glitch_memory_cards(layout, query=memory_query, limit=40)
    latest_trace = RUNTIME_TRACE_STORE.latest()
    latest_trace_payload = latest_trace.to_safe_dict() if latest_trace else None
    traces = [trace.to_safe_dict() for trace in RUNTIME_TRACE_STORE.list()]
    readiness = cast(dict[str, object], dashboard["readiness"])
    body_report = build_body_report(layout).to_dict()
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
                "Replace the core background image at "
                "frontend/public/picture/rin-core-background.png."
            ),
            "activeBodyRenderer": "simple-state-image",
            "bodyRendererLabel": "Body",
            "bodyManifestPath": "/body-assets/rin/manifest.json",
            "animationEnabledByDefault": True,
        },
        "body": body_report,
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
        "cost": cost_payload,
        "mind": mind_payload,
        "cognitionFlow": cognition_flow_payload,
        "configRegistry": config_registry_payload,
        "selfReview": self_review_payload,
        "improvementProposals": improvement_proposals_payload,
        "dataMap": data_map_payload,
        "errors": build_glitch_error_items(latest_trace_payload),
        "windows": {
            "defaultTypes": [
                "chat",
                "memory",
                "body",
                "settings",
            ],
            "advancedTypes": ["tasks", "developer"],
            "temporaryTypes": ["error", "memoryDetail"],
            "persistentTypes": ["chat", "memory", "tasks", "body", "settings"],
            "layoutPersistence": "browser-local-storage",
        },
    }


def build_console_data_map_payload() -> dict[str, object]:
    """Return a safe registry of backend data blocks for the governance dashboard."""
    domains = [
        {"id": "core-health", "label": "Core / Health", "color": "green"},
        {"id": "conversation", "label": "Conversation", "color": "green"},
        {"id": "mind", "label": "Mind", "color": "cyan"},
        {"id": "memory", "label": "Memory", "color": "green"},
        {"id": "context", "label": "Context", "color": "blue"},
        {"id": "runtime-trace", "label": "Runtime Trace", "color": "amber"},
        {"id": "cost-usage", "label": "Cost / Usage", "color": "purple"},
        {"id": "provider", "label": "Provider", "color": "cyan"},
        {"id": "growth-self-model", "label": "Growth / Self-model", "color": "amber"},
        {
            "id": "control-tool-proposal",
            "label": "Control / Tool Proposal",
            "color": "amber",
        },
        {"id": "database-storage", "label": "Database / Storage", "color": "green"},
        {"id": "profiles", "label": "Profiles", "color": "cyan"},
        {"id": "errors", "label": "Errors", "color": "red"},
        {"id": "cognition-flow", "label": "Cognition Flow", "color": "cyan"},
        {"id": "config-registry", "label": "Config Registry", "color": "blue"},
        {"id": "self-review", "label": "Self-review", "color": "amber"},
        {
            "id": "improvement-proposals",
            "label": "Improvement Proposals",
            "color": "purple",
        },
    ]
    blocks = [
        data_block(
            "readiness-state",
            "Readiness and core state",
            "core-health",
            "/readiness, /state, /api/glitch-core/snapshot.dashboard",
            "rin.diagnostics.readiness, build_status_dashboard_summary",
            "readiness, health flags, schema version, counts",
            "Settings / Developer",
            "status cards",
            data_completeness="complete",
        ),
        data_block(
            "conversation-messages",
            "Conversation messages",
            "conversation",
            "/api/glitch-core/snapshot.messages",
            "list_conversations, list_messages, safe_chat_message",
            "selected conversation, role, bounded content, timestamps",
            "Chat",
            "message timeline",
            writable=True,
            control_actions=["send owner message"],
            notes=(
                "Chat messages intentionally show conversation content "
                "inside Chat only."
            ),
        ),
        data_block(
            "mind-latest",
            "Latest RIN Mind snapshot",
            "mind",
            "/api/mind/latest",
            "build_mind_latest_payload",
            "message understanding, owner state, response plan, lifecycle",
            "Developer",
            "cards, bars, trend table",
        ),
        data_block(
            "memory-candidates",
            "Memory candidates",
            "memory",
            "/api/mind/memory-candidates",
            "list_mind_memory_candidates",
            "safeSummary, normalizedValue, risk, review, active state",
            "Memory",
            "review table, strength ranking, forgetting curve",
            writable=True,
            control_actions=[
                "approve",
                "reject",
                "deactivate",
                "reactivate",
                "edit safe fields",
            ],
        ),
        data_block(
            "memory-analytics",
            "Memory analytics",
            "memory",
            "/api/mind/memory-analytics",
            "build_memory_analytics_payload",
            "counts, distributions, derived strength, thresholds",
            "Memory",
            "stacked bars, curve, timeline",
            data_completeness="partial",
            notes="Forgetting history depends on available audit/retrieval events.",
        ),
        data_block(
            "context-analytics",
            "Context plan analytics",
            "context",
            "/api/mind/context-analytics",
            "build_context_analytics_payload",
            "context flow, budget, selected/excluded safe sources",
            "Developer",
            "flow diagram, budget bar, source table",
            data_completeness="partial",
        ),
        data_block(
            "runtime-trace",
            "Runtime trace",
            "runtime-trace",
            "/api/diagnostics/runtime-trace/latest, /api/mind/trace-analytics",
            "safe_trace_response, build_trace_analytics_payload",
            "pipeline stages, durations, status, warnings/errors",
            "Developer",
            "timeline and duration bars",
            data_completeness="partial",
        ),
        data_block(
            "cost-usage",
            "Cost and token usage",
            "cost-usage",
            "/api/cost/summary, /api/cost/recent",
            "summarize_api_usage, build_cost_summary_payload",
            "token counts, DeepSeek pricing profile, estimate range",
            "Settings / Developer",
            "token bars, cost trend, range explanation",
            data_completeness="estimate",
            notes=(
                "cost.cacheBreakdownAvailable may be false; official exact "
                "cost can be unavailable."
            ),
        ),
        data_block(
            "provider-config",
            "Provider safe config",
            "provider",
            "/api/glitch-core/snapshot.provider",
            "active_chat_config, build_glitch_provider_payload",
            "configured state, safe base URL, model, missing env names",
            "Settings / Developer",
            "status cards",
            data_completeness="provider_dependent",
            notes="API key presence only; key value is never exposed or editable.",
        ),
        data_block(
            "growth-events",
            "Growth review events",
            "growth-self-model",
            "/api/mind/growth-events",
            "list_rin_growth_events",
            "safe summary, risk, review status, source short ids",
            "Tasks",
            "review queue and distribution",
            writable=True,
            control_actions=["approve", "reject"],
            data_completeness="partial",
        ),
        data_block(
            "tool-proposals",
            "Tool proposals",
            "control-tool-proposal",
            "/api/mind/tool-requests",
            "list_tool_invocation_requests",
            "intent, toolName, actionSummary, risk, approval status",
            "Tasks",
            "proposal queue",
            writable=True,
            control_actions=["approve proposal", "reject proposal"],
            data_completeness="partial",
            notes="Execution remains disabled by default.",
        ),
        data_block(
            "database-storage",
            "Database and storage status",
            "database-storage",
            "/api/local-state, /api/glitch-core/snapshot.dashboard.database",
            "inspect_database",
            "schema version, table counts, local storage status",
            "Developer",
            "compact table",
        ),
        data_block(
            "profiles",
            "Profiles",
            "profiles",
            "/api/local-state, diagnostics profile payloads",
            "build_profile_report",
            "profile health and file status",
            "Overview / Control",
            "health cards",
            data_completeness="partial",
            notes="Full profile text is not exposed in the console data map.",
        ),
        data_block(
            "errors",
            "Errors and warnings",
            "errors",
            "/api/glitch-core/snapshot.errors",
            "build_glitch_error_items",
            "safe error code, severity, module, trace availability",
            "Developer",
            "error list and badges",
        ),
        data_block(
            "cognition-flow",
            "Cognition Flow",
            "cognition-flow",
            "/api/mind/cognition-flow/latest, /api/mind/cognition-flow/{turn_id}",
            "build_cognition_flow_payload",
            "safe turn chain, context segments, provider metadata, sanitizer, impact",
            "Developer",
            "causal timeline and source table",
            data_completeness="partial",
            notes=(
                "No raw prompt, raw memory, hidden reasoning, secrets, "
                "or raw model output."
            ),
        ),
        data_block(
            "config-registry",
            "Configuration Registry",
            "config-registry",
            "/api/config/registry",
            "build_config_registry_payload",
            "key, source, safe current/default values, risk, editability, effects",
            "Settings / Developer",
            "registry table and locked controls",
            data_completeness="complete",
            notes="Secrets are represented only as present/missing env metadata.",
        ),
        data_block(
            "self-review-reports",
            "Self-review reports",
            "self-review",
            "/api/self-review/reports, /api/self-review/run",
            "build_manual_self_review_draft, list_self_review_reports",
            "manual safe observations, evidence counts, proposal ids",
            "Tasks",
            "report queue",
            writable=True,
            control_actions=["run manual self-review"],
            data_completeness="partial",
            notes=(
                "Manual only; no scheduled background review or autonomous execution."
            ),
        ),
        data_block(
            "improvement-proposals",
            "Improvement proposals",
            "improvement-proposals",
            "/api/improvement-proposals",
            "list_improvement_proposals, update_improvement_proposal_status",
            "safe proposal fields, review status, Codex prompt draft",
            "Tasks",
            "proposal queue",
            writable=True,
            control_actions=[
                "approve",
                "reject",
                "convert to Codex prompt draft",
            ],
            data_completeness="partial",
            notes=(
                "Conversion creates an editable prompt only; it does not run "
                "Codex or write code."
            ),
        ),
    ]
    return {
        "ok": True,
        "mode": "console-data-map",
        "readOnly": True,
        "localOnly": True,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
        "domains": domains,
        "dataBlocks": blocks,
    }


def data_block(
    block_id: str,
    label: str,
    domain: str,
    source_endpoint: str,
    source_function: str,
    field_summary: str,
    recommended_panel: str,
    recommended_visualization: str,
    *,
    writable: bool = False,
    control_actions: list[str] | None = None,
    data_completeness: str = "complete",
    developer_only: bool = False,
    notes: str = "",
) -> dict[str, object]:
    return {
        "id": block_id,
        "label": label,
        "domain": domain,
        "sourceEndpoint": source_endpoint,
        "sourceFunction": source_function,
        "fieldSummary": field_summary,
        "safetyLevel": "safe-ui-metadata",
        "rawTextIncluded": False,
        "secretValuesIncluded": False,
        "writable": writable,
        "controlActions": control_actions or [],
        "recommendedPanel": recommended_panel,
        "recommendedVisualization": recommended_visualization,
        "dataCompleteness": data_completeness,
        "developerOnly": developer_only,
        "chartPotential": recommended_visualization not in {"status cards"},
        "hasGovernanceActions": bool(control_actions),
        "notes": notes,
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
    config = active_chat_config(adapter)
    is_mock = adapter.id == MockApiAdapter.id
    configured = True if is_mock else config.configured
    configuration_status = "test_mock" if is_mock else config.configurationStatus
    return {
        "activeProvider": model_diagnostics.get("provider", config.provider),
        "activeAdapter": adapter.id,
        "activeModel": model_diagnostics.get("model", config.model),
        "configured": configured,
        "configurationStatus": configuration_status,
        "streamingSupport": "disabled_v1",
        "health": "error" if last_error != "n/a" else "ok" if configured else "warning",
        "lastLatencyMs": provider_latency_from_trace(latest_trace),
        "lastError": last_error,
        "availableProviders": [
            {
                "id": "rin-api-chat-openai-compatible",
                "provider": "openai-compatible",
                "configured": config.configured,
                "configurationStatus": config.configurationStatus,
                "secretRequired": True,
            },
        ],
        "safeConfig": config.safe_metadata(),
    }


def build_cost_summary_payload(
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol,
) -> dict[str, object]:
    """Build aggregate token/cost payload for safe UI display."""
    config = active_chat_config(adapter)
    usage = summarize_api_usage(layout)
    recent = list_api_usage_events(layout, limit=20)
    cost_config = load_cost_config()
    aggregate_projection = build_cost_projection(
        input_tokens=usage.totalInputTokens,
        output_tokens=usage.totalOutputTokens,
        estimate_method=usage.latest.estimateMethod if usage.latest else "none",
        cost_config=cost_config,
    )
    recent_payload = [build_cost_record_payload(item, cost_config) for item in recent]
    latest_payload = (
        build_cost_record_payload(usage.latest, cost_config) if usage.latest else None
    )
    return {
        "ok": True,
        "mode": "api-cost-summary",
        "readOnly": True,
        "localOnly": True,
        "provider": getattr(adapter, "provider", config.provider),
        "adapter": adapter.id,
        "model": getattr(adapter, "model", config.model),
        "configured": config.configured,
        "configurationStatus": config.configurationStatus,
        "currency": usage.currency,
        "priceConfig": cost_config.safe_metadata(),
        "pricingProfile": cost_config.pricingProfile,
        "pricingUnit": cost_config.pricingUnit,
        "currencyOfficial": "USD",
        "displayCurrency": cost_config.displayCurrency,
        "usdCnyRate": cost_config.usdCnyRate,
        "usageSource": aggregate_projection["usageSource"],
        "cacheBreakdownAvailable": aggregate_projection["cacheBreakdownAvailable"],
        "inputCacheHitTokens": aggregate_projection["inputCacheHitTokens"],
        "inputCacheMissTokens": aggregate_projection["inputCacheMissTokens"],
        "minEstimatedCostUsd": aggregate_projection["minEstimatedCostUsd"],
        "maxEstimatedCostUsd": aggregate_projection["maxEstimatedCostUsd"],
        "configuredEstimatedCostUsd": aggregate_projection[
            "configuredEstimatedCostUsd"
        ],
        "configuredEstimatedCostCny": aggregate_projection[
            "configuredEstimatedCostCny"
        ],
        "officialBillingMatch": aggregate_projection["officialBillingMatch"],
        "cacheHitRatioEstimate": cost_config.cacheHitRatioEstimate,
        "explanation": aggregate_projection["explanation"],
        "eventCount": usage.eventCount,
        "totalInputTokens": usage.totalInputTokens,
        "totalOutputTokens": usage.totalOutputTokens,
        "totalTokens": usage.totalTokens,
        "totalEstimatedCost": usage.totalEstimatedCost,
        "latest": latest_payload,
        "recent": recent_payload,
        "rawPromptIncluded": False,
        "rawResponseIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def build_cost_recent_payload(
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol,
    *,
    limit: int = 20,
) -> dict[str, object]:
    """Build recent token/cost records for the Web UI."""
    config = active_chat_config(adapter)
    records = list_api_usage_events(layout, limit=limit)
    cost_config = load_cost_config()
    return {
        "ok": True,
        "mode": "api-cost-recent",
        "readOnly": True,
        "localOnly": True,
        "provider": getattr(adapter, "provider", config.provider),
        "adapter": adapter.id,
        "model": getattr(adapter, "model", config.model),
        "configurationStatus": config.configurationStatus,
        "pricingProfile": cost_config.pricingProfile,
        "pricingUnit": cost_config.pricingUnit,
        "records": [build_cost_record_payload(item, cost_config) for item in records],
        "rawPromptIncluded": False,
        "rawResponseIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def build_cost_record_payload(
    record: ApiUsageEventRecord,
    cost_config: CostConfig,
) -> dict[str, object]:
    payload = record.model_dump(mode="json")
    payload.update(
        build_cost_projection(
            input_tokens=record.inputTokens,
            output_tokens=record.outputTokens,
            estimate_method=record.estimateMethod,
            cost_config=cost_config,
        )
    )
    return payload


def build_cost_projection(
    *,
    input_tokens: int,
    output_tokens: int,
    estimate_method: str,
    cost_config: CostConfig,
) -> dict[str, object]:
    usage_source = (
        PROVIDER_USAGE_METHOD
        if estimate_method == PROVIDER_USAGE_METHOD
        else "heuristic"
        if estimate_method == TOKEN_ESTIMATE_HEURISTIC
        else "none"
    )
    estimate = estimate_cost_range(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        input_cache_hit_tokens=None,
        input_cache_miss_tokens=None,
        usage_source=usage_source,
        cost_config=cost_config,
    )
    return {
        "pricingProfile": getattr(cost_config, "pricingProfile", "legacy-per-1k"),
        "pricingUnit": getattr(cost_config, "pricingUnit", "per_1k_tokens"),
        "currencyOfficial": "USD",
        "displayCurrency": estimate.displayCurrency,
        "usageSource": usage_source,
        "cacheBreakdownAvailable": estimate.cacheBreakdownAvailable,
        "inputCacheHitTokens": estimate.inputCacheHitTokens,
        "inputCacheMissTokens": estimate.inputCacheMissTokens,
        "minEstimatedCostUsd": estimate.minEstimatedCostUsd,
        "maxEstimatedCostUsd": estimate.maxEstimatedCostUsd,
        "configuredEstimatedCostUsd": estimate.configuredEstimatedCostUsd,
        "configuredEstimatedCostCny": estimate.configuredEstimatedCostCny,
        "officialBillingMatch": estimate.officialBillingMatch,
        "explanation": estimate.explanation,
    }


def build_mind_latest_payload(layout: RinDataLayout) -> dict[str, object]:
    """Build the latest safe RIN Mind snapshot payload for UI/API display."""
    snapshot = get_latest_mind_snapshot(layout)
    candidates = list_mind_memory_candidates(layout, limit=30)
    growth_events = list_rin_growth_events(layout, limit=20)
    tool_requests = list_tool_invocation_requests(layout, limit=20)
    embeddings = list_memory_embeddings(layout, limit=20)
    policy = load_mind_policy().metadata()
    return {
        "ok": True,
        "mode": "rin-mind-latest",
        "readOnly": True,
        "localOnly": True,
        "latest": snapshot.model_dump(mode="json") if snapshot else None,
        "candidateCount": len(candidates),
        "memoryCandidates": [item.model_dump(mode="json") for item in candidates],
        "policy": policy.model_dump(mode="json"),
        "analytics": build_mind_analytics_payload(layout),
        "growthEvents": [item.model_dump(mode="json") for item in growth_events],
        "toolInvocationRequests": [
            item.model_dump(mode="json") for item in tool_requests
        ],
        "embeddingStatus": {
            "enabled": policy.enableEmbeddings,
            "provider": policy.embeddingProvider,
            "entryCount": len(embeddings),
            "rawTextIncluded": False,
        },
        "safeForUi": True,
        "rawTextIncluded": False,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def build_mind_snapshot_response(snapshot: RinMindSnapshot) -> dict[str, object]:
    """Wrap one RIN Mind snapshot in the standard safe response envelope."""
    return {
        "ok": True,
        "mode": "rin-mind-turn",
        "readOnly": True,
        "localOnly": True,
        "snapshot": snapshot.model_dump(mode="json"),
        "safeForUi": True,
        "rawTextIncluded": False,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def build_mind_analytics_payload(layout: RinDataLayout) -> dict[str, object]:
    """Return the combined safe explainability payload for the cognitive dashboard."""
    return {
        "ok": True,
        "mode": "rin-mind-analytics",
        "readOnly": True,
        "localOnly": True,
        "memory": build_memory_analytics_payload(layout),
        "context": build_context_analytics_payload(layout),
        "ownerStateTrend": build_owner_state_trend_payload(layout),
        "trace": build_trace_analytics_payload(),
        "rawTextIncluded": False,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def build_memory_analytics_payload(layout: RinDataLayout) -> dict[str, object]:
    """Build safe memory candidate analytics from persisted candidate metadata."""
    candidates = list_mind_memory_candidates(layout, limit=100)
    latest = get_latest_mind_snapshot(layout)
    selected_ids = (
        {
            item.sourceId
            for item in latest.memoryRetrieval.selected
            if item.sourceKind == "memory_candidate"
        }
        if latest
        else set()
    )
    candidate_payloads = [
        build_memory_candidate_analytics(item, latest=latest, selected_ids=selected_ids)
        for item in candidates
    ]
    counts = {
        "total": len(candidate_payloads),
        "byReviewStatus": count_by(candidate_payloads, "reviewStatus"),
        "byRiskLevel": count_by(candidate_payloads, "riskLevel"),
        "byType": count_by(candidate_payloads, "type"),
        "active": sum(1 for item in candidate_payloads if item["active"] is True),
        "inactive": sum(1 for item in candidate_payloads if item["active"] is False),
    }
    strongest = sorted(
        candidate_payloads,
        key=lambda item: float(cast(float, item["memoryStrength"])),
        reverse=True,
    )[:8]
    pending = [
        item
        for item in candidate_payloads
        if item["reviewStatus"] in {"candidate", "review_required"}
    ][:12]
    near_decay = [
        item
        for item in candidate_payloads
        if float(cast(float, item["memoryStrength"]))
        <= cast(dict[str, float], item["thresholds"])["weakening"]
        and item["active"] is True
    ][:8]
    return {
        "ok": True,
        "mode": "rin-mind-memory-analytics",
        "readOnly": True,
        "localOnly": True,
        "counts": counts,
        "strongest": strongest,
        "pendingReview": pending,
        "nearDecayThreshold": near_decay,
        "selectedInCurrentContextIds": sorted(selected_ids),
        "candidates": candidate_payloads,
        "thresholds": memory_strength_thresholds(),
        "formula": (
            "strength = bounded weighted salience, confidence, status, stability, "
            "risk, active flag, and elapsed-time decay from candidate timestamps"
        ),
        "explanation": (
            "Memory analytics are deterministic local projections from safeSummary, "
            "normalizedValue, risk/status metadata, salience, confidence, and "
            "timestamps."
        ),
        "rawTextIncluded": False,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def build_memory_candidate_analytics_payload(
    layout: RinDataLayout,
    candidate_id: str,
) -> dict[str, object] | None:
    """Return safe analytics for one memory candidate."""
    candidates = list_mind_memory_candidates(layout, limit=100)
    candidate = next((item for item in candidates if item.id == candidate_id), None)
    if candidate is None:
        return None
    latest = get_latest_mind_snapshot(layout)
    selected_ids = (
        {
            item.sourceId
            for item in latest.memoryRetrieval.selected
            if item.sourceKind == "memory_candidate"
        }
        if latest
        else set()
    )
    analytics = build_memory_candidate_analytics(
        candidate,
        latest=latest,
        selected_ids=selected_ids,
    )
    return {
        "ok": True,
        "mode": "rin-mind-memory-candidate-analytics",
        "readOnly": True,
        "localOnly": True,
        "candidate": analytics,
        "rawTextIncluded": False,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def build_memory_candidate_analytics(
    candidate: object,
    *,
    latest: RinMindSnapshot | None,
    selected_ids: set[str],
) -> dict[str, object]:
    """Project one candidate into chartable safe memory analytics."""
    created_at = getattr(candidate, "createdAt", None) or getattr(
        candidate,
        "updatedAt",
        None,
    )
    updated_at = getattr(candidate, "updatedAt", None) or created_at
    created_dt = parse_iso_datetime(created_at)
    updated_dt = parse_iso_datetime(updated_at) or created_dt
    now = datetime.now(UTC)
    strength = memory_strength_score(candidate, now=now)
    thresholds = memory_strength_thresholds()
    event_markers: list[dict[str, object]] = [
        {
            "type": "created",
            "at": iso_or_na(created_dt, created_at),
            "label": "created",
        }
    ]
    review_status = str(getattr(candidate, "reviewStatus", "candidate"))
    if review_status in {"auto_promoted", "owner_approved", "rejected", "inactive"}:
        event_markers.append(
            {
                "type": review_status,
                "at": iso_or_na(updated_dt, updated_at),
                "label": review_status,
            }
        )
    if getattr(candidate, "active", False) is False:
        event_markers.append(
            {
                "type": "deactivated",
                "at": iso_or_na(updated_dt, updated_at),
                "label": "inactive" if review_status == "inactive" else "not active",
            }
        )
    if getattr(candidate, "id", "") in selected_ids and latest is not None:
        event_markers.append(
            {
                "type": "injected_into_context",
                "at": latest.createdAt,
                "label": "selected in latest context",
            }
        )
    if strength <= thresholds["forgetting"]:
        event_markers.append(
            {
                "type": "threshold_crossed",
                "at": now.isoformat().replace("+00:00", "Z"),
                "label": "forgetting threshold",
            }
        )
    elif strength <= thresholds["weakening"]:
        event_markers.append(
            {
                "type": "threshold_crossed",
                "at": now.isoformat().replace("+00:00", "Z"),
                "label": "weakening threshold",
            }
        )
    retrieval_events = (
        [
            {
                "type": "retrieved",
                "at": latest.createdAt,
                "source": "latest_mind_snapshot",
            }
        ]
        if getattr(candidate, "id", "") in selected_ids and latest is not None
        else []
    )
    return {
        "candidateId": getattr(candidate, "id", "n/a"),
        "shortId": short_id(str(getattr(candidate, "id", ""))),
        "type": getattr(candidate, "type", "n/a"),
        "safeSummary": getattr(candidate, "safeSummary", ""),
        "normalizedValue": getattr(candidate, "normalizedValue", None),
        "riskLevel": getattr(candidate, "riskLevel", "n/a"),
        "reviewStatus": review_status,
        "active": bool(getattr(candidate, "active", False)),
        "ownerConfirmed": bool(getattr(candidate, "ownerConfirmed", False)),
        "autoPromote": bool(getattr(candidate, "autoPromote", False)),
        "salience": round(float(getattr(candidate, "salience", 0.0)), 4),
        "confidence": round(float(getattr(candidate, "confidence", 0.0)), 4),
        "stability": getattr(candidate, "stability", "n/a"),
        "decayPolicy": getattr(candidate, "decayPolicy", "n/a"),
        "memoryStrength": strength,
        "thresholds": thresholds,
        "predictedDecayPoints": predicted_decay_points(candidate, now=now),
        "eventMarkers": event_markers,
        "retrievalEvents": retrieval_events,
        "contextInjectionEvents": retrieval_events,
        "selectedInCurrentContext": getattr(candidate, "id", "") in selected_ids,
        "tags": list(getattr(candidate, "tags", [])),
        "reasons": list(getattr(candidate, "reasons", [])),
        "contradictionOf": getattr(candidate, "contradictionOf", None),
        "supersedes": getattr(candidate, "supersedes", None),
        "sourceKind": getattr(candidate, "sourceKind", "n/a"),
        "createdAt": created_at,
        "updatedAt": updated_at,
        "explanation": explain_memory_candidate(candidate, strength),
        "historyStatus": "derived_from_candidate_metadata",
        "rawTextIncluded": False,
        "secretValuesIncluded": False,
    }


def build_context_analytics_payload(layout: RinDataLayout) -> dict[str, object]:
    """Return safe context-plan analytics for the latest Mind snapshot."""
    latest = get_latest_mind_snapshot(layout)
    if latest is None:
        return empty_context_analytics_payload()
    plan = latest.contextPlan
    retrieval = latest.memoryRetrieval
    selected_sources = [
        {
            "sourceKind": item.sourceKind,
            "sourceId": short_id(item.sourceId),
            "fullSourceIdIncluded": False,
            "included": item.selected,
            "reason": ", ".join(item.reasons) or "selected",
            "riskLevel": item.riskLevel,
            "estimatedChars": len(item.safeSummary or "")
            + len(item.normalizedValue or ""),
            "estimatedTokens": estimate_tokens_from_chars(
                len(item.safeSummary or "") + len(item.normalizedValue or ""),
            ),
            "safePreview": item.safeSummary,
            "rawTextIncluded": False,
        }
        for item in [*retrieval.selected, *retrieval.excluded]
    ]
    excluded_sources = [
        {
            "sourceKind": item.kind,
            "sourceId": short_id(item.id),
            "fullSourceIdIncluded": False,
            "included": False,
            "reason": item.reason,
            "riskLevel": "n/a",
            "estimatedChars": 0,
            "estimatedTokens": 0,
            "safePreview": "",
            "rawTextIncluded": False,
        }
        for item in plan.excludedItems
    ]
    segments = [
        {
            "type": "recent_history",
            "included": True,
            "count": len(plan.selectedRecentMessageIds),
            "estimatedTokens": estimate_tokens_from_chars(
                len(plan.selectedRecentMessageIds) * 320,
            ),
        },
        {
            "type": "memory",
            "included": True,
            "count": len(plan.selectedMemoryTraceIds)
            + len(plan.selectedMemorySourceIds),
            "estimatedTokens": estimate_tokens_from_chars(
                sum(
                    len(item.safeSummary or "") + len(item.normalizedValue or "")
                    for item in retrieval.selected
                ),
            ),
        },
        {
            "type": "profile",
            "included": bool(plan.selectedProfileSections),
            "count": len(plan.selectedProfileSections),
            "estimatedTokens": estimate_tokens_from_chars(
                len(plan.selectedProfileSections) * 420,
            ),
        },
        {
            "type": "summary",
            "included": bool(plan.selectedSummaryIds),
            "count": len(plan.selectedSummaryIds),
            "estimatedTokens": estimate_tokens_from_chars(
                len(plan.selectedSummaryIds) * 280,
            ),
        },
    ]
    estimated_total = sum(cast(int, item["estimatedTokens"]) for item in segments)
    return {
        "ok": True,
        "mode": "rin-mind-context-analytics",
        "readOnly": True,
        "localOnly": True,
        "turnCreatedAt": latest.createdAt,
        "flow": [
            "Owner Input",
            "Message Understanding",
            "Recent History Selection",
            "Memory Retrieval",
            "Profile / Summary / Owner State",
            "Context Budget",
            "Provider Request",
        ],
        "budget": {
            "maxCharacters": plan.budget,
            "estimatedTokens": plan.estimatedTokens or estimated_total,
            "segments": segments,
        },
        "sources": [*selected_sources, *excluded_sources],
        "providerRequestOutline": {
            "messageCount": len(plan.selectedRecentMessageIds) + 1,
            "selectedMemoryCount": len(retrieval.selected),
            "excludedMemoryCount": len(retrieval.excluded) + len(plan.excludedItems),
            "currentOwnerInputLast": True,
            "rawPromptIncluded": False,
        },
        "explanation": explain_context_plan(plan, retrieval),
        "rawReasons": plan.reasons,
        "privacyFlags": plan.privacyFlags
        | {
            "rawPromptIncluded": False,
            "rawMemoryIncluded": False,
            "hiddenReasoningIncluded": False,
            "secretValuesIncluded": False,
        },
        "rawTextIncluded": False,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def empty_context_analytics_payload() -> dict[str, object]:
    return {
        "ok": True,
        "mode": "rin-mind-context-analytics",
        "readOnly": True,
        "localOnly": True,
        "turnCreatedAt": None,
        "flow": [],
        "budget": {"maxCharacters": 0, "estimatedTokens": 0, "segments": []},
        "sources": [],
        "providerRequestOutline": {
            "messageCount": 0,
            "selectedMemoryCount": 0,
            "excludedMemoryCount": 0,
            "currentOwnerInputLast": False,
            "rawPromptIncluded": False,
        },
        "explanation": "No RIN Mind snapshot has been recorded yet.",
        "rawReasons": [],
        "privacyFlags": {
            "rawPromptIncluded": False,
            "rawMemoryIncluded": False,
            "hiddenReasoningIncluded": False,
            "secretValuesIncluded": False,
        },
        "rawTextIncluded": False,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def build_owner_state_trend_payload(
    layout: RinDataLayout,
    *,
    limit: int = 20,
) -> dict[str, object]:
    """Build a recent owner-state trend from safe persisted Mind snapshots."""
    snapshots = list_recent_mind_snapshots(layout, limit=limit)
    points = [
        {
            "turnIndex": index,
            "createdAt": snapshot.createdAt,
            "energyLevel": snapshot.ownerState.energyLevel,
            "moodValence": snapshot.ownerState.moodValence,
            "arousalLevel": snapshot.ownerState.arousalLevel,
            "focusState": snapshot.ownerState.focusState,
            "motivationState": snapshot.ownerState.motivationState,
            "immersionInertia": snapshot.ownerState.immersionInertia,
            "interruptionRisk": snapshot.ownerState.interruptionRisk,
            "resultUrgency": snapshot.ownerState.resultUrgency,
            "supportNeed": snapshot.ownerState.supportNeed,
            "confidence": snapshot.ownerState.confidence,
        }
        for index, snapshot in enumerate(reversed(snapshots), start=1)
    ]
    return {
        "ok": True,
        "mode": "rin-mind-owner-state-trend",
        "readOnly": True,
        "localOnly": True,
        "recentLimit": max(1, min(limit, 100)),
        "points": points,
        "explanation": (
            "Recent owner-state trend is derived from safe mind_turn_snapshots."
            if points
            else "No owner-state snapshots have been recorded yet."
        ),
        "rawTextIncluded": False,
        "rawPromptIncluded": False,
        "secretValuesIncluded": False,
    }


def build_trace_analytics_payload() -> dict[str, object]:
    """Build safe runtime trace chart data from in-memory trace store metadata."""
    latest = RUNTIME_TRACE_STORE.latest()
    traces = RUNTIME_TRACE_STORE.list()
    stage_payloads = []
    warning_count = 0
    error_count = 0
    if latest is not None:
        for stage in latest.stages:
            if stage.status == "warning":
                warning_count += 1
            if stage.status == "error":
                error_count += 1
            stage_payloads.append(
                {
                    "name": stage.name,
                    "displayName": stage.displayName,
                    "status": stage.status,
                    "durationMs": stage.durationMs,
                    "summary": stage.summary,
                    "startedAt": stage.recordedAt,
                    "endedAt": stage.recordedAt,
                }
            )
    return {
        "ok": True,
        "mode": "rin-mind-trace-analytics",
        "readOnly": True,
        "localOnly": True,
        "latest": {
            "turnId": latest.turnId if latest else None,
            "turnShortId": short_id(latest.turnId) if latest else "n/a",
            "status": latest.status if latest else "n/a",
            "totalDurationMs": latest.totalDurationMs if latest else 0,
            "providerDurationMs": provider_duration_from_stages(stage_payloads),
            "stageCount": len(stage_payloads),
            "warningCount": warning_count,
            "errorCount": error_count,
            "currentOwnerInputLast": bool(latest),
            "rawPromptIncluded": False,
            "hiddenReasoningIncluded": False,
        },
        "stages": stage_payloads,
        "recent": [
            {
                "turnId": trace.turnId,
                "turnShortId": short_id(trace.turnId),
                "status": trace.status,
                "totalDurationMs": trace.totalDurationMs,
            }
            for trace in traces[:20]
        ],
        "rawTextIncluded": False,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def build_cognition_flow_payload(
    layout: RinDataLayout,
    *,
    turn_id: str | None = None,
) -> dict[str, object]:
    """Build a safe single-turn cognition chain from trace + Mind metadata."""
    trace = (
        RUNTIME_TRACE_STORE.get(turn_id) if turn_id else RUNTIME_TRACE_STORE.latest()
    )
    snapshot = (
        get_mind_snapshot_for_turn(layout, turn_id)
        if turn_id
        else get_latest_mind_snapshot(layout)
    )
    if snapshot is None and trace is not None:
        snapshot = get_mind_snapshot_for_turn(layout, trace.turnId)
    context_payload = (
        build_context_analytics_from_snapshot(snapshot)
        if snapshot is not None
        else empty_context_analytics_payload()
    )
    trace_payload = trace.to_safe_dict() if trace else None
    memory_candidates = (
        [item.model_dump(mode="json") for item in snapshot.memoryCandidates]
        if snapshot
        else []
    )
    growth_events = (
        [item.model_dump(mode="json") for item in snapshot.growthEvents]
        if snapshot
        else []
    )
    tool_requests = (
        [item.model_dump(mode="json") for item in snapshot.toolInvocationRequests]
        if snapshot
        else []
    )
    audit_events = [
        item.model_dump(mode="json") for item in list_audit_summaries(layout, 8)
    ]
    request_stage = find_runtime_stage(trace, "model_request")
    raw_stage = find_runtime_stage(trace, "raw_model_response")
    sanitizer_stage = find_runtime_stage(trace, "sanitization_final_answer")
    input_stage = find_runtime_stage(trace, "input_received")
    model_request = safe_model_request_outline(request_stage)
    final_answer = {
        "finalAnswerLength": safe_stage_value(
            sanitizer_stage,
            "output",
            "finalAnswerLength",
            0,
        ),
        "finalAnswerPreview": safe_stage_value(
            sanitizer_stage,
            "output",
            "finalAnswerPreview",
            "n/a",
        ),
        "sanitizedOnly": True,
        "rawModelOutputIncluded": False,
        "hiddenReasoningIncluded": False,
    }
    return {
        "ok": True,
        "mode": "rin-cognition-flow",
        "readOnly": True,
        "localOnly": True,
        "turnId": trace.turnId if trace else turn_id,
        "turnShortId": short_id(trace.turnId if trace else turn_id),
        "traceAvailable": trace is not None,
        "snapshotAvailable": snapshot is not None,
        "status": trace.status if trace else "snapshot_only" if snapshot else "missing",
        "createdAt": trace.createdAt
        if trace
        else snapshot.createdAt
        if snapshot
        else None,
        "ownerInput": {
            "inputLength": safe_stage_value(
                input_stage, "output", "inputLength", "n/a"
            ),
            "inputHash": safe_stage_value(input_stage, "output", "inputHash", "n/a"),
            "latestOwnerInputPreservedAsFinalOwnerMessage": bool(
                model_request["currentOwnerInputLast"],
            ),
            "rawTextIncluded": False,
        },
        "steps": build_cognition_steps(
            snapshot=snapshot,
            trace=trace,
            context_payload=context_payload,
            memory_candidates=memory_candidates,
            growth_events=growth_events,
            tool_requests=tool_requests,
            audit_events=audit_events,
        ),
        "contextSegments": context_payload["sources"],
        "localOnlyDecisions": build_local_only_decisions(snapshot, context_payload),
        "providerSentContext": {
            "requestMessageCount": model_request["requestMessageCount"],
            "requestCharacterCount": model_request["requestCharacterCount"],
            "roleCounts": model_request["roleCounts"],
            "messages": model_request["messages"],
            "currentOwnerInputLast": model_request["currentOwnerInputLast"],
            "rawPromptIncluded": False,
        },
        "providerResponseMetadata": {
            "providerRawMetadataAvailable": safe_stage_value(
                raw_stage,
                "output",
                "providerRawMetadataAvailable",
                False,
            ),
            "rawContentLength": safe_stage_value(
                raw_stage, "output", "rawContentLength", "n/a"
            ),
            "rawContentHash": safe_stage_value(
                raw_stage, "output", "rawContentHash", "n/a"
            ),
            "adapterContentLength": safe_stage_value(
                raw_stage,
                "output",
                "adapterContentLength",
                "n/a",
            ),
            "rawModelOutputIncluded": False,
        },
        "sanitizer": build_sanitizer_summary(sanitizer_stage),
        "finalAnswer": final_answer,
        "turnImpact": {
            "memoryCandidates": memory_candidates,
            "growthEvents": growth_events,
            "toolProposals": tool_requests,
            "auditEvents": audit_events,
            "rawTextIncluded": False,
        },
        "dangerousCapabilities": dangerous_capability_registry(
            snapshot.policy if snapshot else load_mind_policy().metadata(),
        ),
        "trace": trace_payload if trace and turn_id is not None else None,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "rawModelOutputIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def build_context_analytics_from_snapshot(
    snapshot: RinMindSnapshot,
) -> dict[str, object]:
    plan = snapshot.contextPlan
    retrieval = snapshot.memoryRetrieval
    selected_sources = [
        {
            "sourceKind": item.sourceKind,
            "sourceId": short_id(item.sourceId),
            "fullSourceIdIncluded": False,
            "included": item.selected,
            "reason": ", ".join(item.reasons) or "selected",
            "riskLevel": item.riskLevel,
            "estimatedChars": len(item.safeSummary or "")
            + len(item.normalizedValue or ""),
            "estimatedTokens": estimate_tokens_from_chars(
                len(item.safeSummary or "") + len(item.normalizedValue or ""),
            ),
            "safePreview": item.safeSummary,
            "rawTextIncluded": False,
        }
        for item in [*retrieval.selected, *retrieval.excluded]
    ]
    excluded_sources = [
        {
            "sourceKind": item.kind,
            "sourceId": short_id(item.id),
            "fullSourceIdIncluded": False,
            "included": False,
            "reason": item.reason,
            "riskLevel": "n/a",
            "estimatedChars": 0,
            "estimatedTokens": 0,
            "safePreview": "",
            "rawTextIncluded": False,
        }
        for item in plan.excludedItems
    ]
    segments = [
        {
            "type": "recent_history",
            "included": True,
            "count": len(plan.selectedRecentMessageIds),
            "estimatedTokens": estimate_tokens_from_chars(
                len(plan.selectedRecentMessageIds) * 320,
            ),
        },
        {
            "type": "memory",
            "included": True,
            "count": len(plan.selectedMemoryTraceIds)
            + len(plan.selectedMemorySourceIds),
            "estimatedTokens": estimate_tokens_from_chars(
                sum(
                    len(item.safeSummary or "") + len(item.normalizedValue or "")
                    for item in retrieval.selected
                ),
            ),
        },
        {
            "type": "profile",
            "included": bool(plan.selectedProfileSections),
            "count": len(plan.selectedProfileSections),
            "estimatedTokens": estimate_tokens_from_chars(
                len(plan.selectedProfileSections) * 420,
            ),
        },
        {
            "type": "summary",
            "included": bool(plan.selectedSummaryIds),
            "count": len(plan.selectedSummaryIds),
            "estimatedTokens": estimate_tokens_from_chars(
                len(plan.selectedSummaryIds) * 280,
            ),
        },
    ]
    estimated_total = sum(cast(int, item["estimatedTokens"]) for item in segments)
    return {
        "ok": True,
        "mode": "rin-mind-context-analytics",
        "readOnly": True,
        "localOnly": True,
        "turnCreatedAt": snapshot.createdAt,
        "flow": [
            "Owner Input",
            "Message Understanding",
            "Recent History Selection",
            "Memory Retrieval",
            "Profile / Summary / Owner State",
            "Context Budget",
            "Provider Request",
        ],
        "budget": {
            "maxCharacters": plan.budget,
            "estimatedTokens": plan.estimatedTokens or estimated_total,
            "segments": segments,
        },
        "sources": [*selected_sources, *excluded_sources],
        "providerRequestOutline": {
            "messageCount": len(plan.selectedRecentMessageIds) + 1,
            "selectedMemoryCount": len(retrieval.selected),
            "excludedMemoryCount": len(retrieval.excluded) + len(plan.excludedItems),
            "currentOwnerInputLast": True,
            "rawPromptIncluded": False,
        },
        "explanation": explain_context_plan(plan, retrieval),
        "rawReasons": plan.reasons,
        "privacyFlags": plan.privacyFlags
        | {
            "rawPromptIncluded": False,
            "rawMemoryIncluded": False,
            "hiddenReasoningIncluded": False,
            "secretValuesIncluded": False,
        },
        "rawTextIncluded": False,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def build_cognition_steps(
    *,
    snapshot: RinMindSnapshot | None,
    trace: object | None,
    context_payload: dict[str, object],
    memory_candidates: list[dict[str, object]],
    growth_events: list[dict[str, object]],
    tool_requests: list[dict[str, object]],
    audit_events: list[dict[str, object]],
) -> list[dict[str, object]]:
    return [
        cognition_step(
            "owner_input",
            "Owner Input",
            "Owner message was received and fingerprinted locally.",
            trace,
            "input_received",
            local_only=True,
            details={
                "rawTextIncluded": False,
                "inputLength": safe_stage_value(
                    find_runtime_stage(trace, "input_received"),
                    "output",
                    "inputLength",
                    "n/a",
                ),
                "inputHash": safe_stage_value(
                    find_runtime_stage(trace, "input_received"),
                    "output",
                    "inputHash",
                    "n/a",
                ),
            },
        ),
        cognition_step(
            "message_understanding",
            "Message Understanding",
            snapshot.messageUnderstanding.intentSummary
            if snapshot
            else "No Mind snapshot available.",
            trace,
            "message_understanding",
            local_only=True,
            details=snapshot.messageUnderstanding.model_dump(mode="json")
            if snapshot
            else {},
        ),
        cognition_step(
            "owner_state",
            "Owner State",
            "Local owner-state estimate shapes response planning.",
            trace,
            "owner_state_inference",
            local_only=True,
            details=snapshot.ownerState.model_dump(mode="json") if snapshot else {},
        ),
        cognition_step(
            "memory_retrieval",
            "Memory Retrieval",
            (
                "Approved/auto-promoted safe memories are selected or excluded "
                "by local policy."
            ),
            trace,
            "memory_v2_retrieval",
            local_only=True,
            details={
                "selected": [
                    item.model_dump(mode="json")
                    for item in snapshot.memoryRetrieval.selected
                ]
                if snapshot
                else [],
                "excluded": [
                    item.model_dump(mode="json")
                    for item in snapshot.memoryRetrieval.excluded
                ]
                if snapshot
                else [],
                "rawMemoryIncluded": False,
            },
        ),
        cognition_step(
            "context_plan",
            "Context Plan",
            context_payload["explanation"],
            trace,
            "context_planning",
            local_only=True,
            details={
                "budget": context_payload["budget"],
                "sources": context_payload["sources"],
                "privacyFlags": context_payload["privacyFlags"],
            },
        ),
        cognition_step(
            "model_request",
            "Model Request Outline",
            "Provider request is summarized by roles, segment counts, and sizes only.",
            trace,
            "model_request",
            sent_to_provider=True,
            details=safe_model_request_outline(
                find_runtime_stage(trace, "model_request")
            ),
        ),
        cognition_step(
            "provider_response",
            "Provider Response Metadata",
            "Provider response is represented by safe metadata; raw output is hidden.",
            trace,
            "raw_model_response",
            sent_to_provider=True,
            details={
                "rawModelOutputIncluded": False,
                "rawContentLength": safe_stage_value(
                    find_runtime_stage(trace, "raw_model_response"),
                    "output",
                    "rawContentLength",
                    "n/a",
                ),
                "rawContentHash": safe_stage_value(
                    find_runtime_stage(trace, "raw_model_response"),
                    "output",
                    "rawContentHash",
                    "n/a",
                ),
            },
        ),
        cognition_step(
            "sanitizer",
            "Sanitizer",
            "Final answer is checked and thinking-like content is removed if detected.",
            trace,
            "sanitization_final_answer",
            local_only=True,
            details=build_sanitizer_summary(
                find_runtime_stage(trace, "sanitization_final_answer"),
            ),
        ),
        cognition_step(
            "final_answer",
            "Final Answer",
            "Only the sanitized answer is persisted and returned.",
            trace,
            "rin_reply_persisted",
            details={
                "storedSanitizedAnswer": safe_stage_value(
                    find_runtime_stage(trace, "rin_reply_persisted"),
                    "output",
                    "storedSanitizedAnswer",
                    "n/a",
                ),
                "storedRawThinking": safe_stage_value(
                    find_runtime_stage(trace, "rin_reply_persisted"),
                    "output",
                    "storedRawThinking",
                    False,
                ),
            },
        ),
        cognition_step(
            "turn_impact",
            "Turn Impact",
            (
                "Memory candidates, growth events, tool proposals, and audit "
                "events remain owner-governed."
            ),
            trace,
            "mind_lifecycle",
            local_only=True,
            details={
                "memoryCandidateCount": len(memory_candidates),
                "growthEventCount": len(growth_events),
                "toolProposalCount": len(tool_requests),
                "auditEventCount": len(audit_events),
                "autoExecution": False,
            },
        ),
    ]


def cognition_step(
    step_id: str,
    label: str,
    summary: object,
    trace: object | None,
    stage_name: str,
    *,
    local_only: bool = False,
    sent_to_provider: bool = False,
    details: dict[str, object] | None = None,
) -> dict[str, object]:
    stage = find_runtime_stage(trace, stage_name)
    return {
        "id": step_id,
        "label": label,
        "stageName": stage_name,
        "status": getattr(stage, "status", "unavailable") if stage else "unavailable",
        "durationMs": getattr(stage, "durationMs", 0) if stage else 0,
        "summary": str(summary),
        "localOnly": local_only,
        "sentToProvider": sent_to_provider,
        "details": details or {},
        "rawTextIncluded": False,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "rawModelOutputIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def safe_model_request_outline(stage: object | None) -> dict[str, object]:
    output = getattr(stage, "output", {}) if stage else {}
    outline = output.get("requestOutline", []) if isinstance(output, dict) else []
    messages: list[dict[str, object]] = []
    if isinstance(outline, list):
        for item in outline:
            if not isinstance(item, dict):
                continue
            messages.append(
                {
                    "index": item.get("index"),
                    "role": item.get("role"),
                    "characterCount": item.get("characterCount"),
                    "sourceComponent": item.get("sourceComponent"),
                    "previewIncluded": False,
                }
            )
    return {
        "requestMessageCount": safe_stage_value(
            stage, "output", "requestMessageCount", 0
        ),
        "requestCharacterCount": safe_stage_value(
            stage, "output", "requestCharacterCount", 0
        ),
        "roleCounts": {
            "system": safe_stage_value(stage, "output", "systemMessageCount", 0),
            "owner": safe_stage_value(stage, "output", "ownerMessageCount", 0),
            "rin": safe_stage_value(stage, "output", "rinMessageCount", 0),
        },
        "messages": messages,
        "currentOwnerInputPresent": safe_stage_value(
            stage,
            "output",
            "currentOwnerInputPresent",
            False,
        ),
        "currentOwnerInputLast": safe_stage_value(
            stage,
            "output",
            "currentOwnerInputLast",
            False,
        ),
        "rawPromptIncluded": False,
    }


def build_sanitizer_summary(stage: object | None) -> dict[str, object]:
    return {
        "thinkingTagDetected": safe_stage_value(
            stage,
            "input",
            "thinkingTagDetected",
            False,
        ),
        "thinkingLikePrefixDetected": safe_stage_value(
            stage,
            "input",
            "thinkingLikePrefixDetected",
            False,
        ),
        "thinkingTagRemoved": safe_stage_value(
            stage,
            "operation",
            "thinkingTagRemoved",
            False,
        ),
        "thinkingLikePrefixRemoved": safe_stage_value(
            stage,
            "operation",
            "thinkingLikePrefixRemoved",
            False,
        ),
        "removedCharacterCount": safe_stage_value(
            stage,
            "output",
            "removedCharacterCount",
            0,
        ),
        "rejected": safe_stage_value(stage, "decision", "rejected", False),
        "finalAnswerSafe": not bool(
            safe_stage_value(stage, "decision", "rejected", False),
        ),
        "rawModelOutputIncluded": False,
        "hiddenReasoningIncluded": False,
    }


def build_local_only_decisions(
    snapshot: RinMindSnapshot | None,
    context_payload: dict[str, object],
) -> list[dict[str, object]]:
    if snapshot is None:
        return []
    plan = snapshot.contextPlan
    return [
        {
            "id": "owner_state",
            "label": "Owner state estimate",
            "usedFor": "response plan and context policy",
            "sentToProvider": bool(plan.ownerStateIncluded),
            "rawTextIncluded": False,
        },
        {
            "id": "excluded_context",
            "label": "Excluded context sources",
            "usedFor": "local governance decision only",
            "count": sum(
                1
                for item in cast(list[dict[str, object]], context_payload["sources"])
                if item.get("included") is False
            ),
            "sentToProvider": False,
            "rawTextIncluded": False,
        },
        {
            "id": "response_plan",
            "label": "Response plan",
            "usedFor": "tone, structure, comfort, memory reference choices",
            "sentToProvider": True,
            "rawTextIncluded": False,
        },
    ]


def find_runtime_stage(trace: object | None, name: str) -> object | None:
    if trace is None:
        return None
    stages = getattr(trace, "stages", [])
    return next((stage for stage in stages if getattr(stage, "name", "") == name), None)


def safe_stage_value(
    stage: object | None,
    section: str,
    key: str,
    default: object,
) -> object:
    if stage is None:
        return default
    payload = getattr(stage, section, {})
    if not isinstance(payload, dict):
        return default
    return payload.get(key, default)


def build_config_registry_payload(
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol,
) -> dict[str, object]:
    """Expose safe configuration metadata, never secret values."""
    provider = active_chat_config(adapter)
    cost = load_cost_config()
    policy = load_mind_policy().metadata()
    profile_report = build_profile_report(layout)
    sections = [
        config_section("ui-display", "UI Display Config", "frontend local settings"),
        config_section("runtime", "Runtime Config", "local FastAPI/runtime defaults"),
        config_section("provider", "Provider Config", "external API adapter metadata"),
        config_section("cost", "Cost Config", "token-cost estimate controls"),
        config_section("mind-policy", "Mind Policy Config", "local mind policy"),
        config_section(
            "memory-policy", "Memory Policy Config", "memory governance thresholds"
        ),
        config_section("profile", "Profile Config", "local profile JSON status"),
        config_section(
            "rin-identity",
            "RIN Identity / Self-model Config",
            "governed self-model boundary",
        ),
        config_section(
            "dangerous-capability",
            "Dangerous Capability Config",
            "locked future capabilities",
        ),
    ]
    items = [
        config_item(
            "ui.displayMode",
            "Display mode",
            "frontend-localStorage",
            "basic",
            "localStorage",
            True,
            "low",
            False,
            False,
            ["UI density", "safe JSON visibility"],
            "Stored in browser localStorage; backend does not receive secrets.",
        ),
        config_item(
            "runtime.traceRetentionCount",
            "Runtime trace retention",
            20,
            20,
            "code_default",
            False,
            "low",
            True,
            False,
            ["Cognition Flow recent turn availability"],
            "In-memory trace ring buffer. Changing it is not exposed in v1.",
        ),
        config_item(
            "provider.apiKey",
            "API key presence",
            "present" if provider.apiKeyPresent else "missing",
            "missing",
            "env",
            False,
            "high",
            True,
            True,
            ["External chat provider availability"],
            "Only env name and present/missing state are shown; key value is hidden.",
            env_name="RIN_API_CHAT_KEY",
        ),
        config_item(
            "provider.model",
            "Provider model",
            provider.model,
            "deepseek-v4-flash",
            "env",
            False,
            "medium",
            True,
            True,
            ["Response style", "cost accounting"],
            (
                "Safe non-secret model name. Backend editing is intentionally "
                "disabled in v1."
            ),
        ),
        config_item(
            "provider.baseUrl",
            "Provider base URL",
            provider.safeBaseUrl or "not_configured",
            "not_configured",
            "env",
            False,
            "medium",
            True,
            True,
            ["External provider endpoint"],
            "URL is stripped of query/userinfo before display.",
        ),
        config_item(
            "provider.temperature",
            "Temperature",
            provider.temperature,
            0.5,
            "env",
            False,
            "medium",
            True,
            True,
            ["Response variance"],
            "Safe scalar only; editing is deferred to future audited config writes.",
        ),
        config_item(
            "cost.pricingProfile",
            "Pricing profile",
            cost.pricingProfile,
            "deepseek-v4-flash",
            "env",
            False,
            "low",
            False,
            False,
            ["Cost estimates"],
            "Manually maintained estimate profile; not official billing.",
        ),
        config_item(
            "cost.cacheHitRatioEstimate",
            "Cache hit ratio estimate",
            cost.cacheHitRatioEstimate,
            0.0,
            "env",
            False,
            "low",
            False,
            False,
            ["Cost range display"],
            "Used only when provider cache breakdown is unavailable.",
        ),
        config_item(
            "mind.contextMaxCharacters",
            "Mind context max characters",
            policy.contextMaxCharacters,
            8000,
            "env",
            False,
            "medium",
            True,
            True,
            ["Context budget", "provider prompt size"],
            "Bounded by local Mind policy.",
        ),
        config_item(
            "mind.recentHistorySelectedLimit",
            "Recent history selected limit",
            policy.recentHistorySelectedLimit,
            8,
            "env",
            False,
            "medium",
            True,
            True,
            ["Recent history sent to provider"],
            "Controls how many safe recent messages can be selected.",
        ),
        config_item(
            "mind.memoryMaxSelected",
            "Memory max selected",
            policy.memoryMaxSelected,
            5,
            "env",
            False,
            "medium",
            True,
            True,
            ["Accepted memory retrieval"],
            "Rejected, inactive, high-risk blocked items remain excluded.",
        ),
        config_item(
            "memory.strengthThresholds",
            "Memory strength thresholds",
            memory_strength_thresholds(),
            {"weakening": 0.42, "forgetting": 0.22},
            "code_default",
            False,
            "low",
            False,
            False,
            ["Memory analytics warnings"],
            "Derived analytics thresholds only; no automatic deletion.",
        ),
        config_item(
            "profile.status",
            "Profile file status",
            profile_report.status,
            "valid",
            "profile_json",
            False,
            "medium",
            False,
            True,
            ["Identity/profile context"],
            "Profile report exposes file health and counts, not full profile text.",
            last_updated_at=None,
        ),
        config_item(
            "rin.selfModelAutoApply",
            "Self-model auto apply",
            policy.selfModelAutoApply,
            False,
            "env",
            False,
            "high",
            True,
            True,
            ["RIN identity slow variables"],
            "Locked disabled; growth events remain review-only.",
        ),
    ]
    items.extend(
        config_item(
            f"dangerous.{item['id']}",
            str(item["label"]),
            item["enabled"],
            False,
            "derived",
            False,
            "high",
            True,
            True,
            ["Owner sovereignty", "runtime safety"],
            str(item["description"]),
        )
        for item in dangerous_capability_registry(policy)
    )
    return {
        "ok": True,
        "mode": "config-registry",
        "readOnly": True,
        "localOnly": True,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
        "sections": sections,
        "items": items,
    }


def config_section(section_id: str, label: str, description: str) -> dict[str, object]:
    return {"id": section_id, "label": label, "description": description}


def config_item(
    key: str,
    display_name: str,
    current_value: object,
    default_value: object,
    source: str,
    editable: bool,
    risk_level: str,
    requires_restart: bool,
    requires_owner_confirm: bool,
    affects: list[str],
    description: str,
    *,
    env_name: str | None = None,
    last_updated_at: str | None = None,
) -> dict[str, object]:
    return {
        "key": key,
        "displayName": display_name,
        "currentValue": current_value,
        "defaultValue": default_value,
        "source": source,
        "editable": editable,
        "riskLevel": risk_level,
        "requiresRestart": requires_restart,
        "requiresOwnerConfirm": requires_owner_confirm,
        "affects": affects,
        "description": description,
        "lastUpdatedAt": last_updated_at,
        "auditRequired": risk_level in {"medium", "high"},
        "rollbackAvailable": source in {"localStorage", "database", "profile_json"},
        "secretValueIncluded": False,
        "envName": env_name,
    }


def dangerous_capability_registry(policy: object) -> list[dict[str, object]]:
    return [
        dangerous_capability("real_tool_execution", "Real tool execution", False),
        dangerous_capability("browser_automation", "Browser automation", False),
        dangerous_capability("file_system_writes", "File system writes by RIN", False),
        dangerous_capability("git_github_writes", "Git/GitHub writes by RIN", False),
        dangerous_capability(
            "provider_summaries_auto_apply",
            "Provider summaries auto-apply",
            bool(getattr(policy, "enableModelSummaries", False)),
        ),
        dangerous_capability(
            "external_embeddings_auto_use",
            "External embeddings auto-use",
            bool(getattr(policy, "enableEmbeddings", False)),
        ),
        dangerous_capability(
            "high_risk_memory_export",
            "High-risk memory export",
            bool(getattr(policy, "allowHighRiskMemoryExport", False)),
        ),
        dangerous_capability(
            "self_model_auto_apply",
            "Self-model auto apply",
            bool(getattr(policy, "selfModelAutoApply", False)),
        ),
        dangerous_capability(
            "self_code_generation_execution", "Self-code generation/execution", False
        ),
        dangerous_capability("self_code_merge_deploy", "Self-code merge/deploy", False),
    ]


def dangerous_capability(
    capability_id: str,
    label: str,
    enabled: bool,
) -> dict[str, object]:
    return {
        "id": capability_id,
        "label": label,
        "enabled": enabled,
        "locked": True,
        "currentLevel": "locked_disabled" if not enabled else "policy_warning",
        "description": (
            "Disabled by default. Future research only; requires owner design review "
            "and separate implementation."
        ),
        "secretValuesIncluded": False,
    }


def build_self_review_reports_payload(
    layout: RinDataLayout,
    *,
    limit: int = 20,
    latest_report_id: str | None = None,
) -> dict[str, object]:
    reports = list_self_review_reports(layout, limit=limit)
    proposals = list_improvement_proposals(layout, limit=50)
    return {
        "ok": True,
        "mode": "rin-self-review-reports",
        "readOnly": True,
        "localOnly": True,
        "manualOnly": True,
        "latestReportId": latest_report_id,
        "reports": [item.model_dump(mode="json") for item in reports],
        "proposalCount": len(proposals),
        "allowedLevel": 3,
        "level4PlusLocked": True,
        "rawTextIncluded": False,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def build_improvement_proposals_payload(
    layout: RinDataLayout,
    *,
    limit: int = 50,
) -> dict[str, object]:
    proposals = list_improvement_proposals(layout, limit=limit)
    return {
        "ok": True,
        "mode": "rin-improvement-proposals",
        "readOnly": True,
        "localOnly": True,
        "executionEnabled": False,
        "autoPrEnabled": False,
        "autoCodeWriteEnabled": False,
        "proposals": [item.model_dump(mode="json") for item in proposals],
        "rawTextIncluded": False,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
    }


def build_manual_self_review_draft(
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol,
) -> dict[str, object]:
    candidates = list_mind_memory_candidates(layout, limit=100)
    pending = [
        item
        for item in candidates
        if item.reviewStatus in {"candidate", "review_required"}
    ]
    rejected = [item for item in candidates if item.reviewStatus == "rejected"]
    context = build_context_analytics_payload(layout)
    trace = build_trace_analytics_payload()
    latest_trace = cast(dict[str, object], trace["latest"])
    latest_trace_available = bool(latest_trace.get("turnId"))
    provider = active_chat_config(adapter)
    policy = load_mind_policy().metadata()
    observations: list[dict[str, object]] = [
        {
            "area": "answer_quality",
            "status": "trace_available"
            if latest_trace_available
            else "not_enough_data",
            "summary": (
                "Runtime trace metadata is available for latest-turn explainability."
            )
            if latest_trace_available
            else "Run a chat turn before deeper answer-quality review.",
            "rawTextIncluded": False,
        },
        {
            "area": "memory_usage",
            "status": "pending_review" if pending else "clear",
            "summary": f"{len(pending)} memory candidates need owner review.",
            "rawTextIncluded": False,
        },
        {
            "area": "context_selection",
            "status": "ok" if context["sources"] else "not_enough_data",
            "summary": (
                f"{len(cast(list[object], context['sources']))} "
                "safe context sources recorded."
            ),
            "rawTextIncluded": False,
        },
        {
            "area": "dangerous_capabilities",
            "status": "disabled" if policy.dangerousDefaultsDisabled else "warning",
            "summary": "Dangerous defaults remain disabled."
            if policy.dangerousDefaultsDisabled
            else "One or more dangerous Mind policy flags are enabled.",
            "rawTextIncluded": False,
        },
    ]
    proposals: list[dict[str, object]] = []
    if pending:
        proposals.append(
            improvement_proposal_draft(
                "memory_policy_improvement",
                "Review pending memory candidates",
                f"{len(pending)} memory candidates are awaiting owner review.",
                [
                    {
                        "kind": "count",
                        "field": "pendingMemoryCandidates",
                        "value": len(pending),
                    }
                ],
                ["python/src/rin/memory", "frontend/src/App.tsx"],
                "low",
                (
                    "Reduce stale or ungoverned candidate memory before it "
                    "influences future context."
                ),
                "Use the Memory Editor approval/rejection flow; do not auto-apply.",
                (
                    "Run candidate-check and verify memory candidates remain "
                    "safe payloads."
                ),
                "Reject or deactivate mistaken candidates; no raw text restore needed.",
            )
        )
    if not provider.configured and adapter.id != MockApiAdapter.id:
        proposals.append(
            improvement_proposal_draft(
                "conversation_quality_improvement",
                "Complete provider configuration",
                "External chat provider is not fully configured.",
                [{"kind": "providerStatus", "value": provider.configurationStatus}],
                ["python/src/rin/config/chat_provider.py"],
                "medium",
                "Allow real provider smoke tests while keeping keys in env only.",
                "Set local env vars outside Git; verify API key remains hidden.",
                "Run provider smoke plus production-check.",
                "Unset the env vars; no database migration required.",
            )
        )
    if len(rejected) >= 5:
        proposals.append(
            improvement_proposal_draft(
                "memory_policy_improvement",
                "Investigate repeated rejected memories",
                f"{len(rejected)} memory candidates are rejected.",
                [
                    {
                        "kind": "count",
                        "field": "rejectedMemoryCandidates",
                        "value": len(rejected),
                    }
                ],
                ["python/src/rin/mind/rules.py"],
                "medium",
                "Reduce memory pollution and owner review burden.",
                (
                    "Tighten deterministic candidate generation rules after "
                    "reviewing safe categories."
                ),
                "Add unit tests around rejected candidate patterns.",
                "Revert rule changes and keep rejected records inactive.",
            )
        )
    if not proposals:
        proposals.append(
            improvement_proposal_draft(
                "data_visualization_improvement",
                "Gather more Cognition Flow evidence",
                (
                    "Current safe telemetry has no urgent issue, but more turn "
                    "samples would improve governance decisions."
                ),
                [
                    {
                        "kind": "status",
                        "field": "selfReviewEvidence",
                        "value": "needs_more_turn_samples",
                    }
                ],
                ["frontend/src/App.tsx", "python/src/rin/server/api.py"],
                "low",
                (
                    "Prevent premature memory or policy tuning when the local "
                    "evidence set is small."
                ),
                (
                    "Keep self-review proposal-only and collect more safe "
                    "per-turn Cognition Flow snapshots."
                ),
                (
                    "Run candidate-check, production-check, frontend typecheck, "
                    "and browser QA after future UI changes."
                ),
                "Archive the proposal if enough evidence shows no issue.",
            )
            | {"status": "needs_more_evidence"}
        )
    return {
        "summary": (
            "Manual self-review completed from local safe telemetry. "
            f"{len(proposals)} improvement proposals were created."
        ),
        "observations": observations,
        "proposals": proposals,
        "riskLevel": "medium"
        if any(item["riskLevel"] == "medium" for item in proposals)
        else "low",
        "status": "owner_review" if proposals else "completed",
    }


def improvement_proposal_draft(
    proposal_type: str,
    title: str,
    problem_summary: str,
    evidence: list[dict[str, object]],
    affected_modules: list[str],
    risk_level: str,
    expected_benefit: str,
    implementation_sketch: str,
    test_plan: str,
    rollback_plan: str,
) -> dict[str, object]:
    return {
        "type": proposal_type,
        "title": title,
        "problemSummary": problem_summary,
        "evidence": evidence,
        "affectedModules": affected_modules,
        "riskLevel": risk_level,
        "expectedBenefit": expected_benefit,
        "implementationSketch": implementation_sketch,
        "testPlan": test_plan,
        "rollbackPlan": rollback_plan,
        "requiresCodex": True,
        "requiresOwnerApproval": True,
        "priority": "medium" if risk_level == "medium" else "low",
        "status": "owner_review",
        "estimatedComplexity": "small",
        "safetyImpact": "proposal_only_no_execution",
        "dataPrivacyImpact": "safe_metadata_only_no_raw_text",
        "codexPromptDraft": None,
    }


def build_codex_prompt_draft(proposal: dict[str, object]) -> str:
    """Generate an owner-editable task prompt from a safe approved proposal."""
    return "\n".join(
        [
            "You are working in the RIN repository.",
            f"Task: {proposal.get('title', 'RIN improvement proposal')}",
            "",
            "Scope:",
            str(proposal.get("implementationSketch", "")),
            "",
            "Forbidden:",
            (
                "- Do not expose raw prompt, raw memory, hidden reasoning, "
                "API keys, .env values, or secrets."
            ),
            (
                "- Do not enable autonomous tool execution, Git/GitHub writes, "
                "self-code execution, merge, or deploy."
            ),
            "- Do not auto-apply self-model/profile changes.",
            "",
            "Required tests/checks:",
            str(proposal.get("testPlan", "")),
            "",
            "Rollback:",
            str(proposal.get("rollbackPlan", "")),
            "",
            "Final report:",
            "- Changed files",
            "- Safety guarantees",
            "- Tests/checks run",
            "- Remaining risks",
        ]
    )


def build_improvement_proposal_action_response(
    layout: RinDataLayout,
    proposal_id: str,
) -> dict[str, object]:
    proposal = get_improvement_proposal(layout, proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="Improvement proposal not found.")
    return {
        "ok": True,
        "mode": "rin-improvement-proposal-action",
        "readOnly": False,
        "localOnly": True,
        "proposal": proposal.model_dump(mode="json"),
        "executed": False,
        "codeWritten": False,
        "pullRequestCreated": False,
        "rawTextIncluded": False,
        "secretValuesIncluded": False,
    }


def validate_memory_candidate_safe_patch(
    body: MemoryCandidateSafePatchBody,
) -> dict[str, object]:
    """Validate safe display-field edits and translate API names to DB names."""
    updates: dict[str, object] = {}
    if "safeSummary" in body.model_fields_set:
        value = normalize_safe_edit_string(body.safeSummary, "safeSummary", 240)
        updates["safe_summary"] = value
    if "normalizedValue" in body.model_fields_set:
        normalized_value = (
            normalize_safe_edit_string(body.normalizedValue, "normalizedValue", 320)
            if body.normalizedValue is not None
            else None
        )
        updates["normalized_value"] = normalized_value
    if "tags" in body.model_fields_set:
        if body.tags is None:
            tags: list[str] = []
        else:
            tags = [normalize_safe_edit_string(tag, "tag", 40) for tag in body.tags]
        normalized_tags = sorted({tag for tag in tags if tag})
        if len(normalized_tags) > 20:
            raise HTTPException(status_code=400, detail="At most 20 tags are allowed.")
        updates["tags"] = normalized_tags
    if not updates:
        raise HTTPException(status_code=400, detail="No safe edit fields provided.")
    return updates


def normalize_safe_edit_string(
    value: str | None,
    field_name: str,
    max_length: int,
) -> str:
    if value is None:
        return ""
    normalized = value.strip()
    if len(normalized) > max_length:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} exceeds {max_length} characters.",
        )
    if secret_like(normalized):
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} contains secret-like content.",
        )
    return normalized


def secret_like(value: str) -> bool:
    return any(pattern.search(value) for pattern in SECRET_LIKE_PATTERNS)


def count_by(items: Sequence[dict[str, object]], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        label = str(item.get(key, "unknown"))
        counts[label] = counts.get(label, 0) + 1
    return counts


def memory_strength_thresholds() -> dict[str, float]:
    return {"weakening": 0.42, "forgetting": 0.22}


def memory_strength_score(candidate: object, *, now: datetime) -> float:
    salience = float(getattr(candidate, "salience", 0.0))
    confidence = float(getattr(candidate, "confidence", 0.0))
    review_status = str(getattr(candidate, "reviewStatus", "candidate"))
    risk_level = str(getattr(candidate, "riskLevel", "low"))
    stability = str(getattr(candidate, "stability", "medium"))
    active = bool(getattr(candidate, "active", False))
    base = salience * 0.55 + confidence * 0.35
    base += {"stable": 0.08, "medium": 0.04, "volatile": -0.03}.get(stability, 0.0)
    base += {"owner_approved": 0.08, "auto_promoted": 0.05}.get(review_status, 0.0)
    base -= {"medium": 0.04, "high": 0.12, "blocked": 0.45}.get(risk_level, 0.0)
    if not active:
        base -= 0.28
    created_at = parse_iso_datetime(getattr(candidate, "createdAt", None))
    if created_at is not None:
        age_hours = max(0.0, (now - created_at).total_seconds() / 3600)
        half_life_hours = decay_half_life_hours(candidate)
        base *= 0.5 ** (age_hours / half_life_hours)
    return round(max(0.0, min(1.0, base)), 4)


def predicted_decay_points(
    candidate: object,
    *,
    now: datetime,
) -> list[dict[str, object]]:
    created_at = parse_iso_datetime(getattr(candidate, "createdAt", None)) or now
    base = memory_strength_score(candidate, now=created_at)
    half_life_hours = decay_half_life_hours(candidate)
    offsets = [0, 24, 24 * 7, 24 * 30, 24 * 90]
    return [
        {
            "at": (created_at + timedelta(hours=hours))
            .isoformat()
            .replace("+00:00", "Z"),
            "elapsedHours": hours,
            "memoryStrength": round(base * (0.5 ** (hours / half_life_hours)), 4),
        }
        for hours in offsets
    ]


def decay_half_life_hours(candidate: object) -> float:
    policy = str(getattr(candidate, "decayPolicy", "long")).lower()
    risk = str(getattr(candidate, "riskLevel", "low"))
    if risk in {"high", "blocked"}:
        return 24 * 7
    if "review" in policy:
        return 24 * 14
    if "temporary" in policy or "short" in policy:
        return 24 * 3
    return 24 * 90


def parse_iso_datetime(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    except ValueError:
        return None


def iso_or_na(value: datetime | None, fallback: object) -> object:
    if value is None:
        return fallback or "n/a"
    return value.isoformat().replace("+00:00", "Z")


def explain_memory_candidate(candidate: object, strength: float) -> str:
    status = str(getattr(candidate, "reviewStatus", "candidate"))
    risk = str(getattr(candidate, "riskLevel", "low"))
    if risk == "blocked":
        return "This memory is blocked and unavailable for retrieval."
    if status in {"owner_approved", "auto_promoted"}:
        return (
            "This memory can be retrieved because it is approved or auto-promoted, "
            f"active, and has derived strength {strength:.2f}."
        )
    if status in {"candidate", "review_required"}:
        return "This memory remains in review and will not be used as accepted context."
    if status == "inactive":
        return "This memory is inactive and excluded from retrieval."
    return "This memory is rejected and excluded from retrieval."


def estimate_tokens_from_chars(characters: int) -> int:
    return int(math.ceil(max(0, characters) / 4))


def explain_context_plan(plan: object, retrieval: object) -> str:
    selected_count = len(getattr(retrieval, "selected", []))
    excluded_count = len(getattr(retrieval, "excluded", [])) + len(
        getattr(plan, "excludedItems", []),
    )
    return (
        f"Context uses {len(getattr(plan, 'selectedRecentMessageIds', []))} recent "
        f"messages and {selected_count} safe memory items. {excluded_count} sources "
        "were excluded by local relevance, risk, or budget policy."
    )


def provider_duration_from_stages(stages: Sequence[dict[str, object]]) -> int:
    for stage in stages:
        if stage.get("name") in {"raw_model_response", "provider_response"}:
            duration = stage.get("durationMs", 0)
            if isinstance(duration, int):
                return duration
            if isinstance(duration, float):
                return int(duration)
            if isinstance(duration, str) and duration.isdigit():
                return int(duration)
            return 0
    return 0


def build_memory_candidate_action_response(
    layout: RinDataLayout,
    candidate_id: str,
) -> dict[str, object]:
    """Return the updated candidate after an approve/reject action."""
    candidates = list_mind_memory_candidates(layout, limit=100)
    candidate = next((item for item in candidates if item.id == candidate_id), None)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Memory candidate not found.")
    return {
        "ok": True,
        "mode": "rin-mind-memory-candidate-action",
        "readOnly": False,
        "localOnly": True,
        "candidate": candidate.model_dump(mode="json"),
        "rawTextIncluded": False,
        "secretValuesIncluded": False,
    }


def build_growth_event_action_response(
    layout: RinDataLayout,
    event_id: str,
) -> dict[str, object]:
    events = list_rin_growth_events(layout, limit=100)
    event = next((item for item in events if item.id == event_id), None)
    if event is None:
        raise HTTPException(status_code=404, detail="Growth event not found.")
    return {
        "ok": True,
        "mode": "rin-growth-event-action",
        "readOnly": False,
        "localOnly": True,
        "event": event.model_dump(mode="json"),
        "autoApplied": False,
        "rawTextIncluded": False,
        "secretValuesIncluded": False,
    }


def build_tool_request_action_response(
    layout: RinDataLayout,
    request_id: str,
) -> dict[str, object]:
    requests = list_tool_invocation_requests(layout, limit=100)
    request = next((item for item in requests if item.id == request_id), None)
    if request is None:
        raise HTTPException(status_code=404, detail="Tool request not found.")
    return {
        "ok": True,
        "mode": "rin-tool-request-action",
        "readOnly": False,
        "localOnly": True,
        "request": request.model_dump(mode="json"),
        "executed": False,
        "executionDisabledByDefault": True,
        "rawInputIncluded": False,
        "secretValuesIncluded": False,
    }


def active_chat_config(adapter: ModelAdapterProtocol) -> ChatProviderConfig:
    """Return adapter config when present, otherwise current environment config."""
    config = getattr(adapter, "config", None)
    if isinstance(config, ChatProviderConfig):
        return config
    return load_chat_provider_config()


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
    body_report = build_body_report(layout).to_dict()
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
    raw_schema_version = database.get("schemaVersion", 0)
    schema_version = raw_schema_version if isinstance(raw_schema_version, int) else 0
    memory_available = memory_context.get("available") is True
    chat_config = active_chat_config(adapter)
    model_name = getattr(adapter, "model", chat_config.model)
    provider_configured = adapter.id == MockApiAdapter.id or chat_config.configured
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
            "currentState": body_report["currentState"],
        },
        "health": {
            "database": "ok" if schema_version >= 6 else "warning",
            "model": "ok" if provider_configured else "warning",
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
    body_report = build_body_report(layout).to_dict()
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
    chat_config = active_chat_config(adapter)
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
            "providerCallsMade": snapshot["externalProviderCallCount"],
            "adapter": adapter_id,
            "provider": getattr(adapter, "provider", chat_config.provider),
            "model": model_name,
            "baseUrl": chat_config.safeBaseUrl or "n/a",
            "timeoutMs": chat_config.timeoutMs,
            "maxTokens": chat_config.maxTokens,
            "temperature": chat_config.temperature,
            "topP": chat_config.topP,
            "configured": chat_config.configured,
            "configurationStatus": chat_config.configurationStatus,
            "missingEnvironment": chat_config.missingEnvironment,
            "externalApiDisabled": False,
            "smokeStatus": "skipped unless RIN_API_CHAT_* env vars are configured",
            "sanitizerStatus": "thinking output is guarded by adapter tests",
            "apiKeyIncluded": False,
            "secretValuesIncluded": False,
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
            "currentState": body_report["currentState"],
            "manifestPath": body_report["manifestPath"],
            "desktopBodyPath": "/body/floating",
            "secretValuesIncluded": False,
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
    mind_policy = load_mind_policy()
    return {
        "mode": "diagnostics-memory",
        "readOnly": True,
        "localOnly": True,
        "fullTextIncluded": False,
        "algorithm": {
            "shortTermWindowPolicy": (
                "mind-selected prior messages in active conversation, "
                f"max {mind_policy.recentHistorySelectedLimit}"
            ),
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
                "selectedMemorySourceCount",
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
            "No approved memory sources available for retrieval."
            if retrieval_skip_reason in {"no_memory_sources", "no_memory_v2_traces"}
            else "Memory retrieval is active with safe source summaries.",
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
    chat_config = load_chat_provider_config()
    return {
        "ok": True,
        "mode": "python-fastapi-compatibility",
        "localOnly": True,
        "providerCallCount": 0,
        "externalProviderCallCount": status.counts.apiUsageEvents,
        "fullTextIncluded": False,
        "database": {
            "schemaVersion": status.schemaVersion,
            "conversations": status.counts.conversations,
            "messages": status.counts.messages,
            "memoryV2Traces": status.counts.memoryV2Traces,
            "apiUsageEvents": status.counts.apiUsageEvents,
            "mindTurnSnapshots": status.counts.mindTurnSnapshots,
            "memoryCandidates": status.counts.memoryCandidates,
            "conversationSummaries": status.counts.conversationSummaries,
            "modelSummaryCandidates": status.counts.modelSummaryCandidates,
            "rinSelfModel": status.counts.rinSelfModel,
            "rinGrowthEvents": status.counts.rinGrowthEvents,
            "memoryEmbeddings": status.counts.memoryEmbeddings,
            "toolInvocationRequests": status.counts.toolInvocationRequests,
        },
        "profile": profile,
        "modelRuntime": {
            "activeAdapter": chat_config.id,
            "provider": chat_config.provider,
            "model": chat_config.model,
            "configured": chat_config.configured,
            "configurationStatus": chat_config.configurationStatus,
            "localOnly": True,
            "apiKeyIncluded": False,
            "secretValuesIncluded": False,
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
