"""Optional smoke test for the configured external API chat provider."""

from __future__ import annotations

from dataclasses import dataclass

from rin.config.chat_provider import load_chat_provider_config
from rin.contracts import ModelMessage, ModelRequest
from rin.model.errors import ModelError
from rin.model.openai_compatible import create_api_chat_adapter_from_env


@dataclass(frozen=True)
class ApiChatSmokeReport:
    """Result of an external API chat smoke test."""

    mode: str
    status: str
    adapter: str
    provider: str
    model: str | None
    externalProviderCallCount: int
    success: bool
    contentLength: int
    errorCode: str | None
    retryable: bool | None
    fullTextIncluded: bool
    rawProviderResponseIncluded: bool
    secretValuesIncluded: bool


async def run_api_chat_smoke() -> ApiChatSmokeReport:
    """Send a tiny prompt only when the external API provider is configured."""
    config = load_chat_provider_config()
    adapter = create_api_chat_adapter_from_env()
    if not config.configured:
        return ApiChatSmokeReport(
            mode="api-chat-smoke",
            status=config.configurationStatus,
            adapter=adapter.id,
            provider=config.provider,
            model=config.model,
            externalProviderCallCount=0,
            success=False,
            contentLength=0,
            errorCode="API_PROVIDER_UNCONFIGURED",
            retryable=False,
            fullTextIncluded=False,
            rawProviderResponseIncluded=False,
            secretValuesIncluded=False,
        )
    try:
        response = await adapter.generate(
            ModelRequest(
                ownerId="local-owner",
                conversationId="api-chat-smoke",
                messages=[
                    ModelMessage(
                        role="system",
                        content="Return only final assistant content.",
                    ),
                    ModelMessage(role="owner", content="Reply with OK."),
                ],
            )
        )
        return ApiChatSmokeReport(
            mode="api-chat-smoke",
            status="success",
            adapter=adapter.id,
            provider=config.provider,
            model=config.model,
            externalProviderCallCount=1,
            success=True,
            contentLength=len(response.content),
            errorCode=None,
            retryable=None,
            fullTextIncluded=False,
            rawProviderResponseIncluded=False,
            secretValuesIncluded=False,
        )
    except ModelError as error:
        return ApiChatSmokeReport(
            mode="api-chat-smoke",
            status="failed",
            adapter=error.adapterId,
            provider=error.provider,
            model=error.details.model,
            externalProviderCallCount=1,
            success=False,
            contentLength=0,
            errorCode=error.code,
            retryable=error.retryable,
            fullTextIncluded=False,
            rawProviderResponseIncluded=False,
            secretValuesIncluded=False,
        )


def format_api_chat_smoke_report(report: ApiChatSmokeReport) -> str:
    """Render an ApiChatSmokeReport as a human-readable multi-line string."""
    return "\n".join(
        [
            "RIN Python API chat smoke report.",
            f"Mode: {report.mode}",
            f"Status: {report.status}",
            f"Adapter: {report.adapter}",
            f"Provider: {report.provider}",
            f"Model: {report.model or 'none'}",
            f"Success: {'yes' if report.success else 'no'}",
            f"Content length: {report.contentLength}",
            f"Error code: {report.errorCode or 'none'}",
            f"Retryable: {report.retryable if report.retryable is not None else 'n/a'}",
            f"External provider calls: {report.externalProviderCallCount}",
            f"Full text included: {'yes' if report.fullTextIncluded else 'no'}",
            "Raw provider response included: "
            f"{'yes' if report.rawProviderResponseIncluded else 'no'}",
            f"Secret values included: {'yes' if report.secretValuesIncluded else 'no'}",
        ]
    )
