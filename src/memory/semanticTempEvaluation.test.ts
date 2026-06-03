import { describe, expect, it } from "vitest";
import {
  formatTempSemanticEmbeddingEvaluationSummary,
  isDefaultTempSemanticProvider,
  runBuiltInTempSemanticEmbeddingEvaluation,
  runTempSemanticEmbeddingEvaluation,
} from "./semanticTempEvaluation";

describe("runTempSemanticEmbeddingEvaluation", () => {
  it("embeds accepted temp fixtures through the fixture provider only", () => {
    const result = runBuiltInTempSemanticEmbeddingEvaluation();

    expect(result.mode).toBe("temp-fixture-report-only");
    expect(result.providerId).toBe("fixture-mock-local-embedding");
    expect(result.providerKind).toBe("fixture-mock-local");
    expect(result.providerCallCount).toBe(0);
    expect(result.providerCallCountByProviderKind).toEqual({
      "fixture-mock-local": 0,
    });
    expect(result.embeddingRequestCount).toBe(3);
    expect(result.indexedAcceptedCount).toBe(2);
    expect(result.excludedNonAcceptedIds).toEqual([
      "temp-pending-provider-boundary",
    ]);
    expect(result.candidateIds).toEqual([
      "temp-local-provider-boundary",
      "temp-semantic-index-lifecycle",
    ]);
    expect(result.privacyPassed).toBe(true);
    expect(isDefaultTempSemanticProvider(result)).toBe(true);
  });

  it("is deterministic across repeated runs", () => {
    const first = runBuiltInTempSemanticEmbeddingEvaluation();
    const second = runBuiltInTempSemanticEmbeddingEvaluation();

    expect(first).toEqual(second);
    expect(formatTempSemanticEmbeddingEvaluationSummary(first)).toEqual(
      formatTempSemanticEmbeddingEvaluationSummary(second),
    );
  });

  it("keeps reports free of temp source text", () => {
    const result = runTempSemanticEmbeddingEvaluation({
      queryId: "private-temp-query",
      queryTerms: ["private-topic"],
      records: [
        {
          id: "private-temp-id",
          status: "accepted",
          embeddingTerms: ["private-topic"],
        },
      ],
    });
    const summary = formatTempSemanticEmbeddingEvaluationSummary(result);

    expect(summary).toContain("private-temp-id");
    expect(summary).not.toContain("private-topic");
    expect(summary).not.toContain("private-temp-query");
  });

  it("returns no candidates when query terms are absent", () => {
    const result = runTempSemanticEmbeddingEvaluation({
      queryId: "empty",
      queryTerms: [],
      records: [
        {
          id: "temp-record",
          status: "accepted",
          embeddingTerms: ["topic"],
        },
      ],
    });

    expect(result.candidateIds).toEqual([]);
    expect(result.embeddingRequestCount).toBe(0);
    expect(result.providerCallCount).toBe(0);
  });
});
