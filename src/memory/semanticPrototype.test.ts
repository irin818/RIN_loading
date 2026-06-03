import { describe, expect, it } from "vitest";
import { generateFixtureSemanticCandidates } from "./semanticPrototype";

describe("generateFixtureSemanticCandidates", () => {
  it("generates deterministic accepted fixture candidates", () => {
    const result = generateFixtureSemanticCandidates({
      queryId: "case",
      queryTerms: ["morning-routine"],
      memories: [
        {
          id: "routine",
          status: "accepted",
          prototypeEmbeddingTerms: ["morning-routine"],
        },
        {
          id: "other",
          status: "accepted",
          prototypeEmbeddingTerms: ["other-topic"],
        },
      ],
      topK: 1,
    });

    expect(result.safePrototypeSemanticCandidateIds).toEqual(["routine"]);
    expect(result.prototypeSemanticCandidateIds).toEqual(["routine"]);
    expect(result.providerCallCount).toBe(0);
    expect(result.embeddingRequestCount).toBe(3);
  });

  it("flags non-accepted candidates without adding them to safe candidates", () => {
    const result = generateFixtureSemanticCandidates({
      queryId: "case",
      queryTerms: ["boundary"],
      memories: [
        {
          id: "accepted",
          status: "accepted",
          prototypeEmbeddingTerms: ["boundary"],
        },
        {
          id: "pending",
          status: "proposal",
          prototypeEmbeddingTerms: ["boundary"],
        },
      ],
      topK: 2,
      candidateCap: 2,
    });

    expect(result.prototypeSemanticCandidateIds).toEqual([
      "accepted",
      "pending",
    ]);
    expect(result.safePrototypeSemanticCandidateIds).toEqual(["accepted"]);
    expect(result.nonAcceptedPrototypeCandidateIds).toEqual(["pending"]);
  });

  it("applies topK, candidate caps, and id tie-breaking", () => {
    const result = generateFixtureSemanticCandidates({
      queryId: "case",
      queryTerms: ["tie"],
      memories: [
        { id: "b", prototypeEmbeddingTerms: ["tie"] },
        { id: "a", prototypeEmbeddingTerms: ["tie"] },
        { id: "c", prototypeEmbeddingTerms: ["tie"] },
      ],
      topK: 3,
      candidateCap: 2,
    });

    expect(result.safePrototypeSemanticCandidateIds).toEqual(["a", "b"]);
    expect(result.prototypeSemanticCandidateIds).toEqual(["a", "b"]);
  });

  it("returns no candidates when query terms or fixture terms are absent", () => {
    expect(
      generateFixtureSemanticCandidates({
        queryId: "empty-query",
        memories: [{ id: "memory", prototypeEmbeddingTerms: ["topic"] }],
      }).prototypeSemanticCandidateIds,
    ).toEqual([]);
    expect(
      generateFixtureSemanticCandidates({
        queryId: "empty-memory",
        queryTerms: ["topic"],
        memories: [{ id: "memory" }],
      }).prototypeSemanticCandidateIds,
    ).toEqual([]);
  });
});
