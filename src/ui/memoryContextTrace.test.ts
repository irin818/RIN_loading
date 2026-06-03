import { describe, expect, it } from "vitest";
import {
  formatMatchedKeywords,
  formatMemorySkipReason,
  injectedMemoryItems,
  skippedMemoryItems,
} from "./memoryContextTrace";

describe("memoryContextTrace formatters", () => {
  it("formats skip reasons and matched keywords", () => {
    expect(formatMemorySkipReason("memory_budget_exceeded")).toBe(
      "memory budget exceeded",
    );
    expect(formatMatchedKeywords(["local", "ollama"])).toBe("local, ollama");
    expect(formatMatchedKeywords([])).toBe("none");
  });

  it("splits injected and skipped items", () => {
    const items = [
      {
        memoryId: "a",
        memoryType: "semantic" as const,
        matchedKeywords: ["x"],
        overlapCount: 1,
        latinTokenMatchCount: 1,
        cjkBigramMatchCount: 0,
        normalizedQueryTokenCount: 1,
        typeMatchBonus: 0,
        matchedTypeSignals: [],
        wasInjected: true,
        skippedReason: null,
        snippetLength: 10,
      },
      {
        memoryId: "b",
        memoryType: "semantic" as const,
        matchedKeywords: [],
        overlapCount: 0,
        latinTokenMatchCount: 0,
        cjkBigramMatchCount: 0,
        normalizedQueryTokenCount: 1,
        typeMatchBonus: 0,
        matchedTypeSignals: [],
        wasInjected: false,
        skippedReason: "zero_relevance" as const,
        snippetLength: 10,
      },
    ];

    expect(injectedMemoryItems(items)).toHaveLength(1);
    expect(skippedMemoryItems(items)).toHaveLength(1);
  });
});
