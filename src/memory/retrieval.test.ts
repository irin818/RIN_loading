import { describe, expect, it } from "vitest";
import type { MemoryRecord, MemoryStatus } from "./manager";
import {
  memorySnippetText,
  selectRelevantAcceptedMemories,
} from "./retrieval";

function memory(
  overrides: Partial<MemoryRecord> & { id: string },
): MemoryRecord {
  return {
    id: overrides.id,
    memoryType: overrides.memoryType ?? "semantic",
    content: overrides.content ?? { text: "" },
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
