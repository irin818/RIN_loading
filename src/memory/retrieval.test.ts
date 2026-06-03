import { describe, expect, it } from "vitest";
import type { MemoryRecord, MemoryStatus } from "./manager";
import {
  finalizeInjectionExplanations,
  memorySnippetText,
  retrieveAcceptedMemoriesWithExplanation,
  selectRelevantAcceptedMemories,
  summarizeMemoryInjection,
  toMemoryInjectionTrace,
} from "./retrieval";

function memory(
  overrides: Partial<MemoryRecord> & { id: string },
): MemoryRecord {
  return {
    id: overrides.id,
    memoryType: overrides.memoryType ?? "semantic",
    content: overrides.content ?? { text: "" },
    metadata: overrides.metadata ?? {
      tags: [],
      importance: "normal",
      confidence: "medium",
      source: null,
      reviewedAt: null,
      acceptedAt: null,
    },
    sourceMessageId: overrides.sourceMessageId ?? null,
    status: overrides.status ?? "accepted",
    createdAt: overrides.createdAt ?? "2026-05-19T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-05-19T00:00:00.000Z",
  };
}

describe("selectRelevantAcceptedMemories", () => {
  it("injects accepted memories that overlap with the owner message", () => {
    const result = selectRelevantAcceptedMemories(
      [
        memory({
          id: "m1",
          content: { text: "Owner prefers local Ollama models." },
        }),
      ],
      "Which local Ollama model should RIN use?",
    );

    expect(result).toEqual([
      { id: "m1", text: "Owner prefers local Ollama models." },
    ]);
  });

  it("never injects pending, rejected, or archived memories", () => {
    const statuses: MemoryStatus[] = ["proposal", "rejected", "archived"];
    const memories = statuses.map((status, index) =>
      memory({
        id: `m-${status}`,
        status,
        content: { text: "Owner prefers local Ollama models." },
        updatedAt: `2026-05-19T00:0${index}:00.000Z`,
      }),
    );

    const result = selectRelevantAcceptedMemories(
      memories,
      "local Ollama model preference",
    );

    expect(result).toEqual([]);
  });

  it("does not inject memories with no keyword overlap", () => {
    const result = selectRelevantAcceptedMemories(
      [memory({ id: "m1", content: { text: "Owner enjoys hiking trips." } })],
      "Explain the SQLite schema migration plan.",
    );

    expect(result).toEqual([]);
  });

  it("ranks higher-overlap memories first and is deterministic on ties", () => {
    const result = selectRelevantAcceptedMemories(
      [
        memory({
          id: "low",
          content: { text: "Owner likes local models." },
        }),
        memory({
          id: "high",
          content: { text: "Owner likes local Ollama qwen3 models." },
        }),
        memory({
          id: "tie-b",
          content: { text: "Owner likes local models." },
          updatedAt: "2026-05-19T00:05:00.000Z",
        }),
      ],
      "local Ollama qwen3 models",
    );

    expect(result.map((item) => item.id)).toEqual(["high", "tie-b", "low"]);
  });

  it("uses memory type as a small deterministic tie-break only after token overlap", () => {
    const result = selectRelevantAcceptedMemories(
      [
        memory({
          id: "semantic-note",
          memoryType: "semantic",
          content: { text: "Owner uses memory notes." },
          updatedAt: "2026-05-19T00:05:00.000Z",
        }),
        memory({
          id: "project-note",
          memoryType: "project",
          content: { text: "Owner uses memory notes." },
          updatedAt: "2026-05-19T00:00:00.000Z",
        }),
      ],
      "project memory notes",
    );

    expect(result.map((item) => item.id)).toEqual([
      "project-note",
      "semantic-note",
    ]);
  });

  it("keeps stronger token relevance ahead of type bonus", () => {
    const result = selectRelevantAcceptedMemories(
      [
        memory({
          id: "type-match",
          memoryType: "project",
          content: { text: "Owner uses memory notes." },
        }),
        memory({
          id: "strong-token-match",
          memoryType: "semantic",
          content: { text: "Owner uses project memory notes." },
        }),
      ],
      "project memory notes",
    );

    expect(result.map((item) => item.id)).toEqual([
      "strong-token-match",
      "type-match",
    ]);
  });

  it("uses owner-reviewed tag metadata as a small tie-break after token overlap", () => {
    const result = retrieveAcceptedMemoriesWithExplanation(
      [
        memory({
          id: "metadata-tag-match",
          content: { text: "Owner uses memory notes." },
          metadata: {
            tags: ["project"],
            importance: "normal",
            confidence: "medium",
            source: "owner review",
            reviewedAt: "2026-05-19T00:02:00.000Z",
            acceptedAt: "2026-05-19T00:01:00.000Z",
          },
          updatedAt: "2026-05-19T00:00:00.000Z",
        }),
        memory({
          id: "metadata-neutral-newer",
          content: { text: "Owner uses memory notes." },
          metadata: {
            tags: [],
            importance: "normal",
            confidence: "medium",
            source: null,
            reviewedAt: null,
            acceptedAt: null,
          },
          updatedAt: "2026-05-19T00:05:00.000Z",
        }),
      ],
      "project memory notes",
      { maxInjectedMemories: 1 },
    );

    expect(result.snippets.map((item) => item.id)).toEqual([
      "metadata-tag-match",
    ]);
    expect(result.explanations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memoryId: "metadata-tag-match",
          matchedTags: ["project"],
          tagMatchBonus: 1,
          importanceBonus: 0,
          confidenceAdjustment: 0,
          metadataBonus: 1,
          metadataSignals: ["tag_match"],
        }),
      ]),
    );
  });

  it("does not inject zero-overlap memories solely due to metadata tags", () => {
    const result = retrieveAcceptedMemoriesWithExplanation(
      [
        memory({
          id: "metadata-tag-only",
          content: { text: "Owner enjoys weekend hiking trips." },
          metadata: {
            tags: ["project"],
            importance: "high",
            confidence: "high",
            source: "owner review",
            reviewedAt: "2026-05-19T00:02:00.000Z",
            acceptedAt: "2026-05-19T00:01:00.000Z",
          },
        }),
      ],
      "project github branch",
    );

    expect(result.snippets).toEqual([]);
    expect(result.explanations).toEqual([
      expect.objectContaining({
        memoryId: "metadata-tag-only",
        matchedTags: [],
        tagMatchBonus: 0,
        importanceBonus: 0,
        confidenceAdjustment: 0,
        metadataBonus: 0,
        metadataSignals: [],
        skippedReason: "zero_relevance",
      }),
    ]);
  });

  it("keeps stronger token relevance ahead of metadata bonus", () => {
    const result = selectRelevantAcceptedMemories(
      [
        memory({
          id: "metadata-heavy",
          content: { text: "Owner uses memory notes." },
          metadata: {
            tags: ["project", "urgent"],
            importance: "high",
            confidence: "high",
            source: "owner review",
            reviewedAt: "2026-05-19T00:02:00.000Z",
            acceptedAt: "2026-05-19T00:01:00.000Z",
          },
        }),
        memory({
          id: "strong-token-match",
          content: { text: "Owner uses project memory notes." },
          metadata: {
            tags: [],
            importance: "low",
            confidence: "low",
            source: null,
            reviewedAt: null,
            acceptedAt: null,
          },
        }),
      ],
      "project memory notes",
      { maxInjectedMemories: 1 },
    );

    expect(result.map((item) => item.id)).toEqual(["strong-token-match"]);
  });

  it("dampens metadata bonus for low-confidence memories", () => {
    const result = retrieveAcceptedMemoriesWithExplanation(
      [
        memory({
          id: "metadata-low-confidence",
          content: { text: "Owner keeps memory notes." },
          metadata: {
            tags: ["project"],
            importance: "high",
            confidence: "low",
            source: null,
            reviewedAt: "2026-05-19T00:02:00.000Z",
            acceptedAt: "2026-05-19T00:01:00.000Z",
          },
        }),
      ],
      "project memory notes",
    );

    expect(result.explanations).toEqual([
      expect.objectContaining({
        memoryId: "metadata-low-confidence",
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
      }),
    ]);
  });

  it("does not inject zero-overlap memories solely due to type", () => {
    const result = selectRelevantAcceptedMemories(
      [
        memory({
          id: "project-only-type",
          memoryType: "project",
          content: { text: "Owner enjoys weekend hiking trips." },
        }),
      ],
      "project code github branch",
    );

    expect(result).toEqual([]);
  });

  it("respects maxInjectedMemories", () => {
    const memories = Array.from({ length: 8 }, (_, index) =>
      memory({
        id: `m${index}`,
        content: { text: `Owner project note ${index} about local models.` },
        updatedAt: `2026-05-19T00:0${index}:00.000Z`,
      }),
    );

    const result = selectRelevantAcceptedMemories(
      memories,
      "local models project note",
      { maxInjectedMemories: 3 },
    );

    expect(result).toHaveLength(3);
  });

  it("returns nothing when the owner message has no usable tokens", () => {
    const result = selectRelevantAcceptedMemories(
      [memory({ id: "m1", content: { text: "Owner prefers local models." } })],
      "   ",
    );

    expect(result).toEqual([]);
  });
});

