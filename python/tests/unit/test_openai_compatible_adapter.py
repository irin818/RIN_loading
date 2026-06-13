import json
from typing import Any

import httpx
import pytest

from rin.config.chat_provider import ChatProviderConfig, load_chat_provider_config
from rin.contracts import ModelMessage, ModelRequest
from rin.model import sanitize_assistant_content
from rin.model.errors import ModelError
from rin.model.openai_compatible import OpenAICompatibleChatAdapter


def config(
    *,
    base_url: str | None = "https://api.example.test/v1",
    api_key: str | None = "test-key",
    thinking_mode: str | None = None,
) -> ChatProviderConfig:
    return ChatProviderConfig(
        provider="openai-compatible",
        baseUrl=base_url,
        apiKey=api_key,
        model="qwen-long",
        timeoutMs=180_000,
        temperature=0.5,
        maxTokens=1024,
        topP=0.9,
        thinkingMode=thinking_mode,
    )


def request(messages: list[ModelMessage] | None = None) -> ModelRequest:
    return ModelRequest(
        ownerId="local-owner",
        conversationId="conv-1",
        messages=messages or [ModelMessage(role="owner", content="hello")],
    )


@pytest.mark.asyncio
async def test_openai_compatible_request_shape_and_usage_metadata() -> None:
    captured: dict[str, Any] = {}

    def handler(http_request: httpx.Request) -> httpx.Response:
        captured["url"] = str(http_request.url)
        captured["auth"] = http_request.headers.get("authorization")
        captured["body"] = json.loads(http_request.content.decode("utf-8"))
        return httpx.Response(
            200,
            json={
                "choices": [
                    {"message": {"role": "assistant", "content": "API response"}}
                ],
                "usage": {
                    "prompt_tokens": 11,
                    "completion_tokens": 7,
                    "total_tokens": 18,
                },
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = OpenAICompatibleChatAdapter(config=config(), client=client)
        response = await adapter.generate(
            request(
                [
                    ModelMessage(role="system", content="system"),
                    ModelMessage(role="owner", content="hello"),
                    ModelMessage(role="rin", content="ack"),
                ]
            )
        )

    assert captured["url"] == "https://api.example.test/v1/chat/completions"
    assert captured["auth"] == "Bearer test-key"
    assert captured["body"] == {
        "model": "qwen-long",
        "messages": [
            {"role": "system", "content": "system"},
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "ack"},
        ],
        "stream": False,
        "temperature": 0.5,
        "max_tokens": 1024,
        "top_p": 0.9,
    }
    assert "thinking" not in captured["body"]
    assert response.content == "API response"
    assert response.adapterId == "rin-api-chat-openai-compatible"
    assert response.metadata.externalProvider is True
    assert response.metadata.promptTokens == 11
    assert response.metadata.completionTokens == 7
    assert response.metadata.totalTokens == 18
    assert response.metadata.rawModelOutputIncluded is False
    assert response.metadata.secretValuesIncluded is False
    assert response.metadata.rawPreview is None


@pytest.mark.asyncio
async def test_missing_api_key_is_unconfigured_error() -> None:
    adapter = OpenAICompatibleChatAdapter(config=config(api_key=None))

    with pytest.raises(ModelError) as captured:
        await adapter.generate(request())

    error = captured.value
    assert error.code == "API_PROVIDER_UNCONFIGURED"
    assert error.retryable is False
    assert error.details.responseFields == ["RIN_API_CHAT_KEY"]


@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", [401, 403])
async def test_auth_errors_map_to_auth_code(status_code: int) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(
                status_code,
                json={"error": {"code": "bad_auth"}},
            )
        )
    ) as client:
        adapter = OpenAICompatibleChatAdapter(config=config(), client=client)
        with pytest.raises(ModelError) as captured:
            await adapter.generate(request())

    assert captured.value.code == "API_PROVIDER_AUTH_ERROR"
    assert captured.value.retryable is False
    assert captured.value.details.statusCode == status_code
    assert captured.value.details.providerErrorCode == "bad_auth"


@pytest.mark.asyncio
async def test_rate_limit_maps_to_rate_limited() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _request: httpx.Response(429, json={}))
    ) as client:
        adapter = OpenAICompatibleChatAdapter(config=config(), client=client)
        with pytest.raises(ModelError) as captured:
            await adapter.generate(request())

    assert captured.value.code == "API_PROVIDER_RATE_LIMITED"
    assert captured.value.retryable is True


@pytest.mark.asyncio
async def test_timeout_maps_to_timeout() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("timeout")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = OpenAICompatibleChatAdapter(config=config(), client=client)
        with pytest.raises(ModelError) as captured:
            await adapter.generate(request())

    assert captured.value.code == "API_PROVIDER_TIMEOUT"


@pytest.mark.asyncio
async def test_malformed_response_maps_to_invalid() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(200, json={"choices": []})
        )
    ) as client:
        adapter = OpenAICompatibleChatAdapter(config=config(), client=client)
        with pytest.raises(ModelError) as captured:
            await adapter.generate(request())

    assert captured.value.code == "API_PROVIDER_RESPONSE_INVALID"
    assert captured.value.retryable is True


def test_sanitizer_keeps_content_after_closing_think_marker() -> None:
    content, removed = sanitize_assistant_content("</think>\n今晚可以吃面。")

    assert removed is True
    assert content == "今晚可以吃面。"


def test_sanitizer_extracts_chinese_final_answer_after_analysis() -> None:
    content, removed = sanitize_assistant_content(
        "首先，用户问晚饭吃什么。我需要分析。\n最终答案：今晚可以吃番茄鸡蛋面。"
    )

    assert removed is True
    assert content == "今晚可以吃番茄鸡蛋面。"


def test_sanitizer_rejects_unclosed_think_even_with_final_marker() -> None:
    content, removed = sanitize_assistant_content(
        "<think>private reasoning\n最终答案：今晚可以吃面。"
    )

    assert removed is False
    assert content == ""


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "thinking_mode,expected_thinking",
    [
        ("disabled", {"type": "disabled"}),
        ("enabled", {"type": "enabled"}),
    ],
)
async def test_thinking_mode_adds_field_to_request_body(
    thinking_mode: str, expected_thinking: dict[str, str]
) -> None:
    captured_body: dict[str, Any] = {}

    def handler(http_request: httpx.Request) -> httpx.Response:
        captured_body.update(json.loads(http_request.content.decode("utf-8")))
        return httpx.Response(
            200,
            json={
                "choices": [
                    {"message": {"role": "assistant", "content": "API response"}}
                ],
                "usage": {
                    "prompt_tokens": 5,
                    "completion_tokens": 3,
                    "total_tokens": 8,
                },
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = OpenAICompatibleChatAdapter(
            config=config(thinking_mode=thinking_mode), client=client
        )
        await adapter.generate(request())

    assert captured_body["thinking"] == expected_thinking


@pytest.mark.asyncio
async def test_unsafe_thinking_mode_returns_clear_config_error() -> None:
    with pytest.raises(ValueError) as captured:
        load_chat_provider_config({"RIN_API_CHAT_THINKING": "unsafe"})

    message = str(captured.value)
    assert "Invalid RIN_API_CHAT_THINKING value" in message
    assert "unsafe" in message
    assert "disabled" in message
    assert "enabled" in message
