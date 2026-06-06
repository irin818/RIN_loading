from __future__ import annotations

from html import escape
from typing import cast

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, ConfigDict

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
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> HTMLResponse:
        return render_console_page(current_layout, current_adapter)

    @app.get("/ui", response_class=HTMLResponse)
    def ui(
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
    ) -> HTMLResponse:
        return render_console_page(current_layout, current_adapter)

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
        body: ConversationSendBody,
        current_layout: RinDataLayout = layout_dependency,
        current_adapter: ModelAdapterProtocol = adapter_dependency,
        current_clock: RuntimeClock = clock_dependency,
    ) -> HTMLResponse:
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
                current_layout,
                current_adapter,
                selected_conversation_id=target_conversation_id,
                notice=f"Reply stored with turn {result['turnId']}.",
            )
        except Exception as error:
            return render_console_page(
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
    layout: RinDataLayout,
    adapter: ModelAdapterProtocol,
    *,
    selected_conversation_id: str | None = None,
    notice: str | None = None,
    error: str | None = None,
) -> HTMLResponse:
    snapshot = local_console_snapshot(layout)
    database = cast(dict[str, object], snapshot["database"])
    memory_context = cast(dict[str, object], snapshot["memoryContext"])
    readiness = build_python_readiness_report().to_dict()
    conversations = list_conversations(layout, limit=20)
    selected = selected_conversation_id or (
        conversations[0].id if conversations else None
    )
    messages = list_messages(layout, selected) if selected else []
    profile = snapshot["profile"]
    profile_status = (
        profile.get("status", "unknown") if isinstance(profile, dict) else "unknown"
    )
    profile_files = profile.get("files", []) if isinstance(profile, dict) else []
    profile_file_count = len(profile_files) if isinstance(profile_files, list) else 0
    adapter_id = adapter.id
    local_model_status = (
        "selected" if adapter_id == "rin-ollama-local" else "not selected"
    )
    conversation_options = "\n".join(
        [
            '<option value="'
            + escape(item.id)
            + ('" selected>' if item.id == selected else '">')
            + escape(item.title)
            + "</option>"
            for item in conversations
        ]
    )
    messages_html = "\n".join(
        [
            f"<article class='message {escape(item.role)}'>"
            f"<strong>{escape(item.role)}</strong>"
            f"<p>{escape(item.content)}</p>"
            "</article>"
            for item in messages
        ]
    )
    notice_html = f"<p class='notice'>{escape(notice)}</p>" if notice else ""
    error_html = f"<p class='error'>{escape(error)}</p>" if error else ""
    body = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RIN Python Console</title>
    <style>
      body {{ font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.4; }}
      main {{ max-width: 900px; margin: auto; }}
      textarea {{ box-sizing: border-box; min-height: 7rem; width: 100%; }}
      select, button {{ font: inherit; margin-top: 0.5rem; }}
      .status, .message {{ border: 1px solid #ddd; border-radius: 8px; padding: 1rem; }}
      .message {{ margin: 0.75rem 0; }}
      .owner {{ background: #f7fbff; }}
      .rin {{ background: #f8fff7; }}
      .notice {{ color: #0a5; }}
      .error {{ color: #b00020; white-space: pre-wrap; }}
    </style>
  </head>
  <body>
    <main>
      <h1>RIN Python Console</h1>
      <p><strong>Identity:</strong> Python-primary local RIN runtime.</p>
      <section class="status">
        <p><strong>Runtime:</strong> Python FastAPI local-only</p>
        <p><strong>Ready:</strong> {readiness["ok"]}</p>
        <p><strong>Adapter:</strong> {escape(adapter_id)}</p>
        <p><strong>Local model:</strong> {escape(local_model_status)}</p>
        <p><strong>Schema:</strong> {database["schemaVersion"]}</p>
        <p><strong>Conversations:</strong> {database["conversations"]}</p>
        <p><strong>Messages:</strong> {database["messages"]}</p>
        <p><strong>Profile status:</strong> {escape(str(profile_status))}</p>
        <p><strong>Profile files:</strong> {profile_file_count}</p>
        <p><strong>Memory V2 traces:</strong> {memory_context["memoryV2Traces"]}</p>
        <p>
          <strong>Trace full text included:</strong>
          {memory_context["fullTextIncluded"]}
        </p>
        <p>
          <strong>External API calls:</strong>
          {snapshot["externalProviderCallCount"]}
        </p>
        <p><strong>Reload behavior:</strong> safe read-only refresh.</p>
      </section>
      {notice_html}
      {error_html}
      <section>
        <h2>Chat</h2>
        <form id="chat-form">
          <label>
            Conversation
            <select name="conversationId">
              <option value="">New conversation</option>
              {conversation_options}
            </select>
          </label>
          <label>
            Message
            <textarea name="content" required></textarea>
          </label>
          <button type="submit">Send</button>
        </form>
      </section>
      <section>
        <h2>Conversation History</h2>
        {messages_html or "<p>No messages yet.</p>"}
      </section>
    </main>
    <script>
      const formElement = document.getElementById("chat-form");
      formElement.addEventListener("submit", async (event) => {{
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const payload = {{
          content: String(form.get("content") || ""),
          conversationId: String(form.get("conversationId") || "") || null,
        }};
        const response = await fetch("/ui/chat", {{
          method: "POST",
          headers: {{ "Content-Type": "application/json" }},
          body: JSON.stringify(payload),
        }});
        document.open();
        document.write(await response.text());
        document.close();
      }});
    </script>
  </body>
</html>
"""
    return HTMLResponse(body)


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
