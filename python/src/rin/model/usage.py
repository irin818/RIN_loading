"""Token usage and estimated-cost accounting for external API chat."""

from __future__ import annotations

from dataclasses import dataclass
from math import ceil

from rin.config.chat_provider import CostConfig
from rin.contracts import ModelResponseMetadata

TOKEN_ESTIMATE_HEURISTIC = "estimated_chars_div_4"
PROVIDER_USAGE_METHOD = "provider_usage"


@dataclass(frozen=True)
class ApiUsageAccounting:
    """Safe usage/cost record ready for persistence."""

    providerId: str
    model: str
    inputTokens: int
    outputTokens: int
    totalTokens: int
    estimatedCost: float
    currency: str
    estimateMethod: str
    contextCharacterCount: int
    usageSource: str
    pricingProfile: str
    pricingUnit: str
    cacheBreakdownAvailable: bool
    inputCacheHitTokens: int | None
    inputCacheMissTokens: int | None
    minEstimatedCostUsd: float | None
    maxEstimatedCostUsd: float | None
    configuredEstimatedCostUsd: float | None
    configuredEstimatedCostCny: float | None
    officialBillingMatch: str
    explanation: str


@dataclass(frozen=True)
class CostRangeEstimate:
    displayCost: float
    displayCurrency: str
    cacheBreakdownAvailable: bool
    inputCacheHitTokens: int | None
    inputCacheMissTokens: int | None
    minEstimatedCostUsd: float | None
    maxEstimatedCostUsd: float | None
    configuredEstimatedCostUsd: float | None
    configuredEstimatedCostCny: float | None
    officialBillingMatch: str
    explanation: str


def estimate_tokens_from_characters(character_count: int) -> int:
    """Estimate tokens as ceil(characters / 4), a conservative v1 heuristic."""
    if character_count <= 0:
        return 0
    return ceil(character_count / 4)


def build_api_usage_accounting(
    *,
    metadata: ModelResponseMetadata,
    provider_id: str,
    model: str,
    request_character_count: int,
    output_character_count: int,
    context_character_count: int,
    cost_config: CostConfig,
) -> ApiUsageAccounting:
    """Prefer provider usage tokens, otherwise estimate from character counts."""
    if (
        metadata.promptTokens is not None
        and metadata.completionTokens is not None
        and metadata.totalTokens is not None
    ):
        input_tokens = metadata.promptTokens
        output_tokens = metadata.completionTokens
        total_tokens = metadata.totalTokens
        method = PROVIDER_USAGE_METHOD
        usage_source = PROVIDER_USAGE_METHOD
    else:
        input_tokens = estimate_tokens_from_characters(request_character_count)
        output_tokens = estimate_tokens_from_characters(output_character_count)
        total_tokens = input_tokens + output_tokens
        method = TOKEN_ESTIMATE_HEURISTIC
        usage_source = "heuristic"

    estimate = estimate_cost_range(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        input_cache_hit_tokens=metadata.inputCacheHitTokens,
        input_cache_miss_tokens=metadata.inputCacheMissTokens,
        usage_source=usage_source,
        cost_config=cost_config,
    )
    return ApiUsageAccounting(
        providerId=provider_id,
        model=model,
        inputTokens=input_tokens,
        outputTokens=output_tokens,
        totalTokens=total_tokens,
        estimatedCost=estimate.displayCost,
        currency=estimate.displayCurrency,
        estimateMethod=method,
        contextCharacterCount=context_character_count,
        usageSource=usage_source,
        pricingProfile=cost_config.pricingProfile,
        pricingUnit=cost_config.pricingUnit,
        cacheBreakdownAvailable=estimate.cacheBreakdownAvailable,
        inputCacheHitTokens=estimate.inputCacheHitTokens,
        inputCacheMissTokens=estimate.inputCacheMissTokens,
        minEstimatedCostUsd=estimate.minEstimatedCostUsd,
        maxEstimatedCostUsd=estimate.maxEstimatedCostUsd,
        configuredEstimatedCostUsd=estimate.configuredEstimatedCostUsd,
        configuredEstimatedCostCny=estimate.configuredEstimatedCostCny,
        officialBillingMatch=estimate.officialBillingMatch,
        explanation=estimate.explanation,
    )


