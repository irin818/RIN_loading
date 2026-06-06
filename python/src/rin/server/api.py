from __future__ import annotations

from fastapi import Depends, FastAPI, HTTPException
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
from rin.diagnostics.safety import assert_safe_temp_data_dir
from rin.profiles import build_profile_report
from rin.storage import RinDataLayout


class ConversationCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = "Python API conversation"


class ConversationSendBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str


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

    @app.get("/readiness")
    def readiness() -> dict[str, object]:
        return build_python_readiness_report().to_dict()

    @app.get("/state")
    def state(current_layout: RinDataLayout = layout_dependency) -> dict[str, object]:
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


def reject_unsafe_write_layout(layout: RinDataLayout) -> None:
    try:
        assert_safe_temp_data_dir(layout.rootDir)
    except Exception as error:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "UNSAFE_DATA_PATH",
                "message": "Python compatibility API writes require /tmp/rin-python-*.",
            },
        ) from error
