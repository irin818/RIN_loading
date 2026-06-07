import json
from typing import Any

import httpx
import pytest

from rin.contracts import ModelMessage, ModelRequest
from rin.model.local_chat_smoke import run_local_chat_smoke
from rin.model.ollama import (
    ModelError,
    OllamaAdapter,
    OllamaGenerationOptions,
    sanitize_assistant_content,
)


def request(messages: list[ModelMessage] | None = None) -> ModelRequest:
    return ModelRequest(
        ownerId="local-owner",
        conversationId="conv-1",
        messages=messages or [ModelMessage(role="owner", content="hello")],
    )


@pytest.mark.asyncio
async def test_ollama_request_shape_uses_think_false() -> None:
    captured: dict[str, Any] = {}

    def handler(http_request: httpx.Request) -> httpx.Response:
        captured["url"] = str(http_request.url)
        captured["body"] = json.loads(http_request.content.decode("utf-8"))
        return httpx.Response(
            200,
            json={"message": {"role": "assistant", "content": "local response"}},
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = OllamaAdapter(
            baseUrl="http://127.0.0.1:11434/",
            model="qwen3:4b",
            generationOptions=OllamaGenerationOptions(
                numPredict=256,
                temperature=0.5,
                topP=0.85,
            ),
            client=client,
        )
        response = await adapter.generate(
            request(
                [
                    ModelMessage(role="system", content="system"),
                    ModelMessage(role="owner", content="hello"),
                    ModelMessage(role="rin", content="ack"),
                ]
            )
        )

    assert captured["url"] == "http://127.0.0.1:11434/api/chat"
    assert captured["body"] == {
        "model": "qwen3:4b",
        "messages": [
            {"role": "system", "content": "system"},
            {"role": "user", "content": "hello"},
            {"role": "assistant", "content": "ack"},
        ],
        "stream": False,
        "think": False,
        "options": {"num_predict": 256, "temperature": 0.5, "top_p": 0.85},
    }
    assert response.content == "local response"
    assert response.metadata.externalProvider is False
    assert response.metadata.rawContentLength == len("local response")
    assert response.metadata.rawContentHash
    assert response.metadata.adapterSanitized is False


@pytest.mark.asyncio
async def test_empty_thinking_only_content_is_safe_error() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(
                200,
                json={
                    "message": {
                        "role": "assistant",
                        "content": "",
                        "thinking": "private reasoning",
                    },
                    "done": True,
                },
            )
        )
    ) as client:
        adapter = OllamaAdapter(client=client)
        with pytest.raises(ModelError) as captured:
            await adapter.generate(request())

    error = captured.value
    assert error.code == "MODEL_RESPONSE_INVALID"
    assert error.retryable is True
    assert error.details.emptyContent is True
    assert error.details.possibleReasoningOnlyOutput is True
    assert error.details.responseFields == [
        "done",
        "message",
        "message.content",
        "message.role",
        "message.thinking",
    ]
    assert "private reasoning" not in json.dumps(error.details.__dict__)


@pytest.mark.asyncio
async def test_thinking_tags_are_stripped_from_final_content() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(
                200,
                json={
                    "message": {
                        "role": "assistant",
                        "content": "<think>private</think>\n\n今晚可以吃番茄鸡蛋面。",
                    }
                },
            )
        )
    ) as client:
        adapter = OllamaAdapter(client=client)
        response = await adapter.generate(request())

    assert response.content == "今晚可以吃番茄鸡蛋面。"
    assert "private" not in response.content
    assert "<think>" not in response.content
    assert response.metadata.rawContentLength == len(
        "<think>private</think>\n\n今晚可以吃番茄鸡蛋面。"
    )
    assert response.metadata.adapterSanitized is True
    assert response.metadata.adapterRemovedCharacterCount
    assert response.metadata.rawModelOutputIncluded is False


def test_sanitizer_keeps_content_after_closing_think_marker() -> None:
    content, removed = sanitize_assistant_content("</think>\n今晚可以吃面。")

    assert removed is True
    assert content == "今晚可以吃面。"


def test_sanitizer_extracts_final_answer_after_closing_marker() -> None:
    content, removed = sanitize_assistant_content("</think>\n最终回答：今晚吃面。")

    assert removed is True
    assert content == "今晚吃面。"


def test_sanitizer_extracts_chinese_final_answer_after_analysis() -> None:
    content, removed = sanitize_assistant_content(
        "首先，用户问晚饭吃什么。我需要分析。\n最终答案：今晚可以吃番茄鸡蛋面。"
    )

    assert removed is True
    assert content == "今晚可以吃番茄鸡蛋面。"


def test_sanitizer_rejects_thinking_only_chinese_preface() -> None:
    content, removed = sanitize_assistant_content(
        "首先，用户问晚饭吃什么。我需要分析用户偏好。"
    )

    assert removed is False
    assert content == ""


def test_sanitizer_rejects_we_need_analysis_preface() -> None:
    content, removed = sanitize_assistant_content("我们需要检查是否符合系统要求。")

    assert removed is False
    assert content == ""


def test_sanitizer_rejects_qwen3_english_analysis_preface() -> None:
    content, removed = sanitize_assistant_content(
        "Okay, the user is asking what to eat tonight. Let me check history."
    )

    assert removed is False
    assert content == ""


def test_sanitizer_keeps_normal_chinese_answer() -> None:
    content, removed = sanitize_assistant_content("今晚可以吃番茄鸡蛋面。")

    assert removed is False
    assert content == "今晚可以吃番茄鸡蛋面。"


@pytest.mark.asyncio
async def test_chinese_internal_analysis_without_final_answer_is_safe_error() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(
                200,
                json={
                    "message": {
                        "role": "assistant",
                        "content": "首先，用户问晚饭吃什么。我需要分析用户偏好。",
                    }
                },
            )
        )
    ) as client:
        adapter = OllamaAdapter(client=client)
        with pytest.raises(ModelError) as captured:
            await adapter.generate(request())

    assert captured.value.code == "MODEL_RESPONSE_INVALID"


@pytest.mark.asyncio
async def test_non_2xx_missing_model_is_structured_error() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(404, json={"error": "model is missing"})
        )
    ) as client:
        adapter = OllamaAdapter(client=client)
        with pytest.raises(ModelError) as captured:
            await adapter.generate(request())

    assert captured.value.code == "LOCAL_MODEL_MISSING"
    assert captured.value.retryable is False


@pytest.mark.asyncio
async def test_local_chat_smoke_skips_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("RIN_MODEL_ADAPTER", raising=False)

    report = await run_local_chat_smoke()

    assert report.status == "skipped_not_selected"
    assert report.localModelCallCount == 0
    assert report.externalProviderCallCount == 0
    assert report.fullTextIncluded is False
