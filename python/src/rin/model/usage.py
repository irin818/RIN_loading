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
    else:
        input_tokens = estimate_tokens_from_characters(request_character_count)
        output_tokens = estimate_tokens_from_characters(output_character_count)
        total_tokens = input_tokens + output_tokens
        method = TOKEN_ESTIMATE_HEURISTIC

    cost = (input_tokens / 1000) * cost_config.inputPer1KTokens + (
        output_tokens / 1000
    ) * cost_config.outputPer1KTokens
    return ApiUsageAccounting(
        providerId=provider_id,
        model=model,
        inputTokens=input_tokens,
        outputTokens=output_tokens,
        totalTokens=total_tokens,
        estimatedCost=round(cost, 8),
        currency=cost_config.currency,
        estimateMethod=method,
        contextCharacterCount=context_character_count,
    )
