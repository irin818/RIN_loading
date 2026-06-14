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
DEFAULT_API_CHAT_MODEL = "deepseek-v4-flash"
DEFAULT_COST_INPUT_PER_1K_TOKENS_CNY = 0.001
DEFAULT_COST_OUTPUT_PER_1K_TOKENS_CNY = 0.002
DEFAULT_API_CHAT_TIMEOUT_MS = 180_000
DEFAULT_API_CHAT_TEMPERATURE = 0.5
DEFAULT_API_CHAT_MAX_TOKENS = 1024
DEFAULT_API_CHAT_TOP_P = 0.9
DEFAULT_COST_CURRENCY = "CNY"
DEFAULT_COST_PRICING_PROFILE = "deepseek-v4-flash"
DEFAULT_COST_PRICE_UNIT = "per_1m_tokens"
DEFAULT_COST_CACHE_HIT_RATIO_ESTIMATE = 0.0

CHAT_PROVIDER_ENV_VARS = (
    "RIN_CHAT_PROVIDER",
    "RIN_API_CHAT_BASE_URL",
    "RIN_API_CHAT_KEY",
    "RIN_API_CHAT_MODEL",
    "RIN_API_CHAT_TIMEOUT_MS",
    "RIN_API_CHAT_TEMPERATURE",
    "RIN_API_CHAT_MAX_TOKENS",
    "RIN_API_CHAT_TOP_P",
    "RIN_API_CHAT_THINKING",
)

THINKING_MODE_VALUES = ("disabled", "enabled")

COST_ENV_VARS = (
    "RIN_COST_PRICING_PROFILE",
    "RIN_COST_PRICE_UNIT",
    "RIN_COST_INPUT_CACHE_HIT_USD_PER_1M",
    "RIN_COST_INPUT_CACHE_MISS_USD_PER_1M",
    "RIN_COST_OUTPUT_USD_PER_1M",
    "RIN_COST_USD_CNY_RATE",
    "RIN_COST_CACHE_HIT_RATIO_ESTIMATE",
    "RIN_COST_INPUT_PER_1K_TOKENS_CNY",
    "RIN_COST_OUTPUT_PER_1K_TOKENS_CNY",
    "RIN_COST_CURRENCY",
)

LEGACY_COST_ENV_VARS = (
    "RIN_COST_INPUT_PER_1K_TOKENS_CNY",
    "RIN_COST_OUTPUT_PER_1K_TOKENS_CNY",
    "RIN_COST_CURRENCY",
)

# Manually maintained DeepSeek V4 pricing defaults. Override with env when billing
# terms change or a different account-specific rate applies.
DEEPSEEK_PRICING_PROFILES: dict[str, dict[str, float]] = {
    "deepseek-v4-flash": {
        "inputCacheHitUsdPer1M": 0.0028,
        "inputCacheMissUsdPer1M": 0.14,
        "outputUsdPer1M": 0.28,
    },
    "deepseek-v4-pro": {
        "inputCacheHitUsdPer1M": 0.003625,
        "inputCacheMissUsdPer1M": 0.435,
        "outputUsdPer1M": 0.87,
    },
}


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
    thinkingMode: str | None = None

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
            "thinkingMode": self.thinkingMode or "unset",
        }


@dataclass(frozen=True)
class CostConfig:
    """Configurable token-price estimate for cost reporting."""

    inputPer1KTokens: float
    outputPer1KTokens: float
    currency: str
    pricingProfile: str = "legacy-per-1k"
    pricingUnit: str = "per_1k_tokens"
    inputCacheHitUsdPer1M: float | None = None
    inputCacheMissUsdPer1M: float | None = None
    outputUsdPer1M: float | None = None
    usdCnyRate: float | None = None
    cacheHitRatioEstimate: float = DEFAULT_COST_CACHE_HIT_RATIO_ESTIMATE
    legacyPer1K: bool = True
    manuallyMaintainedProfile: bool = False

    def safe_metadata(self) -> dict[str, object]:
        return {
            "pricingProfile": self.pricingProfile,
            "pricingUnit": self.pricingUnit,
            "inputPer1KTokens": self.inputPer1KTokens,
            "outputPer1KTokens": self.outputPer1KTokens,
            "currency": self.currency,
            "currencyOfficial": "USD" if not self.legacyPer1K else self.currency,
            "displayCurrency": self.displayCurrency,
            "inputCacheHitUsdPer1M": self.inputCacheHitUsdPer1M,
            "inputCacheMissUsdPer1M": self.inputCacheMissUsdPer1M,
            "outputUsdPer1M": self.outputUsdPer1M,
            "usdCnyRate": self.usdCnyRate,
            "cacheHitRatioEstimate": self.cacheHitRatioEstimate,
            "legacyPer1K": self.legacyPer1K,
            "manuallyMaintainedProfile": self.manuallyMaintainedProfile,
            "estimateOnly": True,
            "envVars": COST_ENV_VARS,
            "legacyEnvVars": LEGACY_COST_ENV_VARS,
        }

    @property
    def displayCurrency(self) -> str:
        if self.legacyPer1K:
            return self.currency
        return "CNY" if self.usdCnyRate is not None else "USD"

    @property
    def deepseekPricingAvailable(self) -> bool:
        return (
            self.inputCacheHitUsdPer1M is not None
            and self.inputCacheMissUsdPer1M is not None
            and self.outputUsdPer1M is not None
        )


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
        thinkingMode=read_thinking_mode_env(source),
    )


