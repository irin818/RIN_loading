import { describe, expect, it } from "vitest";
import type { ModelMessage } from "../model";
import { buildModelContext } from "./contextBuilder";

describe("buildModelContext", () => {
  it("places the generated system message first and retained messages chronologically", () => {
    const context = buildModelContext([
      owner("first"),
      rin("second"),
      owner("third"),
    ]);

    expect(context.messages.map((message) => message.role)).toEqual([
      "system",
      "owner",
      "rin",
      "owner",
    ]);
    expect(context.messages.map((message) => message.content)).toEqual([
      expect.stringContaining("conversational model used by RIN"),
      "first",
      "second",
      "third",
    ]);
  });

  it("drops older messages first when the message budget is exceeded", () => {
    const context = buildModelContext(
      [
        owner("owner-1"),
        rin("rin-1"),
        owner("owner-2"),
        rin("rin-2"),
        owner("owner-3"),
      ],
      {
        maxRecentMessages: 3,
        maxInputCharacters: 12_000,
        preserveLatestOwnerMessage: true,
      },
    );

    expect(context.messages.map((message) => message.content)).toEqual([
      expect.stringContaining("conversational model used by RIN"),
      "owner-2",
      "rin-2",
      "owner-3",
    ]);
    expect(context.stats.droppedMessageCount).toBe(2);
  });

  it("preserves the latest owner message when the character budget is tight", () => {
    const context = buildModelContext(
      [
        owner("older owner ".repeat(80)),
        rin("older rin ".repeat(80)),
        owner("latest owner must stay"),
      ],
      {
        maxRecentMessages: 12,
        maxInputCharacters: 120,
        preserveLatestOwnerMessage: true,
      },
    );

    expect(context.messages.at(-1)).toEqual(owner("latest owner must stay"));
    expect(context.messages.some((message) => message.content.startsWith("older"))).toBe(
      false,
    );
  });

  it("does not duplicate stored system messages", () => {
    const context = buildModelContext([
      { role: "system", content: "stored system prompt" },
      owner("hello"),
    ]);

    expect(context.messages.filter((message) => message.role === "system")).toHaveLength(
      1,
    );
    expect(context.messages[0].content).not.toBe("stored system prompt");
    expect(context.messages[1]).toEqual(owner("hello"));
  });

  it("reports character count and applied budget stats", () => {
    const context = buildModelContext([owner("hello")]);

    expect(context.stats.contextBudgetApplied).toBe(true);
    expect(context.stats.messageCount).toBe(context.messages.length);
    expect(context.stats.characterCount).toBe(
      context.messages.reduce(
        (total, message) => total + message.content.length,
        0,
      ),
    );
  });
});