describe("retrieveAcceptedMemoriesWithExplanation", () => {
  it("includes matched keywords and overlap count for relevant memories", () => {
    const result = retrieveAcceptedMemoriesWithExplanation(
      [
        memory({
          id: "m1",
          content: { text: "Owner prefers local Ollama models." },
        }),
      ],
      "Which local Ollama model should RIN use?",
    );

    expect(result.snippets).toHaveLength(1);
    expect(result.explanations).toEqual([
      expect.objectContaining({
        memoryId: "m1",
        matchedKeywords: expect.arrayContaining(["local", "ollama", "model"]),
        overlapCount: expect.any(Number),
        snippetLength: expect.any(Number),
      }),
    ]);
    expect(result.explanations[0]?.overlapCount).toBeGreaterThan(0);
    expect(result.explanations[0]?.matchedKeywords.length).toBe(
      result.explanations[0]?.overlapCount,
    );
  });

  it("records zero_relevance for accepted memories with no overlap", () => {
    const result = retrieveAcceptedMemoriesWithExplanation(
      [memory({ id: "m1", content: { text: "Owner enjoys hiking trips." } })],
      "Explain the SQLite schema migration plan.",
    );

    expect(result.snippets).toEqual([]);
    expect(result.explanations).toEqual([
      {
        memoryId: "m1",
        memoryType: "semantic" as const,
        matchedKeywords: [],
        overlapCount: 0,
        latinTokenMatchCount: 0,
        cjkBigramMatchCount: 0,
        normalizedQueryTokenCount: expect.any(Number),
        typeMatchBonus: 0,
        matchedTypeSignals: [],
        matchedTags: [],
        tagMatchBonus: 0,
        importanceBonus: 0,
        confidenceAdjustment: 0,
        metadataBonus: 0,
        metadataSignals: [],
        wasInjected: false,
        skippedReason: "zero_relevance",
        snippetLength: expect.any(Number),
      },
    ]);
  });

  it("omits pending, rejected, and archived memories from explanations", () => {
    const statuses: MemoryStatus[] = ["proposal", "rejected", "archived"];
    const memories = statuses.map((status, index) =>
      memory({
        id: `m-${status}`,
        status,
        content: { text: "Owner prefers local Ollama models." },
        updatedAt: `2026-05-19T00:0${index}:00.000Z`,
      }),
    );

    const result = retrieveAcceptedMemoriesWithExplanation(
      memories,
      "local Ollama model preference",
    );

    expect(result.explanations).toEqual([]);
  });

  it("marks memories beyond maxInjectedMemories with max_count_exceeded", () => {
    const memories = Array.from({ length: 4 }, (_, index) =>
      memory({
        id: `m${index}`,
        content: { text: `Owner project note ${index} about local models.` },
        updatedAt: `2026-05-19T00:0${index}:00.000Z`,
      }),
    );

    const result = retrieveAcceptedMemoriesWithExplanation(
      memories,
      "local models project note",
      { maxInjectedMemories: 2 },
    );

    expect(result.snippets).toHaveLength(2);
    const skipped = result.explanations.filter(
      (item) => item.skippedReason === "max_count_exceeded",
    );
    expect(skipped).toHaveLength(2);
    expect(skipped.every((item) => item.wasInjected === false)).toBe(true);
  });
});

