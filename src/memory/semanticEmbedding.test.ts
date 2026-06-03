import { describe, expect, it } from "vitest";
import {
  cosineSimilarity,
  createFixtureSemanticEmbeddingProvider,
  createUnsupportedLocalEmbeddingProvider,
  dotProduct,
  evaluateLocalEmbeddingProviderReadiness,
  normalizeVector,
} from "./semanticEmbedding";

describe("fixture semantic embedding provider", () => {
  it("creates deterministic local vectors without provider calls", () => {
    const provider = createFixtureSemanticEmbeddingProvider({ dimension: 8 });
    const first = provider.embed({
      id: "query",
      terms: ["Morning Routine", "inbox"],
    });
    const second = provider.embed({
      id: "query",
      terms: ["Morning Routine", "inbox"],
    });

    expect(first.vector).toEqual(second.vector);
    expect(first.providerKind).toBe("fixture-mock-local");
    expect(first.providerCallCount).toBe(0);
    expect(first.vector).toHaveLength(8);
    expect(dotProduct(first.vector, first.vector)).toBeCloseTo(1);
  });

  it("normalizes vectors and computes cosine similarity", () => {
    expect(normalizeVector([3, 4])).toEqual([0.6, 0.8]);
    expect(dotProduct([1, 2], [3, 4])).toBe(11);
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
  });

  it("reports the future local embedding provider as disabled by default", () => {
    const readiness = evaluateLocalEmbeddingProviderReadiness();

    expect(readiness).toMatchObject({
      enabled: false,
      status: "disabled",
      providerId: null,
      providerCallCount: 0,
    });
  });

  it("keeps enabled local provider configs unsupported in this milestone", () => {
    const readiness = evaluateLocalEmbeddingProviderReadiness({
      enabled: true,
      provider: "ollama-local",
      model: "embedding-model",
    });

    expect(readiness).toMatchObject({
      enabled: true,
      status: "unsupported",
      providerId: "ollama-local",
      providerCallCount: 0,
    });
    expect(() =>
      createUnsupportedLocalEmbeddingProvider({
        enabled: true,
        provider: "ollama-local",
        model: "embedding-model",
      }),
    ).toThrow("disabled scaffold only");
  });
});
