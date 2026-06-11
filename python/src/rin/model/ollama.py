"""Ollama local model adapter with thinking-artifact sanitization.

Talks to a local Ollama server via its /api/chat endpoint. Sanitizes responses by
stripping <think> blocks, thinking-like prefaces, and unsafe reasoning markers.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from hashlib import sha256
from typing import Any, Literal

import httpx

from rin.contracts import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    ModelResponseMetadata,
)

# ---- Adapter identity and defaults ----
OLLAMA_ADAPTER_ID = "rin-ollama-local"
OLLAMA_DEFAULT_BASE_URL = "http://127.0.0.1:11434"
OLLAMA_DEFAULT_MODEL = "qwen3:4b"
OLLAMA_DEFAULT_NUM_PREDICT = 1024
OLLAMA_DEFAULT_TEMPERATURE = 0.5
OLLAMA_DEFAULT_TIMEOUT_MS = 180_000
OLLAMA_DEFAULT_TOP_P = 0.9
# Keys in the Ollama response payload that may carry reasoning/thinking content.
REASONING_KEYS = {"thinking", "reasoning", "reason", "thought", "thoughts"}

ModelErrorCode = Literal[
    "LOCAL_MODEL_TIMEOUT",
    "LOCAL_MODEL_UNAVAILABLE",
    "LOCAL_MODEL_MISSING",
    "MODEL_PROVIDER_ERROR",
    "MODEL_RESPONSE_INVALID",
]


@dataclass(frozen=True)
class OllamaGenerationOptions:
    """
    Generation parameters forwarded to the Ollama API (num_predict, temperature, top_p).
    """

    numPredict: int = OLLAMA_DEFAULT_NUM_PREDICT
    temperature: float = OLLAMA_DEFAULT_TEMPERATURE
    topP: float = OLLAMA_DEFAULT_TOP_P


@dataclass(frozen=True)
class ModelErrorDetails:
    """
    Structured diagnostics attached to a ModelError (empty content, reasoning-only
    output, etc.).
    """

    baseUrl: str | None = None
    model: str | None = None
    emptyContent: bool | None = None
    emptyAfterThinkingRemoval: bool | None = None
    possibleReasoningOnlyOutput: bool | None = None
    thinkingArtifactRemoved: bool | None = None
    unsafeContentIssue: str | None = None
    responseFields: list[str] | None = None


@dataclass(frozen=True)
class SanitizedAssistantContent:
    """
    Result of sanitizing raw model output: final text plus flags for what was
    removed/rejected.
    """

    content: str
    removed: bool
    thinkingTagRemoved: bool
    thinkingLikePrefixRemoved: bool
    extractedFinalAnswer: bool
    rejected: bool
    rejectionReason: str | None
    rulesApplied: list[str]


class ModelError(RuntimeError):
    """
    Raised when the Ollama adapter cannot produce a valid response (timeout,
    unavailable, invalid, etc.).
    """

    def __init__(
        self,
        code: ModelErrorCode,
        message: str,
        adapter_id: str,
        provider: str = "local",
        retryable: bool | None = None,
        details: ModelErrorDetails | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.adapterId = adapter_id
        self.provider = provider
        self.retryable = retryable if retryable is not None else default_retryable(code)
        self.details = details or ModelErrorDetails()


@dataclass(frozen=True)
class OllamaAdapter:
    """Talks to a local Ollama server via its /api/chat endpoint.

    Sanitizes responses by stripping <think> blocks and thinking-like prefaces
    before returning the final assistant content.
    """

    id: str = OLLAMA_ADAPTER_ID
    displayName: str = "Ollama local adapter"
    baseUrl: str = OLLAMA_DEFAULT_BASE_URL
    model: str = OLLAMA_DEFAULT_MODEL
    timeoutMs: int = OLLAMA_DEFAULT_TIMEOUT_MS
    generationOptions: OllamaGenerationOptions = OllamaGenerationOptions()
    client: httpx.AsyncClient | None = None

    async def generate(self, request: ModelRequest) -> ModelResponse:
        """
        Send a chat request to Ollama, sanitize the response, and return a
        ModelResponse.
        """
        endpoint = f"{self.baseUrl.rstrip('/')}/api/chat"
        body = {
            "model": self.model,
            "messages": [
                to_ollama_chat_message(message) for message in request.messages
            ],
            "stream": False,
            "think": False,
            "options": {
                "num_predict": self.generationOptions.numPredict,
                "temperature": self.generationOptions.temperature,
                "top_p": self.generationOptions.topP,
            },
        }
        try:
            if self.client is None:
                async with httpx.AsyncClient(timeout=self.timeoutMs / 1000) as client:
                    response = await client.post(endpoint, json=body)
            else:
                response = await self.client.post(endpoint, json=body)
        except httpx.TimeoutException as error:
            raise self.error(
                "LOCAL_MODEL_TIMEOUT",
                f"Ollama local model timed out at {endpoint}.",
            ) from error
        except httpx.HTTPError as error:
            raise self.error(
                "LOCAL_MODEL_UNAVAILABLE",
                f"Ollama local API is not reachable at {endpoint}.",
            ) from error

        payload = read_json_response(self, response)
        if response.status_code < 200 or response.status_code >= 300:
            code, message = classify_ollama_error(
                payload,
                response.status_code,
                self.model,
            )
            raise self.error(code, message)

        raw_content = read_ollama_assistant_content(self, payload)
        sanitized = sanitize_assistant_content_details(raw_content)
        if not sanitized.content.strip() or sanitized.rejected:
            raise self.error(
                "MODEL_RESPONSE_INVALID",
                "Ollama returned no final assistant content after removing "
                "thinking artifacts.",
                ModelErrorDetails(
                    emptyContent=True,
                    emptyAfterThinkingRemoval=not sanitized.content.strip(),
                    possibleReasoningOnlyOutput=True,
                    thinkingArtifactRemoved=sanitized.removed,
                    responseFields=response_fields(payload),
                ),
            )
        if has_unsafe_thinking_leak(sanitized.content):
            raise self.error(
                "MODEL_RESPONSE_INVALID",
                "Ollama response included internal analysis text.",
                ModelErrorDetails(
                    possibleReasoningOnlyOutput=True,
                    thinkingArtifactRemoved=sanitized.removed,
                    unsafeContentIssue="internal_analysis",
                    responseFields=response_fields(payload),
                ),
            )
        return ModelResponse(
            content=sanitized.content,
            adapterId=self.id,
            metadata=ModelResponseMetadata(
                externalProvider=False,
                memoryWriteRequested=False,
                toolCallRequested=False,
                rawContentLength=len(raw_content),
                rawContentHash=short_hash(raw_content),
                rawPreview=safe_raw_preview(raw_content),
                rawModelOutputIncluded=False,
                thinkingTagDetected=has_thinking_tag_text(raw_content),
                thinkingLikePrefixDetected=has_thinking_like_prefix_text(raw_content),
                adapterSanitized=sanitized.removed,
                adapterRemovedCharacterCount=max(
                    0,
                    len(raw_content) - len(sanitized.content),
                ),
                sanitizedContentLength=len(sanitized.content),
                sanitizerRejectionReason=sanitized.rejectionReason,
            ),
        )

    def error(
        self,
        code: ModelErrorCode,
        message: str,
        details: ModelErrorDetails | None = None,
    ) -> ModelError:
        """Build a ModelError with this adapter's base URL and model pre-filled."""
        base = ModelErrorDetails(baseUrl=self.baseUrl, model=self.model)
        merged = merge_details(base, details)
        return ModelError(code, message, self.id, "local", details=merged)