describe("finalizeInjectionExplanations", () => {
  it("marks budget-dropped candidates with memory_budget_exceeded", () => {
    const explanations = [
      {
        memoryId: "m1",
        memoryType: "semantic" as const,
        matchedKeywords: ["local"],
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
        wasInjected: false,
        skippedReason: null,
        snippetLength: 20,
      },
      {
        memoryId: "m2",
        memoryType: "semantic" as const,
        matchedKeywords: ["local"],
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
        wasInjected: false,
        skippedReason: null,
        snippetLength: 20,
      },
    ];

    const finalized = finalizeInjectionExplanations(explanations, ["m1"]);

    expect(finalized[0]).toMatchObject({
      memoryId: "m1",
      wasInjected: true,
      skippedReason: null,
    });
    expect(finalized[1]).toMatchObject({
      memoryId: "m2",
      wasInjected: false,
      skippedReason: "memory_budget_exceeded",
    });
  });
});

describe("toMemoryInjectionTrace", () => {
  it("does not include memory text in trace items", () => {
    const trace = toMemoryInjectionTrace(
      [
        {
          memoryId: "m1",
          memoryType: "semantic" as const,
          matchedKeywords: ["local"],
          overlapCount: 1,
          latinTokenMatchCount: 1,
          cjkBigramMatchCount: 0,
          normalizedQueryTokenCount: 3,
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
          snippetLength: 42,
        },
      ],
      ["m1"],
      120,
    );

    expect(trace.items[0]).not.toHaveProperty("text");
    expect(JSON.stringify(trace)).not.toContain("Owner prefers");
    expect(summarizeMemoryInjection(trace.items).skippedByBudgetCount).toBe(0);
  });
});

describe("memorySnippetText", () => {
  it("prefers the text field, then bilingual fields", () => {
    expect(memorySnippetText({ text: "primary", english: "en" })).toBe(
      "primary",
    );
    expect(memorySnippetText({ english: "english only" })).toBe("english only");
    expect(memorySnippetText({ chinese: "中文记忆" })).toBe("中文记忆");
    expect(memorySnippetText({})).toBe("");
  });

  it("collapses whitespace and caps snippet length", () => {
    expect(memorySnippetText({ text: "a   b\n c" })).toBe("a b c");

    const long = "x".repeat(400);
    const snippet = memorySnippetText({ text: long }, 50);
    expect(snippet.length).toBe(50);
    expect(snippet.endsWith("…")).toBe(true);
  });
});
