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
        matchedKeywords: ["x"],
        overlapCount: 1,
        latinTokenMatchCount: 1,
        cjkBigramMatchCount: 0,
        normalizedQueryTokenCount: 1,
        wasInjected: true,
        skippedReason: null,
        snippetLength: 10,
      },
      {
        memoryId: "b",
        matchedKeywords: [],
        overlapCount: 0,
        latinTokenMatchCount: 0,
        cjkBigramMatchCount: 0,
        normalizedQueryTokenCount: 1,
        wasInjected: false,
        skippedReason: "zero_relevance" as const,
        snippetLength: 10,
      },
    ];

    expect(injectedMemoryItems(items)).toHaveLength(1);
    expect(skippedMemoryItems(items)).toHaveLength(1);
  });
});
