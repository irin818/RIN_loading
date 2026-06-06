from __future__ import annotations

import os
from dataclasses import dataclass

from rin.contracts import ModelMessage, ModelRequest
from rin.model.ollama import (
    OLLAMA_ADAPTER_ID,
    ModelError,
    create_ollama_adapter_from_env,
)


@dataclass(frozen=True)
class LocalChatSmokeReport:
    mode: str
    status: str
    adapter: str
    provider: str
    model: str | None
    localModelCallCount: int
    externalProviderCallCount: int
    success: bool
    contentLength: int
    errorCode: str | None
    retryable: bool | None
    fullTextIncluded: bool
    rawProviderResponseIncluded: bool
    thinkingIncluded: bool


async def run_local_chat_smoke() -> LocalChatSmokeReport:
    active_adapter = os.environ.get("RIN_MODEL_ADAPTER", "rin-mock-local")
    model = os.environ.get("RIN_OLLAMA_MODEL", "qwen3:4b")
    if active_adapter != OLLAMA_ADAPTER_ID:
        return LocalChatSmokeReport(
            mode="local-chat-smoke",
            status="skipped_not_selected",
            adapter=active_adapter,
            provider="unknown",
            model=model,
            localModelCallCount=0,
            externalProviderCallCount=0,
            success=False,
            contentLength=0,
            errorCode=None,
            retryable=None,
            fullTextIncluded=False,
            rawProviderResponseIncluded=False,
            thinkingIncluded=False,
        )
    adapter = create_ollama_adapter_from_env()
    try:
        response = await adapter.generate(
            ModelRequest(
                ownerId="local-owner",
                conversationId="local-chat-smoke",
                messages=[
                    ModelMessage(
                        role="system",
                        content="Return only final assistant content.",
                    ),
                    ModelMessage(
                        role="owner",
                        content="请直接用两句话给一个简单晚饭建议。不要展开推理。",
                    ),
                ],
            )
        )
        return LocalChatSmokeReport(
            mode="local-chat-smoke",
            status="success",
            adapter=adapter.id,
            provider="local",
            model=adapter.model,
            localModelCallCount=1,
            externalProviderCallCount=0,
            success=True,
            contentLength=len(response.content),
            errorCode=None,
            retryable=None,
            fullTextIncluded=False,
            rawProviderResponseIncluded=False,
            thinkingIncluded=False,
        )
    except ModelError as error:
        unavailable = error.code in {"LOCAL_MODEL_UNAVAILABLE", "LOCAL_MODEL_MISSING"}
        return LocalChatSmokeReport(
            mode="local-chat-smoke",
            status="unavailable" if unavailable else "failed",
            adapter=error.adapterId,
            provider="local",
            model=error.details.model,
            localModelCallCount=1,
            externalProviderCallCount=0,
            success=False,
            contentLength=0,
            errorCode=error.code,
            retryable=error.retryable,
            fullTextIncluded=False,
            rawProviderResponseIncluded=False,
            thinkingIncluded=False,
        )


def format_local_chat_smoke_report(report: LocalChatSmokeReport) -> str:
    return "\n".join(
        [
            "RIN Python local chat smoke report.",
            f"Mode: {report.mode}",
            f"Status: {report.status}",
            f"Adapter: {report.adapter}",
            f"Provider: {report.provider}",
            f"Model: {report.model or 'none'}",
            f"Success: {'yes' if report.success else 'no'}",
            f"Content length: {report.contentLength}",
            f"Error code: {report.errorCode or 'none'}",
            f"Retryable: {report.retryable if report.retryable is not None else 'n/a'}",
            f"Local model calls: {report.localModelCallCount}",
            f"External provider calls: {report.externalProviderCallCount}",
            f"Full text included: {'yes' if report.fullTextIncluded else 'no'}",
            "Raw provider response included: "
            f"{'yes' if report.rawProviderResponseIncluded else 'no'}",
            f"Thinking included: {'yes' if report.thinkingIncluded else 'no'}",
        ]
    )
