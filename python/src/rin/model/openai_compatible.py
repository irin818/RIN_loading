"""OpenAI-compatible external chat adapter for RIN."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from typing import Any

import httpx

from rin.config.chat_provider import ChatProviderConfig, load_chat_provider_config
from rin.contracts import (
    ModelErrorDetails,
    ModelMessage,
    ModelRequest,
    ModelResponse,
    ModelResponseMetadata,
)
from rin.model.errors import ModelError

API_CHAT_ADAPTER_ID = "rin-api-chat-openai-compatible"
OPENAI_COMPATIBLE_PROVIDER = "openai-compatible"


@dataclass(frozen=True)
class OpenAICompatibleChatAdapter:
    """Non-streaming OpenAI-compatible chat completion adapter."""

    config: ChatProviderConfig
    id: str = API_CHAT_ADAPTER_ID
    displayName: str = "OpenAI-compatible API chat adapter"
    client: httpx.AsyncClient | None = None

    @property
    def provider(self) -> str:
        return self.config.provider

    @property
    def model(self) -> str:
        return self.config.model

    @property
    def baseUrl(self) -> str:
        return self.config.safeBaseUrl or "n/a"

    @property
    def timeoutMs(self) -> int:
        return self.config.timeoutMs

    async def generate(self, request: ModelRequest) -> ModelResponse:
        """Send one non-streaming chat completion request."""
        if not self.config.configured:
            raise self.error(
                "API_PROVIDER_UNCONFIGURED",
                "External API chat provider is not configured.",
                ModelErrorDetails(
                    baseUrl=self.config.safeBaseUrl,
                    model=self.config.model,
                    responseFields=self.config.missingEnvironment,
                ),
                retryable=False,
            )

        endpoint = chat_completions_endpoint(self.config.baseUrl or "")
        body = {
            "model": self.config.model,
            "messages": [
                to_openai_chat_message(message) for message in request.messages
            ],
            "stream": False,
            "temperature": self.config.temperature,
            "max_tokens": self.config.maxTokens,
            "top_p": self.config.topP,
        }
        headers = {
            "Authorization": f"Bearer {self.config.apiKey}",
            "Content-Type": "application/json",
        }
        try:
            if self.client is None:
                async with httpx.AsyncClient(
                    timeout=self.config.timeoutMs / 1000,
                ) as client:
                    response = await client.post(endpoint, json=body, headers=headers)
            else:
                response = await self.client.post(endpoint, json=body, headers=headers)
        except httpx.TimeoutException as error:
            raise self.error(
                "API_PROVIDER_TIMEOUT",
                "External API chat provider timed out.",
            ) from error
        except httpx.HTTPError as error:
            raise self.error(
                "API_PROVIDER_UNAVAILABLE",
                "External API chat provider is unavailable.",
            ) from error

        payload = read_json_payload(self, response)
        if response.status_code < 200 or response.status_code >= 300:
            raise classify_http_error(self, response.status_code, payload)

        content = read_assistant_content(self, payload)
        usage = read_usage(payload)
        return ModelResponse(
            content=content,
            adapterId=self.id,
            metadata=ModelResponseMetadata(
                externalProvider=True,
                memoryWriteRequested=False,
                toolCallRequested=False,
                providerId=self.id,
                provider=self.provider,
                model=self.config.model,
                safeBaseUrl=self.config.safeBaseUrl,
                promptTokens=usage.get("prompt_tokens"),
                completionTokens=usage.get("completion_tokens"),
                totalTokens=usage.get("total_tokens"),
                usageSource="provider" if usage else None,
                rawContentLength=len(content),
                rawContentHash=short_hash(content),
                rawPreview=None,
                rawModelOutputIncluded=False,
                secretValuesIncluded=False,
            ),
        )

    def error(
        self,
        code: str,
        message: str,
        details: ModelErrorDetails | None = None,
        *,
        retryable: bool | None = None,
    ) -> ModelError:
        base = ModelErrorDetails(
            baseUrl=self.config.safeBaseUrl,
            model=self.config.model,
        )
        merged = merge_details(base, details)
        return ModelError(
            code,  # type: ignore[arg-type]
            message,
            self.id,
            self.provider,
            retryable=retryable,
            details=merged,
        )


def create_api_chat_adapter_from_env() -> OpenAICompatibleChatAdapter:
    """Build the active external API chat adapter from central environment config."""
    return OpenAICompatibleChatAdapter(config=load_chat_provider_config())


def chat_completions_endpoint(base_url: str) -> str:
    """Return the chat-completions endpoint for an OpenAI-compatible base URL."""
    clean = base_url.rstrip("/")
    if clean.endswith("/chat/completions"):
        return clean
    return f"{clean}/chat/completions"


def to_openai_chat_message(message: ModelMessage) -> dict[str, str]:
    """Map RIN roles to OpenAI-compatible chat roles."""
    role = {"system": "system", "owner": "user", "rin": "assistant"}[message.role]
    return {"role": role, "content": message.content}


def read_json_payload(
    adapter: OpenAICompatibleChatAdapter,
    response: httpx.Response,
) -> Any:
    if not response.text.strip():
        return {}
    try:
        return response.json()
    except ValueError as error:
        raise adapter.error(
            "API_PROVIDER_RESPONSE_INVALID",
            "External API provider returned non-JSON response.",
            ModelErrorDetails(statusCode=response.status_code),
        ) from error


def classify_http_error(
    adapter: OpenAICompatibleChatAdapter,
    status_code: int,
    payload: Any,
) -> ModelError:
    provider_error_code = provider_error_code_from_payload(payload)
    details = ModelErrorDetails(
        statusCode=status_code,
        providerErrorCode=provider_error_code,
        responseFields=response_fields(payload) if isinstance(payload, dict) else [],
    )
    if status_code in {401, 403}:
        return adapter.error(
            "API_PROVIDER_AUTH_ERROR",
            "External API provider rejected authentication.",
            details,
            retryable=False,
        )
    if status_code == 429:
        return adapter.error(
            "API_PROVIDER_RATE_LIMITED",
            "External API provider rate limited the request.",
            details,
        )
    return adapter.error(
        "API_PROVIDER_ERROR",
        f"External API provider returned HTTP {status_code}.",
        details,
    )


def read_assistant_content(adapter: OpenAICompatibleChatAdapter, payload: Any) -> str:
    """Extract choices[0].message.content from a chat completion payload."""
    if not isinstance(payload, dict):
        raise invalid_response(adapter, "Provider response was not an object.", payload)
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise invalid_response(
            adapter,
            "Provider response did not include choices.",
            payload,
        )
    first = choices[0]
    if not isinstance(first, dict):
        raise invalid_response(adapter, "Provider choice was not an object.", payload)
    message = first.get("message")
    if not isinstance(message, dict):
        raise invalid_response(
            adapter,
            "Provider choice did not include message.",
            payload,
        )
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise adapter.error(
            "API_PROVIDER_RESPONSE_INVALID",
            "Provider response did not include non-empty assistant content.",
            ModelErrorDetails(
                emptyContent=True,
                responseFields=response_fields(payload),
            ),
        )
    return content


def invalid_response(
    adapter: OpenAICompatibleChatAdapter,
    message: str,
    payload: Any,
) -> ModelError:
    return adapter.error(
        "API_PROVIDER_RESPONSE_INVALID",
        message,
        ModelErrorDetails(
            responseFields=(
                response_fields(payload) if isinstance(payload, dict) else []
            ),
        ),
    )


def read_usage(payload: Any) -> dict[str, int]:
    """Read provider token usage when present and complete."""
    if not isinstance(payload, dict) or not isinstance(payload.get("usage"), dict):
        return {}
    usage = payload["usage"]
    result: dict[str, int] = {}
    for source_key in ("prompt_tokens", "completion_tokens", "total_tokens"):
        value = usage.get(source_key)
        if isinstance(value, int) and value >= 0:
            result[source_key] = value
    return result


def provider_error_code_from_payload(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    error = payload.get("error")
    if not isinstance(error, dict):
        return None
    code = error.get("code")
    return str(code) if code is not None else None


def response_fields(payload: dict[str, Any]) -> list[str]:
    fields = sorted(str(key) for key in payload)
    choices = payload.get("choices")
    if isinstance(choices, list) and choices and isinstance(choices[0], dict):
        fields.extend(f"choices.0.{key}" for key in sorted(choices[0]))
        message = choices[0].get("message")
        if isinstance(message, dict):
            fields.extend(f"choices.0.message.{key}" for key in sorted(message))
    usage = payload.get("usage")
    if isinstance(usage, dict):
        fields.extend(f"usage.{key}" for key in sorted(usage))
    return fields


def short_hash(content: str) -> str:
    return sha256(content.encode("utf-8")).hexdigest()[:12]


def merge_details(
    base: ModelErrorDetails,
    extra: ModelErrorDetails | None,
) -> ModelErrorDetails:
    if extra is None:
        return base
    return ModelErrorDetails(
        baseUrl=extra.baseUrl or base.baseUrl,
        model=extra.model or base.model,
        statusCode=extra.statusCode,
        providerErrorCode=extra.providerErrorCode,
        emptyContent=extra.emptyContent,
        emptyAfterThinkingRemoval=extra.emptyAfterThinkingRemoval,
        possibleReasoningOnlyOutput=extra.possibleReasoningOnlyOutput,
        thinkingArtifactRemoved=extra.thinkingArtifactRemoved,
        unsafeContentIssue=extra.unsafeContentIssue,
        responseFields=extra.responseFields,
    )
