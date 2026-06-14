from rin.config.chat_provider import load_cost_config
from rin.contracts import ModelResponseMetadata
from rin.model.usage import build_api_usage_accounting


def metadata_with_usage(
    *,
    prompt_tokens: int | None = 1000,
    completion_tokens: int | None = 500,
    total_tokens: int | None = 1500,
    cache_hit: int | None = None,
    cache_miss: int | None = None,
) -> ModelResponseMetadata:
    return ModelResponseMetadata(
        externalProvider=True,
        memoryWriteRequested=False,
        toolCallRequested=False,
        promptTokens=prompt_tokens,
        completionTokens=completion_tokens,
        totalTokens=total_tokens,
        inputCacheHitTokens=cache_hit,
        inputCacheMissTokens=cache_miss,
    )


def test_legacy_per_1k_cost_env_still_works() -> None:
    config = load_cost_config(
        {
            "RIN_COST_INPUT_PER_1K_TOKENS_CNY": "0.0005",
            "RIN_COST_OUTPUT_PER_1K_TOKENS_CNY": "0.0005",
            "RIN_COST_CURRENCY": "CNY",
        }
    )
    accounting = build_api_usage_accounting(
        metadata=metadata_with_usage(),
        provider_id="provider",
        model="model",
        request_character_count=0,
        output_character_count=0,
        context_character_count=0,
        cost_config=config,
    )

    assert config.legacyPer1K is True
    assert accounting.estimatedCost == 0.00075
    assert accounting.currency == "CNY"
    assert accounting.pricingUnit == "per_1k_tokens"
    assert accounting.officialBillingMatch == "estimate"


def test_deepseek_v4_flash_profile_uses_per_1m_defaults() -> None:
    config = load_cost_config({})

    assert config.pricingProfile == "deepseek-v4-flash"
    assert config.pricingUnit == "per_1m_tokens"
    assert config.inputCacheHitUsdPer1M == 0.0028
    assert config.inputCacheMissUsdPer1M == 0.14
    assert config.outputUsdPer1M == 0.28
    assert config.legacyPer1K is False


def test_deepseek_range_is_reported_when_cache_breakdown_missing() -> None:
    config = load_cost_config(
        {
            "RIN_COST_PRICING_PROFILE": "deepseek-v4-flash",
            "RIN_COST_CACHE_HIT_RATIO_ESTIMATE": "0.25",
        }
    )
    accounting = build_api_usage_accounting(
        metadata=metadata_with_usage(
            prompt_tokens=1_000_000,
            completion_tokens=1000,
            total_tokens=1_001_000,
        ),
        provider_id="provider",
        model="deepseek-v4-flash",
        request_character_count=0,
        output_character_count=0,
        context_character_count=0,
        cost_config=config,
    )

    assert accounting.usageSource == "provider_usage"
    assert accounting.cacheBreakdownAvailable is False
    assert accounting.inputCacheHitTokens is None
    assert accounting.inputCacheMissTokens is None
    assert accounting.minEstimatedCostUsd == 0.00308
    assert accounting.maxEstimatedCostUsd == 0.14028
    assert accounting.configuredEstimatedCostUsd == 0.10598
    assert accounting.officialBillingMatch == "estimate"
    assert "cache hit/miss" in accounting.explanation


def test_provider_cache_breakdown_can_be_exact() -> None:
    config = load_cost_config({"RIN_COST_PRICING_PROFILE": "deepseek-v4-pro"})
    accounting = build_api_usage_accounting(
        metadata=metadata_with_usage(
            prompt_tokens=1000,
            completion_tokens=200,
            total_tokens=1200,
            cache_hit=400,
            cache_miss=600,
        ),
        provider_id="provider",
        model="deepseek-v4-pro",
        request_character_count=0,
        output_character_count=0,
        context_character_count=0,
        cost_config=config,
    )

    assert accounting.cacheBreakdownAvailable is True
    assert accounting.inputCacheHitTokens == 400
    assert accounting.inputCacheMissTokens == 600
    assert accounting.officialBillingMatch == "exact"
    assert accounting.minEstimatedCostUsd == accounting.maxEstimatedCostUsd


def test_heuristic_usage_is_marked_estimate_only() -> None:
    config = load_cost_config({})
    accounting = build_api_usage_accounting(
        metadata=metadata_with_usage(
            prompt_tokens=None,
            completion_tokens=None,
            total_tokens=None,
        ),
        provider_id="provider",
        model="deepseek-v4-flash",
        request_character_count=400,
        output_character_count=40,
        context_character_count=300,
        cost_config=config,
    )

    assert accounting.usageSource == "heuristic"
    assert accounting.estimateMethod == "estimated_chars_div_4"
    assert accounting.officialBillingMatch == "unavailable"
    assert accounting.cacheBreakdownAvailable is False
