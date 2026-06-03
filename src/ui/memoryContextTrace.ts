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