def create_ollama_adapter_from_env() -> OllamaAdapter:
    """
    Build an OllamaAdapter from RIN_OLLAMA_* environment variables, falling back to
    defaults.
    """
    return OllamaAdapter(
        baseUrl=os.environ.get("RIN_OLLAMA_BASE_URL", OLLAMA_DEFAULT_BASE_URL),
        model=os.environ.get("RIN_OLLAMA_MODEL", OLLAMA_DEFAULT_MODEL),
        timeoutMs=read_int_env("RIN_OLLAMA_TIMEOUT_MS", OLLAMA_DEFAULT_TIMEOUT_MS),
        generationOptions=OllamaGenerationOptions(
            numPredict=read_int_env(
                "RIN_OLLAMA_NUM_PREDICT",
                OLLAMA_DEFAULT_NUM_PREDICT,
            ),
            temperature=read_float_env(
                "RIN_OLLAMA_TEMPERATURE",
                OLLAMA_DEFAULT_TEMPERATURE,
            ),
            topP=read_float_env("RIN_OLLAMA_TOP_P", OLLAMA_DEFAULT_TOP_P),
        ),
    )


def to_ollama_chat_message(message: ModelMessage) -> dict[str, str]:
    """
    Map RIN's internal roles (owner/rin) to Ollama's expected roles (user/assistant).
    """
    role = {"system": "system", "owner": "user", "rin": "assistant"}[message.role]
    return {"role": role, "content": message.content}


