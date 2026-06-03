import type { MemoryInjectionExplanation, MemorySkipReason } from "../memory";

export function formatMemorySkipReason(
  reason: MemorySkipReason | null,
): string {
  switch (reason) {
    case "zero_relevance":
      return "zero relevance";
    case "empty_snippet":
      return "empty snippet";
    case "max_count_exceeded":
      return "max count exceeded";
    case "memory_budget_exceeded":
      return "memory budget exceeded";
    default:
      return "injected";
  }
}

export function formatMatchedKeywords(keywords: readonly string[]): string {
  return keywords.length > 0 ? keywords.join(", ") : "none";
}

export function formatMetadataRankingSignal(
  item: MemoryInjectionExplanation,
): string | null {
  if (
    item.metadataBonus === 0 &&
    item.tagMatchBonus === 0 &&
    item.importanceBonus === 0 &&
    item.confidenceAdjustment === 0
  ) {
    return null;
  }

  const parts = [`metadata +${item.metadataBonus}`];

  if (item.tagMatchBonus > 0) {
    parts.push(
      `tags +${item.tagMatchBonus}: ${formatMatchedKeywords(item.matchedTags)}`,
    );
  }

  if (item.importanceBonus > 0) {
    parts.push(`importance +${item.importanceBonus}`);
  }

  if (item.confidenceAdjustment !== 0) {
    parts.push(`confidence ${item.confidenceAdjustment}`);
  }

  if (item.metadataSignals.length > 0) {
    parts.push(`signals: ${formatMatchedKeywords(item.metadataSignals)}`);
  }

  return parts.join(" · ");
}

export function injectedMemoryItems(
  items: readonly MemoryInjectionExplanation[],
): MemoryInjectionExplanation[] {
  return items.filter((item) => item.wasInjected);
}

export function skippedMemoryItems(
  items: readonly MemoryInjectionExplanation[],
): MemoryInjectionExplanation[] {
  return items.filter((item) => !item.wasInjected);
}
