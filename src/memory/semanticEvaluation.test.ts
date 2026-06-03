import { describe, expect, it } from "vitest";
import {
  evaluateSemanticComparisonCase,
  formatSemanticComparisonSummary,
  runBuiltInSemanticComparisonEvaluation,
  runSemanticComparisonCases,
} from "./semanticEvaluation";
import { BUILT_IN_SEMANTIC_COMPARISON_CASES } from "./semanticEvaluationFixtures";

describe("runBuiltInSemanticComparisonEvaluation", () => {
  it("passes fixture-only semantic comparison cases without provider calls", () => {
    const result = runBuiltInSemanticComparisonEvaluation();

    expect(result.total).toBe(11);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(result.total);
    expect(result.providerCallCount).toBe(0);
    expect(result.prototypeSemanticProvider).toBe("fixture-mock-local-embedding");
    expect(result.prototypeRanCaseCount).toBe(8);
    expect(result.prototypeSemanticCandidateCount).toBe(10);
    expect(result.tempEmbeddingProvider).toBe("fixture-mock-local-embedding");
    expect(result.tempEmbeddingProviderKind).toBe("fixture-mock-local");
    expect(result.tempEmbeddingProviderCallCount).toBe(0);
    expect(result.tempEmbeddingIndexedAcceptedCount).toBe(2);
    expect(result.tempEmbeddingCandidateCount).toBe(2);
    expect(result.falsePositiveCount).toBe(2);
    expect(result.falseNegativeCount).toBe(0);
    expect(result.acceptedOnlyViolationCount).toBe(1);
    expect(result.zeroOverlapSemanticCandidateCount).toBeGreaterThan(0);
  });

  it("prints a concise safe summary", () => {
    const result = runBuiltInSemanticComparisonEvaluation();
    const summary = formatSemanticComparisonSummary(result);

    expect(summary).toContain(
      "RIN semantic retrieval comparison evaluation.",
    );
    expect(summary).toContain("Mode: fixture-only, provider-free, report-only.");
    expect(summary).toContain("Total: 11");
    expect(summary).toContain("Failed: 0");
    expect(summary).toContain("providerCallCount: 0");
    expect(summary).toContain("Prototype provider: fixture-mock-local-embedding");
    expect(summary).toContain("Prototype ran cases: 8");
    expect(summary).toContain("Prototype semantic candidates: 10");
    expect(summary).toContain(
      "Temp embedding provider: fixture-mock-local-embedding",
    );
    expect(summary).toContain("Temp embedding provider kind: fixture-mock-local");
    expect(summary).toContain("Temp embedding providerCallCount: 0");
    expect(summary).toContain("False positives: 2");
    expect(summary).toContain("False negatives: 0");
    expect(summary).toContain("Accepted-only violations detected: 1");
    expect(summary).toContain("Failed case IDs: none");
    expect(summary).toContain("Categories:");
    expect(summary).not.toContain(
      "Synthetic confidential semantic phrase must stay out of reports",
    );
  });

  it("does not expose full fixture memory text in report objects", () => {
    const result = runBuiltInSemanticComparisonEvaluation();
    const reportJson = JSON.stringify(result);

    expect(reportJson).not.toContain(
      "Synthetic confidential semantic phrase must stay out of reports",
    );
    expect(reportJson).not.toContain(
      "Owner starts the day by triaging urgent inbox items before calendar review",
    );
  });

  it("is deterministic across repeated runs", () => {
    const first = runBuiltInSemanticComparisonEvaluation();
    const second = runBuiltInSemanticComparisonEvaluation();

    expect(first.caseResults.map((result) => result.semanticCandidateIds)).toEqual(
      second.caseResults.map((result) => result.semanticCandidateIds),
    );
    expect(formatSemanticComparisonSummary(first)).toEqual(
      formatSemanticComparisonSummary(second),
    );
  });
});

