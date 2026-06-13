"""Central chat-provider and token-cost configuration.

The chat provider is configured only through environment variables. This module
never reads, prints, or returns secret values; it reports presence and safe
metadata for diagnostics and UI display.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

DEFAULT_CHAT_PROVIDER = "openai-compatible"
DEFAULT_API_CHAT_MODEL = "qwen-long"
DEFAULT_API_CHAT_TIMEOUT_MS = 180_000
DEFAULT_API_CHAT_TEMPERATURE = 0.5
DEFAULT_API_CHAT_MAX_TOKENS = 1024
DEFAULT_API_CHAT_TOP_P = 0.9
DEFAULT_COST_INPUT_PER_1K_TOKENS_CNY = 0.0005
DEFAULT_COST_OUTPUT_PER_1K_TOKENS_CNY = 0.0005
DEFAULT_COST_CURRENCY = "CNY"

CHAT_PROVIDER_ENV_VARS = (
    "RIN_CHAT_PROVIDER",
    "RIN_API_CHAT_BASE_URL",
    "RIN_API_CHAT_KEY",
    "RIN_API_CHAT_MODEL",
    "RIN_API_CHAT_TIMEOUT_MS",
    "RIN_API_CHAT_TEMPERATURE",
    "RIN_API_CHAT_MAX_TOKENS",
    "RIN_API_CHAT_TOP_P",
)

COST_ENV_VARS = (
    "RIN_COST_INPUT_PER_1K_TOKENS_CNY",
    "RIN_COST_OUTPUT_PER_1K_TOKENS_CNY",
    "RIN_COST_CURRENCY",
)


@dataclass(frozen=True)
class ChatProviderConfig:
    """Runtime config for the active external chat provider."""

    provider: str
    baseUrl: str | None
    apiKey: str | None
    model: str
    timeoutMs: int
    temperature: float
    maxTokens: int
    topP: float

    @property
    def id(self) -> str:
        return f"rin-api-chat-{self.provider}"

    @property
    def apiKeyPresent(self) -> bool:
        return bool(self.apiKey)

    @property
    def missingEnvironment(self) -> list[str]:
        missing: list[str] = []
        if not self.baseUrl:
            missing.append("RIN_API_CHAT_BASE_URL")
        if not self.apiKey:
            missing.append("RIN_API_CHAT_KEY")
        if not self.model:
            missing.append("RIN_API_CHAT_MODEL")
        return missing

    @property
    def configured(self) -> bool:
        return self.provider == DEFAULT_CHAT_PROVIDER and not self.missingEnvironment

    @property
    def configurationStatus(self) -> str:
        if self.configured:
            return "configured"
        if "RIN_API_CHAT_KEY" in self.missingEnvironment:
            return "missing_api_key"
        return "pending_configuration"

    @property
    def safeBaseUrl(self) -> str | None:
        return safe_base_url(self.baseUrl)

    def safe_metadata(self) -> dict[str, object]:
        """Return provider settings suitable for diagnostics and UI display."""
        return {
            "provider": self.provider,
            "adapterId": self.id,
            "configured": self.configured,
            "configurationStatus": self.configurationStatus,
            "missingEnvironment": self.missingEnvironment,
            "baseUrl": self.safeBaseUrl or "n/a",
            "model": self.model or "n/a",
            "timeoutMs": self.timeoutMs,
            "temperature": self.temperature,
            "maxTokens": self.maxTokens,
            "topP": self.topP,
            "apiKeyEnv": "RIN_API_CHAT_KEY",
            "apiKeyPresent": self.apiKeyPresent,
            "apiKeyIncluded": False,
            "secretValuesIncluded": False,
        }


@dataclass(frozen=True)
class CostConfig:
    """Configurable token-price estimate for cost reporting."""

    inputPer1KTokens: float
    outputPer1KTokens: float
    currency: str

    def safe_metadata(self) -> dict[str, object]:
        return {
            "inputPer1KTokens": self.inputPer1KTokens,
            "outputPer1KTokens": self.outputPer1KTokens,
            "currency": self.currency,
            "estimateOnly": True,
            "envVars": COST_ENV_VARS,
        }


def load_chat_provider_config(
    env: Mapping[str, str] | None = None,
) -> ChatProviderConfig:
    """Load chat provider config from environment variables."""
    source = env or os.environ
    return ChatProviderConfig(
        provider=read_text_env(source, "RIN_CHAT_PROVIDER", DEFAULT_CHAT_PROVIDER),
        baseUrl=read_optional_text_env(source, "RIN_API_CHAT_BASE_URL"),
        apiKey=read_optional_text_env(source, "RIN_API_CHAT_KEY"),
        model=read_text_env(source, "RIN_API_CHAT_MODEL", DEFAULT_API_CHAT_MODEL),
        timeoutMs=read_int_env(
            source,
            "RIN_API_CHAT_TIMEOUT_MS",
            DEFAULT_API_CHAT_TIMEOUT_MS,
        ),
        temperature=read_float_env(
            source,
            "RIN_API_CHAT_TEMPERATURE",
            DEFAULT_API_CHAT_TEMPERATURE,
        ),
        maxTokens=read_int_env(
            source,
            "RIN_API_CHAT_MAX_TOKENS",
            DEFAULT_API_CHAT_MAX_TOKENS,
        ),
        topP=read_float_env(source, "RIN_API_CHAT_TOP_P", DEFAULT_API_CHAT_TOP_P),
    )


def load_cost_config(env: Mapping[str, str] | None = None) -> CostConfig:
    """Load token-cost estimate config from environment variables."""
    source = env or os.environ
    return CostConfig(
        inputPer1KTokens=read_float_env(
            source,
            "RIN_COST_INPUT_PER_1K_TOKENS_CNY",
            DEFAULT_COST_INPUT_PER_1K_TOKENS_CNY,
        ),
        outputPer1KTokens=read_float_env(
            source,
            "RIN_COST_OUTPUT_PER_1K_TOKENS_CNY",
            DEFAULT_COST_OUTPUT_PER_1K_TOKENS_CNY,
        ),
        currency=read_text_env(source, "RIN_COST_CURRENCY", DEFAULT_COST_CURRENCY),
    )


def safe_base_url(value: str | None) -> str | None:
    """Return a display-safe base URL without userinfo, query, or fragment."""
    if not value or not value.strip():
        return None
    parsed = urlsplit(value.strip())
    if not parsed.scheme or not parsed.netloc:
        return value.strip().split("?", 1)[0].split("#", 1)[0]
    host = parsed.hostname or ""
    if parsed.port is not None:
        host = f"{host}:{parsed.port}"
    return urlunsplit((parsed.scheme, host, parsed.path.rstrip("/"), "", ""))


def read_optional_text_env(source: Mapping[str, str], name: str) -> str | None:
    value = source.get(name)
    if value is None or not value.strip():
        return None
    return value.strip()


def read_text_env(source: Mapping[str, str], name: str, default: str) -> str:
    value = source.get(name)
    if value is None or not value.strip():
        return default
    return value.strip()


def read_int_env(source: Mapping[str, str], name: str, default: int) -> int:
    try:
        value = int(source.get(name, ""))
    except ValueError:
        return default
    return value if value > 0 else default


def read_float_env(source: Mapping[str, str], name: str, default: float) -> float:
    try:
        value = float(source.get(name, ""))
    except ValueError:
        return default
    return value if value >= 0 else default