def read_json_response(adapter: OllamaAdapter, response: httpx.Response) -> Any:
    """Parse the Ollama HTTP response as JSON, raising ModelError on failure."""
    if not response.text.strip():
        return {}
    try:
        return response.json()
    except ValueError as error:
        raise adapter.error(
            "MODEL_RESPONSE_INVALID",
            "Ollama response was not valid JSON.",
        ) from error


def read_ollama_assistant_content(adapter: OllamaAdapter, payload: Any) -> str:
    """
    Extract the assistant's text content from the Ollama response payload, validating
    structure.
    """
    if not isinstance(payload, dict) or not isinstance(payload.get("message"), dict):
        raise adapter.error(
            "MODEL_RESPONSE_INVALID",
            "Ollama response did not include message.content.",
        )
    content = payload["message"].get("content")
    if not isinstance(content, str):
        raise adapter.error(
            "MODEL_RESPONSE_INVALID",
            "Ollama response did not include message.content.",
            ModelErrorDetails(responseFields=response_fields(payload)),
        )
    if not content.strip():
        fields = response_fields(payload)
        reasoning = has_reasoning_like_field(payload)
        raise adapter.error(
            "MODEL_RESPONSE_INVALID",
            "Ollama returned empty assistant content.",
            ModelErrorDetails(
                emptyContent=True,
                possibleReasoningOnlyOutput=reasoning,
                responseFields=fields,
            ),
        )

    return content


def sanitize_assistant_content(content: str) -> tuple[str, bool]:
    """Convenience wrapper: return (sanitized_text, was_anything_removed)."""
    sanitized = sanitize_assistant_content_details(content)
    return sanitized.content, sanitized.removed


# Regex patterns that detect thinking-like prefaces in Chinese and English.
THINKING_PREFIX_PATTERNS = (
    re.compile(r"^\s*(首先[，,]\s*)?用户(问|询问|想知道)", re.I),
    re.compile(r"^\s*我需要(分析|判断|考虑|先)", re.I),
    re.compile(r"^\s*我们需要(分析|判断|考虑|先|检查)", re.I),
    re.compile(r"^\s*根据(系统|上下文|用户)", re.I),
    re.compile(
        r"^\s*(响应策略|最终响应思路|完整响应草稿|分析|思路|检查是否|为什么这样)\s*[:：]?",
        re.I,
    ),
    re.compile(
        r"^\s*(okay,?\s*)?(first,\s*)?(the user|user) "
        r"(is )?(asking|asks|asked|wants)",
        re.I,
    ),
    re.compile(r"^\s*i need to (analy[sz]e|consider|determine)", re.I),
    re.compile(r"^\s*let me (check|think|analy[sz]e|look)", re.I),
)

