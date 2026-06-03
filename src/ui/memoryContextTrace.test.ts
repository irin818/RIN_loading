import { describe, expect, it } from "vitest";
import {
  formatLexicalRankingSignal,
  formatMatchedKeywords,
  formatMemoryRankingBreakdown,
  formatMetadataRankingSignal,
  formatMetadataRankingBreakdown,
  formatMemorySkipReason,
  formatTypeRankingSignal,
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

  it("formats compact metadata ranking signals", () => {
    expect(
      formatMetadataRankingSignal({
        memoryId: "a",
        memoryType: "semantic",
        matchedKeywords: ["memory"],
        overlapCount: 1,
        latinTokenMatchCount: 1,
        cjkBigramMatchCount: 0,
        normalizedQueryTokenCount: 1,
        typeMatchBonus: 0,
        matchedTypeSignals: [],
        matchedTags: ["project"],
        tagMatchBonus: 1,
        importanceBonus: 1,
        confidenceAdjustment: -1,
        metadataBonus: 1,
        metadataSignals: [
          "tag_match",
          "importance_high",
          "confidence_low_dampened",
        ],
        wasInjected: true,
        skippedReason: null,
        snippetLength: 10,
      }),
    ).toBe(
      "metadata +1 · tags +1: project · importance +1 · confidence -1 · signals: tag_match, importance_high, confidence_low_dampened",
    );
  });

  it("formats safe lexical, type, metadata, and result breakdowns", () => {
    const item = {
      memoryId: "a",
      memoryType: "project" as const,
      matchedKeywords: ["local", "ollama"],
      overlapCount: 2,
      latinTokenMatchCount: 2,
      cjkBigramMatchCount: 0,
      normalizedQueryTokenCount: 4,
      typeMatchBonus: 1,
      matchedTypeSignals: ["project"],
      matchedTags: ["runtime"],
      tagMatchBonus: 1,
      importanceBonus: 1,
      confidenceAdjustment: -1,
      metadataBonus: 1,
      metadataSignals: [
        "tag_match",
        "importance_high",
        "confidence_low_dampened",
      ],
      wasInjected: false,
      skippedReason: "max_count_exceeded" as const,
      snippetLength: 120,
    };

    expect(formatLexicalRankingSignal(item)).toBe(
      "lexical overlap 2/4 (latin 2, cjk 0) keywords: local, ollama",
    );
    expect(formatTypeRankingSignal(item)).toBe("type project +1: project");
    expect(formatMetadataRankingBreakdown(item)).toBe(
      "metadata +1 (tags +1: runtime; importance +1; confidence -1; signals: tag_match, importance_high, confidence_low_dampened)",
    );
    expect(formatMemoryRankingBreakdown(item)).toBe(
      "lexical overlap 2/4 (latin 2, cjk 0) keywords: local, ollama · type project +1: project · metadata +1 (tags +1: runtime; importance +1; confidence -1; signals: tag_match, importance_high, confidence_low_dampened) · result: max count exceeded",
    );
    expect(formatMemoryRankingBreakdown(item)).not.toContain("Owner full text");
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
        matchedTags: [],
        tagMatchBonus: 0,
        importanceBonus: 0,
        confidenceAdjustment: 0,
        metadataBonus: 0,
        metadataSignals: [],
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
        matchedTags: [],
        tagMatchBonus: 0,
        importanceBonus: 0,
        confidenceAdjustment: 0,
        metadataBonus: 0,
        metadataSignals: [],
        wasInjected: false,
        skippedReason: "zero_relevance" as const,
        snippetLength: 10,
      },
    ];

    expect(injectedMemoryItems(items)).toHaveLength(1);
    expect(skippedMemoryItems(items)).toHaveLength(1);
  });
});