def estimate_cost_range(
    *,
    input_tokens: int,
    output_tokens: int,
    input_cache_hit_tokens: int | None,
    input_cache_miss_tokens: int | None,
    usage_source: str,
    cost_config: CostConfig,
) -> CostRangeEstimate:
    """Return display cost plus DeepSeek-aware estimate range metadata."""
    if cost_config.legacyPer1K or not cost_config.deepseekPricingAvailable:
        cost = (input_tokens / 1000) * cost_config.inputPer1KTokens + (
            output_tokens / 1000
        ) * cost_config.outputPer1KTokens
        return CostRangeEstimate(
            displayCost=round(cost, 8),
            displayCurrency=cost_config.currency,
            cacheBreakdownAvailable=False,
            inputCacheHitTokens=None,
            inputCacheMissTokens=None,
            minEstimatedCostUsd=None,
            maxEstimatedCostUsd=None,
            configuredEstimatedCostUsd=None,
            configuredEstimatedCostCny=None,
            officialBillingMatch="estimate",
            explanation=(
                "Legacy per-1K token pricing is active; official cache billing "
                "breakdown is not represented."
            ),
        )

    hit_price = cost_config.inputCacheHitUsdPer1M or 0.0
    miss_price = cost_config.inputCacheMissUsdPer1M or 0.0
    output_price = cost_config.outputUsdPer1M or 0.0
    output_usd = (output_tokens / 1_000_000) * output_price
    cache_breakdown_available = (
        input_cache_hit_tokens is not None and input_cache_miss_tokens is not None
    )
    if cache_breakdown_available:
        hit_tokens = input_cache_hit_tokens or 0
        miss_tokens = input_cache_miss_tokens or 0
        configured_usd = (
            (hit_tokens / 1_000_000) * hit_price
            + (miss_tokens / 1_000_000) * miss_price
            + output_usd
        )
        min_usd = configured_usd
        max_usd = configured_usd
        official_match = (
            "exact" if usage_source == PROVIDER_USAGE_METHOD else "estimate"
        )
        explanation = (
            "Provider usage included cache hit/miss tokens, so RIN can mirror the "
            "DeepSeek-style cache billing formula for this record."
        )
    else:
        hit_tokens = None
        miss_tokens = None
        min_usd = (input_tokens / 1_000_000) * hit_price + output_usd
        max_usd = (input_tokens / 1_000_000) * miss_price + output_usd
        estimated_hit_tokens = round(input_tokens * cost_config.cacheHitRatioEstimate)
        estimated_miss_tokens = max(0, input_tokens - estimated_hit_tokens)
        configured_usd = (
            (estimated_hit_tokens / 1_000_000) * hit_price
            + (estimated_miss_tokens / 1_000_000) * miss_price
            + output_usd
        )
        official_match = (
            "estimate" if usage_source == PROVIDER_USAGE_METHOD else "unavailable"
        )
        explanation = (
            "DeepSeek official billing may differ because cache hit/miss token "
            "breakdown was not available; RIN reports min, max, and configured "
            "cache-ratio estimates instead of claiming an exact bill."
        )

    configured_cny = (
        configured_usd * cost_config.usdCnyRate
        if cost_config.usdCnyRate is not None
        else None
    )
    display_cost = configured_cny if configured_cny is not None else configured_usd
    return CostRangeEstimate(
        displayCost=round(display_cost, 8),
        displayCurrency=cost_config.displayCurrency,
        cacheBreakdownAvailable=cache_breakdown_available,
        inputCacheHitTokens=hit_tokens,
        inputCacheMissTokens=miss_tokens,
        minEstimatedCostUsd=round(min_usd, 10),
        maxEstimatedCostUsd=round(max_usd, 10),
        configuredEstimatedCostUsd=round(configured_usd, 10),
        configuredEstimatedCostCny=round(configured_cny, 8)
        if configured_cny is not None
        else None,
        officialBillingMatch=official_match,
        explanation=explanation,
    )