# Pattern that marks an explicit "final answer" section in Chinese or English.
FINAL_ANSWER_MARKER_PATTERN = re.compile(
    (
        r"(?:最终答案|最终回答|最终响应|直接回答|答案|Final answer|Final response)"
        r"\s*[:：]\s*"
    ),
    re.I,
)


def sanitize_assistant_content_details(content: str) -> SanitizedAssistantContent:
    """Apply the full sanitization pipeline to raw model output.

    1. Remove paired <think>…</think> blocks.
    2. Drop everything before the last </think> tag.
    3. Extract text after an explicit final-answer marker.
    4. Reject if the remainder starts with a thinking-like preface (no safe answer
    follows).
    5. Reject if unsafe thinking markers remain.
    """
    rules = [
        "remove paired <think> blocks",
        "keep content after final </think>",
        "extract explicit final answer section",
        "reject thinking-like preface without safe final answer",
        "reject remaining unsafe thinking markers",
    ]
    working = content.strip()
    thinking_tag_removed = False
    thinking_prefix_removed = False
    extracted_final_answer = False

    # Step 1: Remove paired <think>…</think> blocks.
    without_pairs = re.sub(r"<think>.*?</think>", "", working, flags=re.DOTALL | re.I)
    if without_pairs != working:
        working = without_pairs.strip()
        thinking_tag_removed = True

    # Step 2: Drop everything before the last </think> tag.
    lower = working.lower()
    marker = "</think>"
    if marker in lower:
        index = lower.rfind(marker)
        working = working[index + len(marker) :].strip()
        thinking_tag_removed = True

    # Step 3: Extract text after an explicit final-answer marker.
    marker_match = list(FINAL_ANSWER_MARKER_PATTERN.finditer(working))
    if marker_match:
        working = working[marker_match[-1].end() :].strip()
        extracted_final_answer = True

    # Step 4: Reject if a thinking-like preface remains without a safe final answer.
    thinking_like_prefix = has_thinking_like_prefix_text(working)
    if thinking_like_prefix and not extracted_final_answer:
        return SanitizedAssistantContent(
            content="",
            removed=thinking_tag_removed,
            thinkingTagRemoved=thinking_tag_removed,
            thinkingLikePrefixRemoved=False,
            extractedFinalAnswer=False,
            rejected=True,
            rejectionReason="thinking_like_prefix_without_final_answer",
            rulesApplied=rules,
        )
    if thinking_like_prefix:
        thinking_prefix_removed = True

    # Step 5: Reject if unsafe thinking markers still remain.
    unsafe = has_unsafe_thinking_leak(working)
    return SanitizedAssistantContent(
        content=working,
        removed=(
            thinking_tag_removed
            or thinking_prefix_removed
            or extracted_final_answer
            or working != content.strip()
        ),
        thinkingTagRemoved=thinking_tag_removed,
        thinkingLikePrefixRemoved=thinking_prefix_removed,
        extractedFinalAnswer=extracted_final_answer,
        rejected=unsafe,
        rejectionReason="unsafe_thinking_marker_remaining" if unsafe else None,
        rulesApplied=rules,
    )


def has_thinking_like_prefix_text(content: str) -> bool:
    """Check whether the text starts with a known thinking-like preface pattern."""
    return any(pattern.search(content) for pattern in THINKING_PREFIX_PATTERNS)


def has_unsafe_thinking_leak(content: str) -> bool:
    """
    Check for known unsafe thinking markers (<think>, internal analysis, etc.) in the
    text.
    """
    lowered = content.lower()
    markers = (
        "<think>",
        "</think>",
        "internal analysis",
        "hidden reasoning",
        "reasoning process",
        "首先，用户问",
        "用户问",
        "我需要分析",
        "根据系统",
        "我们需要",
        "响应策略",
        "最终响应思路",
        "完整响应草稿",
        "检查是否",
        "the user is asking",
        "let me check",
        "let me think",
    )
    return any(
        marker in lowered for marker in markers
    ) or has_thinking_like_prefix_text(
        content,
    )


