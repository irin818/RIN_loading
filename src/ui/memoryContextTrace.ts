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

export function formatLexicalRankingSignal(
  item: MemoryInjectionExplanation,
): string {
  return [
    `lexical overlap ${item.overlapCount}/${item.normalizedQueryTokenCount}`,
    `(latin ${item.latinTokenMatchCount}, cjk ${item.cjkBigramMatchCount})`,
    `keywords: ${formatMatchedKeywords(item.matchedKeywords)}`,
  ].join(" ");
}

export function formatTypeRankingSignal(
  item: MemoryInjectionExplanation,
): string {
  const signalSuffix =
    item.matchedTypeSignals.length > 0
      ? `: ${formatMatchedKeywords(item.matchedTypeSignals)}`
      : "";

  return `type ${item.memoryType} ${formatSignedBonus(item.typeMatchBonus)}${signalSuffix}`;
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

export function formatMetadataRankingBreakdown(
  item: MemoryInjectionExplanation,
): string {
  const tagSuffix =
    item.matchedTags.length > 0
      ? `: ${formatMatchedKeywords(item.matchedTags)}`
      : "";
  const signalSuffix =
    item.metadataSignals.length > 0
      ? `; signals: ${formatMatchedKeywords(item.metadataSignals)}`
      : "";

  return `metadata ${formatSignedBonus(item.metadataBonus)} (tags +${item.tagMatchBonus}${tagSuffix}; importance +${item.importanceBonus}; confidence ${formatSignedBonus(item.confidenceAdjustment)}${signalSuffix})`;
}

export function formatMemoryRankingBreakdown(
  item: MemoryInjectionExplanation,
): string {
  return [
    `source: ${item.contextSource ?? "deterministic"}`,
    formatLexicalRankingSignal(item),
    formatTypeRankingSignal(item),
    formatMetadataRankingBreakdown(item),
    `result: ${formatMemorySkipReason(item.skippedReason)}`,
  ].join(" · ");
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

function formatSignedBonus(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}
