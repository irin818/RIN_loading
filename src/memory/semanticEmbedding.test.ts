import { describe, expect, it } from "vitest";
import {
  classifyLocalEmbeddingError,
  cosineSimilarity,
  createFixtureSemanticEmbeddingProvider,
  createOllamaLocalEmbeddingProvider,
  createUnsupportedLocalEmbeddingProvider,
  dotProduct,
  evaluateLocalEmbeddingProviderReadiness,
  LocalEmbeddingProviderError,
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
      providerKind: "disabled-local-scaffold",
      modelId: null,
      dimension: null,
      latencyMs: null,
      providerCallCount: 0,
      errorCode: "LOCAL_EMBEDDING_DISABLED",
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
      providerKind: "ollama-local",
      modelId: "embedding-model",
      providerCallCount: 0,
      errorCode: "LOCAL_EMBEDDING_UNSUPPORTED",
    });
    expect(() =>
      createUnsupportedLocalEmbeddingProvider({
        enabled: true,
        provider: "ollama-local",
        model: "embedding-model",
      }),
    ).toThrow("disabled scaffold only");
  });

  it("classifies local embedding provider errors without exposing internals", () => {
    expect(
      classifyLocalEmbeddingError(
        new LocalEmbeddingProviderError(
          "LOCAL_EMBEDDING_DIMENSION_MISMATCH",
          "private detail",
        ),
      ),
    ).toEqual({
      code: "LOCAL_EMBEDDING_DIMENSION_MISMATCH",
      message:
        "Local embedding provider returned an unexpected vector dimension.",
    });
    expect(classifyLocalEmbeddingError(new Error("secret path"))).toEqual({
      code: "LOCAL_EMBEDDING_UNAVAILABLE",
      message: "Local embedding provider is unavailable.",
    });
  });

  it("creates an explicit Ollama local embedding provider boundary", () => {
    const provider = createOllamaLocalEmbeddingProvider({
      enabled: true,
      provider: "ollama-local",
      model: "nomic-embed-text",
      baseUrl: "http://127.0.0.1:11434/",
      timeoutMs: 1000,
      expectedDimension: 768,
    });

    expect(provider).toMatchObject({
      providerId: "ollama-local-embedding",
      providerKind: "ollama-local",
      modelId: "nomic-embed-text",
      expectedDimension: 768,
      timeoutMs: 1000,
    });
  });
});