describe("buildModelContext memory injection", () => {
  it("injects a memory block after the system prompt and before conversation", () => {
    const context = buildModelContext([owner("hello")], undefined, {
      memories: [
        { id: "m1", text: "Owner prefers local Ollama models." },
        { id: "m2", text: "Owner works on the RIN project." },
      ],
    });

    expect(context.messages.map((message) => message.role)).toEqual([
      "system",
      "system",
      "owner",
    ]);
    expect(context.messages[1].content).toContain(
      "Relevant accepted owner memories:",
    );
    expect(context.messages[1].content).toContain("[memory:m1]");
    expect(context.messages[1].content).toContain("[memory:m2]");
    expect(context.messages[1].content).toContain(
      "prefer the current user message",
    );
    expect(context.messages.at(-1)).toEqual(owner("hello"));
  });

  it("records injected memory ids, count, and character count in stats", () => {
    const context = buildModelContext([owner("hello")], undefined, {
      memories: [{ id: "m1", text: "Owner prefers local Ollama models." }],
    });

    expect(context.stats.injectedMemoryCount).toBe(1);
    expect(context.stats.injectedMemoryIds).toEqual(["m1"]);
    expect(context.stats.memoryContextCharacterCount).toBe(
      context.messages[1].content.length,
    );
    expect(context.stats.deterministicInjectedMemoryIds).toEqual(["m1"]);
    expect(context.stats.semanticInjectedMemoryIds).toEqual([]);
  });

  it("distinguishes opt-in semantic memory sources in stats", () => {
    const context = buildModelContext([owner("hello")], undefined, {
      memories: [
        { id: "deterministic", text: "Deterministic accepted memory." },
        { id: "semantic", text: "Semantic accepted memory." },
      ],
      semanticCandidateIds: ["semantic"],
      semanticContextExpansionEnabled: true,
    });

    expect(context.stats.injectedMemoryIds).toEqual(["deterministic", "semantic"]);
    expect(context.stats.deterministicInjectedMemoryIds).toEqual(["deterministic"]);
    expect(context.stats.semanticInjectedMemoryIds).toEqual(["semantic"]);
    expect(context.stats.semanticCandidateIds).toEqual(["semantic"]);
    expect(context.stats.semanticContextExpansionEnabled).toBe(true);
    expect(
      context.stats.memoryInjectionExplanations.every(
        (item) => item.contextSource !== "semantic",
      ),
    ).toBe(true);
  });

  it("reports no injected memories when none are provided", () => {
    const context = buildModelContext([owner("hello")]);

    expect(context.messages.filter((message) => message.role === "system")).toHaveLength(
      1,
    );
    expect(context.stats.injectedMemoryCount).toBe(0);
    expect(context.stats.injectedMemoryIds).toEqual([]);
    expect(context.stats.memoryContextCharacterCount).toBe(0);
  });

  it("respects maxMemoryContextCharacters by dropping the least relevant memories", () => {
    const context = buildModelContext([owner("hello")], undefined, {
      memories: [
        { id: "m1", text: "first memory snippet" },
        { id: "m2", text: "second memory snippet" },
        { id: "m3", text: "third memory snippet" },
      ],
      explanations: [
        {
          memoryId: "m1",
          memoryType: "semantic",
          matchedKeywords: ["first"],
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
          memoryType: "semantic",
          matchedKeywords: ["second"],
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
          memoryId: "m3",
          memoryType: "semantic",
          matchedKeywords: ["third"],
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
      ],
      maxMemoryContextCharacters: 355,
    });

    expect(context.stats.injectedMemoryCount).toBe(2);
    expect(context.stats.memoryContextCharacterCount).toBeLessThanOrEqual(355);
    expect(context.stats.injectedMemoryIds).toEqual(["m1", "m2"]);
    expect(context.stats.injectedMemoryIds).not.toContain("m3");
    const budgetSkipped = context.stats.memoryInjectionExplanations.find(
      (item) => item.memoryId === "m3",
    );
    expect(budgetSkipped?.skippedReason).toBe("memory_budget_exceeded");
    expect(context.stats.memorySkippedByBudgetCount).toBe(1);
  });

  it("respects maxInjectedMemories", () => {
    const memories = Array.from({ length: 8 }, (_, index) => ({
      id: `m${index}`,
      text: `memory ${index}`,
    }));

    const context = buildModelContext([owner("hello")], undefined, {
      memories,
      maxInjectedMemories: 2,
    });

    expect(context.stats.injectedMemoryCount).toBe(2);
  });

  it("never drops the latest owner message to make room for memories", () => {
    const context = buildModelContext(
      [owner("the latest owner message must remain")],
      {
        maxRecentMessages: 12,
        maxInputCharacters: 60,
        preserveLatestOwnerMessage: true,
      },
      {
        memories: [
          { id: "m1", text: "a".repeat(300) },
          { id: "m2", text: "b".repeat(300) },
        ],
      },
    );

    expect(context.messages.at(-1)).toEqual(
      owner("the latest owner message must remain"),
    );
    expect(context.stats.injectedMemoryCount).toBe(0);
  });
});

function owner(content: string): ModelMessage {
  return { role: "owner", content };
}

function rin(content: string): ModelMessage {
  return { role: "rin", content };
}
