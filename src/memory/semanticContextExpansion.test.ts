import { describe, expect, it } from "vitest";
import { readSemanticContextConfig } from "../context";
import type { MemoryRecord } from "./manager";
import { selectSemanticContextExpansionCandidates } from "./semanticContextExpansion";

describe("selectSemanticContextExpansionCandidates", () => {
  it("stays disabled by default", () => {
    const result = selectSemanticContextExpansionCandidates({
      memories: [memory("accepted", "semantic local memory")],
      ownerMessage: "semantic local",
      deterministicMemoryIds: [],
      config: readSemanticContextConfig({}),
    });

    expect(result.enabled).toBe(false);
    expect(result.candidateIds).toEqual([]);
    expect(result.providerCallCount).toBe(0);
    expect(result.errorCode).toBe("SEMANTIC_CONTEXT_DISABLED");
  });

  it("adds only accepted semantic candidates outside deterministic IDs", () => {
    const result = selectSemanticContextExpansionCandidates({
      memories: [
        memory("deterministic", "semantic local"),
        memory("semantic-only", "semantic local"),
        memory("proposal", "semantic local", { status: "proposal" }),
      ],
      ownerMessage: "semantic local",
      deterministicMemoryIds: ["deterministic"],
      config: readSemanticContextConfig({
        RIN_SEMANTIC_CONTEXT: "candidate-expansion",
        RIN_SEMANTIC_CONTEXT_MAX_CANDIDATES: "2",
      }),
    });

    expect(result.enabled).toBe(true);
    expect(result.candidateIds).toEqual(["semantic-only"]);
    expect(result.snippets.map((snippet) => snippet.id)).toEqual(["semantic-only"]);
    expect(result.explanations[0]?.contextSource).toBe("semantic");
    expect(result.skippedNonAcceptedIds).toEqual(["proposal"]);
    expect(result.providerCallCount).toBe(0);
  });

  it("enforces candidate and character caps", () => {
    const result = selectSemanticContextExpansionCandidates({
      memories: [
        memory("a", "stable semantic"),
        memory("b", "stable semantic"),
        memory("c", "stable semantic"),
      ],
      ownerMessage: "stable semantic",
      deterministicMemoryIds: [],
      config: readSemanticContextConfig({
        RIN_SEMANTIC_CONTEXT: "candidate-expansion",
        RIN_SEMANTIC_CONTEXT_MAX_CANDIDATES: "2",
        RIN_SEMANTIC_CONTEXT_MAX_CHARACTERS: "15",
      }),
    });

    expect(result.candidateIds).toEqual(["a", "b"]);
    expect(result.snippets).toHaveLength(1);
    expect(result.snippets[0]?.id).toBe("a");
  });

  it("falls back safely when config is invalid", () => {
    const result = selectSemanticContextExpansionCandidates({
      memories: [memory("accepted", "semantic local memory")],
      ownerMessage: "semantic local",
      deterministicMemoryIds: [],
      config: readSemanticContextConfig({
        RIN_SEMANTIC_CONTEXT: "candidate-expansion",
        RIN_SEMANTIC_CONTEXT_MAX_CANDIDATES: "zero",
      }),
    });

    expect(result.enabled).toBe(false);
    expect(result.errorCode).toBe("SEMANTIC_CONTEXT_INVALID_CONFIG");
    expect(result.candidateIds).toEqual([]);
  });
});

function memory(
  id: string,
  text: string,
  overrides: Partial<MemoryRecord> = {},
): MemoryRecord {
  return {
    id,
    memoryType: "semantic",
    content: overrides.content ?? { text },
    metadata: {
      tags: [],
      importance: "normal",
      confidence: "medium",
      source: null,
      reviewedAt: null,
      acceptedAt: null,
    },
    sourceMessageId: null,
    status: overrides.status ?? "accepted",
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z",
    ...overrides,
  };
}