def has_thinking_tag_text(content: str) -> bool:
    """Check whether the text contains <think> or </think> tags."""
    lowered = content.lower()
    return "<think>" in lowered or "</think>" in lowered


def short_hash(content: str) -> str:
    """
    Return the first 12 hex characters of the SHA-256 hash (for trace-safe content
    identification).
    """
    return sha256(content.encode("utf-8")).hexdigest()[:12]


def safe_raw_preview(content: str) -> str:
    """
    Return a short preview of raw model output, hiding content that looks like
    thinking/reasoning.
    """
    if has_thinking_tag_text(content) or has_thinking_like_prefix_text(content):
        return "hidden_due_to_thinking_signal"
    stripped = " ".join(content.split())
    return stripped[:18] + ("..." if len(stripped) > 18 else "")


def response_fields(payload: dict[str, Any]) -> list[str]:
    """
    List top-level and message.* keys in the Ollama response payload (for error
    diagnostics).
    """
    fields = sorted(payload.keys())
    message = payload.get("message")
    if isinstance(message, dict):
        fields.extend(f"message.{key}" for key in sorted(message.keys()))
    return fields


def has_reasoning_like_field(payload: dict[str, Any]) -> bool:
    """
    Check whether any top-level or message.* key in the payload looks like a reasoning
    field.
    """
    if any(key.lower() in REASONING_KEYS for key in payload):
        return True
    message = payload.get("message")
    return isinstance(message, dict) and any(
        key.lower() in REASONING_KEYS for key in message
    )


def classify_ollama_error(
    payload: Any,
    status: int,
    model: str,
) -> tuple[ModelErrorCode, str]:
    """
    Classify an Ollama HTTP error into a ModelErrorCode and human-readable message.
    """
    error_text = ""
    if isinstance(payload, dict) and isinstance(payload.get("error"), str):
        error_text = payload["error"].strip()
    if not error_text:
        return "MODEL_PROVIDER_ERROR", f"Ollama returned HTTP {status}."
    missing = "not found" in error_text.lower() or "missing" in error_text.lower()
    code: ModelErrorCode = (
        "LOCAL_MODEL_MISSING" if missing or status == 404 else "MODEL_PROVIDER_ERROR"
    )
    guidance = f" Confirm the selected model is available with `ollama pull {model}`."
    return code, f"Ollama returned an error: {error_text}{guidance if missing else ''}"


def default_retryable(code: ModelErrorCode) -> bool:
    """
    Most errors are retryable except when the model is not installed
    (LOCAL_MODEL_MISSING).
    """
    return code != "LOCAL_MODEL_MISSING"


def merge_details(
    base: ModelErrorDetails,
    extra: ModelErrorDetails | None,
) -> ModelErrorDetails:
    """Merge two ModelErrorDetails, with extra's non-None fields taking precedence."""
    if extra is None:
        return base
    return ModelErrorDetails(
        baseUrl=base.baseUrl,
        model=base.model,
        emptyContent=extra.emptyContent,
        emptyAfterThinkingRemoval=extra.emptyAfterThinkingRemoval,
        possibleReasoningOnlyOutput=extra.possibleReasoningOnlyOutput,
        thinkingArtifactRemoved=extra.thinkingArtifactRemoved,
        unsafeContentIssue=extra.unsafeContentIssue,
        responseFields=extra.responseFields,
    )


def read_int_env(name: str, default: int) -> int:
    """
    Read a positive integer from the environment, returning default on missing/invalid.
    """
    try:
        value = int(os.environ.get(name, ""))
        return value if value > 0 else default
    except ValueError:
        return default


def read_float_env(name: str, default: float) -> float:
    """Read a float from the environment, returning default on missing/invalid."""
    try:
        return float(os.environ.get(name, ""))
    except ValueError:
        return default