describe("evaluateSemanticComparisonCase", () => {
  it("compares a paraphrase semantic candidate that deterministic retrieval misses", () => {
    const result = resultFor("semantic-paraphrase-recovers-routine");

    expect(result.passed).toBe(true);
    expect(result.deterministicInjectedIds).toEqual([]);
    expect(result.semanticCandidateIds).toEqual(["sem-paraphrase-routine"]);
    expect(result.prototypeSemanticCandidateIds).toEqual([
      "sem-paraphrase-routine",
    ]);
    expect(result.hybridCandidateIds).toEqual(["sem-paraphrase-routine"]);
    expect(result.semanticCandidateSourceBreakdown).toEqual({
      explicitFixtureAnnotationIds: ["sem-paraphrase-routine"],
      fixtureEmbeddingPrototypeIds: ["sem-paraphrase-routine"],
    });
    expect(result.falseNegativeIds).toEqual([]);
    expect(result.zeroOverlapSemanticCandidateIds).toEqual([
      "sem-paraphrase-routine",
    ]);
    expect(result.contextBudgetImpact.wouldAddSemanticIds).toEqual([
      "sem-paraphrase-routine",
    ]);
    expect(result.providerCallCount).toBe(0);
    expect(result.prototypeSemanticProvider).toBe("fixture-mock-local-embedding");
  });

  it("detects semantic false positives without failing expected negative fixtures", () => {
    const result = resultFor("semantic-false-positive-detected");

    expect(result.passed).toBe(true);
    expect(result.deterministicInjectedIds).toEqual(["sem-local-adapter"]);
    expect(result.falsePositiveIds).toEqual(["sem-ui-theme"]);
    expect(result.falseNegativeIds).toEqual([]);
  });

  it("detects prototype semantic false positives", () => {
    const result = resultFor("semantic-prototype-false-positive-detected");

    expect(result.passed).toBe(true);
    expect(result.prototypeSemanticCandidateIds).toEqual([
      "sem-prototype-near-miss",
      "sem-prototype-target",
    ]);
    expect(result.falsePositiveIds).toEqual(["sem-prototype-near-miss"]);
    expect(
      result.semanticCandidateSourceBreakdown.explicitFixtureAnnotationIds,
    ).toEqual([]);
  });

  it("reports deterministic and semantic candidates in a hybrid candidate set", () => {
    const result = resultFor("semantic-hybrid-identifies-both-sources");

    expect(result.passed).toBe(true);
    expect(result.deterministicInjectedIds).toEqual(["sem-branch-review"]);
    expect(result.safeSemanticCandidateIds).toEqual(["sem-merge-gate"]);
    expect(result.hybridCandidateIds).toEqual([
      "sem-branch-review",
      "sem-merge-gate",
    ]);
    expect(result.contextBudgetImpact.wouldDropDeterministicIds).toEqual([]);
    expect(result.contextBudgetImpact.wouldAddSemanticIds).toEqual([
      "sem-merge-gate",
    ]);
  });

  it("flags and excludes non-accepted semantic candidates", () => {
    const result = resultFor("semantic-non-accepted-flagged-and-excluded");

    expect(result.passed).toBe(true);
    expect(result.acceptedOnlyPassed).toBe(false);
    expect(result.acceptedOnlyViolationIds).toEqual(["sem-pending-boundary"]);
    expect(result.prototypeSemanticCandidateIds).toEqual([
      "sem-accepted-boundary",
      "sem-pending-boundary",
    ]);
    expect(result.safePrototypeSemanticCandidateIds).toEqual([
      "sem-accepted-boundary",
    ]);
    expect(result.safeSemanticCandidateIds).toEqual(["sem-accepted-boundary"]);
    expect(result.hybridCandidateIds).toEqual(["sem-accepted-boundary"]);
  });

  it("keeps semantic reports free of forbidden full memory text", () => {
    const result = resultFor("semantic-privacy-report-hides-text");

    expect(result.passed).toBe(true);
    expect(result.privacyPassed).toBe(true);
    expect(result.privacyCheck).toMatchObject({
      passed: true,
      leakedMemoryTextCount: 0,
      leakedPromptTextCount: 0,
      leakedRawMetadataCount: 0,
    });
    expect(JSON.stringify(result)).not.toContain(
      "Synthetic confidential semantic phrase must stay out of reports",
    );
  });

  it("keeps zero-overlap semantic candidates report-only", () => {
    const result = resultFor("semantic-zero-overlap-report-only");

    expect(result.passed).toBe(true);
    expect(result.deterministicInjectedIds).toEqual([]);
    expect(result.zeroOverlapSemanticCandidateIds).toEqual([
      "sem-secret-hygiene",
    ]);
    expect(result.hybridCandidateIds).toEqual(["sem-secret-hygiene"]);
    expect(result.contextBudgetImpact.wouldAddSemanticIds).toEqual([
      "sem-secret-hygiene",
    ]);
  });

  it("applies prototype topK, candidate cap, and tie-break ordering", () => {
    const result = resultFor("semantic-prototype-topk-cap-tiebreak");

    expect(result.passed).toBe(true);
    expect(result.prototypeTopK).toBe(3);
    expect(result.prototypeCandidateCap).toBe(2);
    expect(result.prototypeSemanticCandidateIds).toEqual([
      "sem-tie-a",
      "sem-tie-b",
    ]);
  });

  it("keeps no-candidate and no-annotation fixtures neutral", () => {
    const noCandidates = resultFor("semantic-prototype-no-candidates");
    const neutral = resultFor("semantic-old-no-annotation-neutrality");

    expect(noCandidates.passed).toBe(true);
    expect(noCandidates.prototypeSemanticCandidateIds).toEqual([]);
    expect(noCandidates.hybridCandidateIds).toEqual(["sem-no-prototype-terms"]);
    expect(neutral.passed).toBe(true);
    expect(neutral.prototypeSemanticProviderRan).toBe(false);
    expect(neutral.semanticCandidateIds).toEqual([]);
    expect(neutral.hybridCandidateIds).toEqual(["sem-neutral-metadata"]);
  });

  it("can fail safely when deterministic baseline expectations drift", () => {
    const result = evaluateSemanticComparisonCase({
      caseId: "semantic-baseline-drift",
      query: "local model",
      acceptedMemories: [{ id: "actual", text: "local model memory" }],
      semanticCandidateIds: [],
      expectedInjectedIds: ["actual"],
      expectedDeterministicInjectedIds: [],
    });

    expect(result.passed).toBe(false);
    expect(result.failureMessages.join("\n")).toContain(
      "Expected deterministic injected ids",
    );
    expect(result.failureMessages.join("\n")).not.toContain(
      "local model memory",
    );
  });

  it("summarizes expected failures without leaking fixture text", () => {
    const result = runSemanticComparisonCases([
      {
        caseId: "semantic-safe-failure",
        query: "private report",
        acceptedMemories: [
          {
            id: "private",
            text: "private semantic failure text must not print",
          },
        ],
        semanticCandidateIds: [],
        expectedInjectedIds: ["missing"],
        expectedDeterministicInjectedIds: [],
      },
    ]);
    const summary = formatSemanticComparisonSummary(result);

    expect(result.failedCaseIds).toEqual(["semantic-safe-failure"]);
    expect(summary).toContain("Failed case IDs: semantic-safe-failure");
    expect(summary).not.toContain("private semantic failure text");
  });
});

function resultFor(caseId: string) {
  const item = BUILT_IN_SEMANTIC_COMPARISON_CASES.find(
    (candidate) => candidate.caseId === caseId,
  );

  if (!item) {
    throw new Error(`Missing fixture case ${caseId}.`);
  }

  return evaluateSemanticComparisonCase(item);
}