def load_cost_config(env: Mapping[str, str] | None = None) -> CostConfig:
    """Load token-cost estimate config from environment variables."""
    source = env or os.environ
    if any(source.get(name) for name in LEGACY_COST_ENV_VARS):
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
            pricingProfile="legacy-per-1k",
            pricingUnit="per_1k_tokens",
            legacyPer1K=True,
        )

    pricing_profile = read_text_env(
        source,
        "RIN_COST_PRICING_PROFILE",
        DEFAULT_COST_PRICING_PROFILE,
    )
    profile_defaults = DEEPSEEK_PRICING_PROFILES.get(
        pricing_profile,
        DEEPSEEK_PRICING_PROFILES[DEFAULT_COST_PRICING_PROFILE],
    )
    usd_cny_rate = read_optional_float_env(source, "RIN_COST_USD_CNY_RATE")
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
        currency="CNY" if usd_cny_rate is not None else "USD",
        pricingProfile=pricing_profile,
        pricingUnit=read_text_env(
            source,
            "RIN_COST_PRICE_UNIT",
            DEFAULT_COST_PRICE_UNIT,
        ),
        inputCacheHitUsdPer1M=read_float_env(
            source,
            "RIN_COST_INPUT_CACHE_HIT_USD_PER_1M",
            profile_defaults["inputCacheHitUsdPer1M"],
        ),
        inputCacheMissUsdPer1M=read_float_env(
            source,
            "RIN_COST_INPUT_CACHE_MISS_USD_PER_1M",
            profile_defaults["inputCacheMissUsdPer1M"],
        ),
        outputUsdPer1M=read_float_env(
            source,
            "RIN_COST_OUTPUT_USD_PER_1M",
            profile_defaults["outputUsdPer1M"],
        ),
        usdCnyRate=usd_cny_rate,
        cacheHitRatioEstimate=read_ratio_env(
            source,
            "RIN_COST_CACHE_HIT_RATIO_ESTIMATE",
            DEFAULT_COST_CACHE_HIT_RATIO_ESTIMATE,
        ),
        legacyPer1K=False,
        manuallyMaintainedProfile=pricing_profile in DEEPSEEK_PRICING_PROFILES,
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


def read_optional_float_env(source: Mapping[str, str], name: str) -> float | None:
    value = source.get(name)
    if value is None or not value.strip():
        return None
    try:
        parsed = float(value)
    except ValueError:
        return None
    return parsed if parsed >= 0 else None


def read_ratio_env(source: Mapping[str, str], name: str, default: float) -> float:
    value = read_float_env(source, name, default)
    return min(1.0, max(0.0, value))


def read_thinking_mode_env(
    source: Mapping[str, str],
) -> str | None:
    """Read RIN_API_CHAT_THINKING and return a validated value.

    Returns:
        "disabled", "enabled", or None (unset / empty).

    Raises:
        ValueError: if the value is set but not one of the allowed choices.
    """
    raw = source.get("RIN_API_CHAT_THINKING")
    if raw is None:
        return None
    value = raw.strip()
    if not value:
        return None
    if value not in THINKING_MODE_VALUES:
        raise ValueError(
            f"Invalid RIN_API_CHAT_THINKING value '{value}'. "
            f"Allowed: {', '.join(THINKING_MODE_VALUES)}."
        )
    return value
