import { buildModelContext } from "../context";
import type { AcceptedMemorySnippet } from "./retrieval";
import type { MemoryRecord, MemoryStatus } from "./manager";
import {
  memorySnippetText,
  retrieveAcceptedMemoriesWithExplanation,
  toMemoryInjectionTrace,
} from "./retrieval";
import {
  buildRetrievalTokenProfile,
  scoreRetrievalOverlap,
} from "./retrievalTokens";
import {
  generateFixtureSemanticCandidates,
  type FixtureSemanticCandidateGenerationResult,
} from "./semanticPrototype";
import {
  runBuiltInTempSemanticEmbeddingEvaluation,
  type TempSemanticEmbeddingEvaluationResult,
} from "./semanticTempEvaluation";
import {
  BUILT_IN_SEMANTIC_COMPARISON_CASES,
  type SemanticComparisonCase,
  type SemanticComparisonCategory,
  type SemanticComparisonMemoryInput,
} from "./semanticEvaluationFixtures";

export type SemanticComparisonPrivacyCheck = {
  passed: boolean;
  leakedMemoryTextCount: number;
  leakedPromptTextCount: number;
  leakedRawMetadataCount: number;
};

export type SemanticComparisonContextBudgetImpact = {
  deterministicMemoryContextCharacters: number;
  hybridMemoryContextCharacters: number;
  characterDelta: number;
  wouldDropDeterministicIds: string[];
  wouldAddSemanticIds: string[];
};

export type SemanticComparisonCaseResult = {
  caseId: string;
  categories: SemanticComparisonCategory[];
  query: string;
  passed: boolean;
  notes: string[];
  failureMessages: string[];
  deterministicInjectedCount: number;
  semanticCandidateCount: number;
  hybridCandidateCount: number;
  deterministicInjectedIds: string[];
  explicitSemanticCandidateIds: string[];
  prototypeSemanticCandidateIds: string[];
  safePrototypeSemanticCandidateIds: string[];
  nonAcceptedPrototypeCandidateIds: string[];
  semanticCandidateIds: string[];
  safeSemanticCandidateIds: string[];
  hybridCandidateIds: string[];
  semanticCandidateSourceBreakdown: {
    explicitFixtureAnnotationIds: string[];
    fixtureEmbeddingPrototypeIds: string[];
  };
  expectedInjectedIds: string[];
  falsePositiveIds: string[];
  falseNegativeIds: string[];
  acceptedOnlyViolationIds: string[];
  acceptedOnlyPassed: boolean;
  zeroOverlapSemanticCandidateIds: string[];
  privacyPassed: boolean;
  privacyCheck: SemanticComparisonPrivacyCheck;
  contextBudgetImpact: SemanticComparisonContextBudgetImpact;
  providerCallCount: 0;
  prototypeEmbeddingRequestCount: number;
  prototypeSemanticProvider: string;
  prototypeSemanticProviderRan: boolean;
  prototypeTopK: number;
  prototypeCandidateCap: number;
  semanticRuntimeId: "fixture-only";
  semanticModelId: string;
  indexImplementationId: string;
};

export type SemanticComparisonCategorySummary = {
  category: SemanticComparisonCategory;
  total: number;
  passed: number;
  failed: number;
  failedCaseIds: string[];
};

export type SemanticComparisonRunResult = {
  total: number;
  passed: number;
  failed: number;
  failedCaseIds: string[];
  falsePositiveCount: number;
  falseNegativeCount: number;
  acceptedOnlyViolationCount: number;
  zeroOverlapSemanticCandidateCount: number;
  deterministicInjectedCount: number;
  semanticCandidateCount: number;
  prototypeSemanticCandidateCount: number;
  hybridCandidateCount: number;
  prototypeRanCaseCount: number;
  prototypeTopKValues: number[];
  prototypeCandidateCapValues: number[];
  prototypeSemanticProvider: string;
  tempEmbeddingProvider: string;
  tempEmbeddingProviderKind: string;
  tempEmbeddingCandidateCount: number;
  tempEmbeddingIndexedAcceptedCount: number;
  tempEmbeddingProviderCallCount: number;
  providerCallCount: 0;
  categorySummaries: SemanticComparisonCategorySummary[];
  caseResults: SemanticComparisonCaseResult[];
  tempEmbeddingEvaluation: TempSemanticEmbeddingEvaluationResult;
};

const DEFAULT_SEMANTIC_EVAL_NOW = "2026-05-22T00:00:00.000Z";

export function runBuiltInSemanticComparisonEvaluation(): SemanticComparisonRunResult {
  return runSemanticComparisonCases(BUILT_IN_SEMANTIC_COMPARISON_CASES);
}

export function runSemanticComparisonCases(
  cases: readonly SemanticComparisonCase[],
): SemanticComparisonRunResult {
  const caseResults = cases.map((item) => evaluateSemanticComparisonCase(item));
  const tempEmbeddingEvaluation = runBuiltInTempSemanticEmbeddingEvaluation();
  const failedCaseIds = caseResults
    .filter((result) => !result.passed)
    .map((result) => result.caseId);

  return {
    total: caseResults.length,
    passed: caseResults.length - failedCaseIds.length,
    failed: failedCaseIds.length,
    failedCaseIds,
    falsePositiveCount: sumLengths(caseResults, "falsePositiveIds"),
    falseNegativeCount: sumLengths(caseResults, "falseNegativeIds"),
    acceptedOnlyViolationCount: sumLengths(
      caseResults,
      "acceptedOnlyViolationIds",
    ),
    zeroOverlapSemanticCandidateCount: sumLengths(
      caseResults,
      "zeroOverlapSemanticCandidateIds",
    ),
    deterministicInjectedCount: sumLengths(
      caseResults,
      "deterministicInjectedIds",
    ),
    semanticCandidateCount: sumLengths(caseResults, "semanticCandidateIds"),
    prototypeSemanticCandidateCount: sumLengths(
      caseResults,
      "prototypeSemanticCandidateIds",
    ),
    hybridCandidateCount: sumLengths(caseResults, "hybridCandidateIds"),
    prototypeRanCaseCount: caseResults.filter(
      (result) => result.prototypeSemanticProviderRan,
    ).length,
    prototypeTopKValues: uniqueNumbers(
      caseResults
        .filter((result) => result.prototypeSemanticProviderRan)
        .map((result) => result.prototypeTopK),
    ),
    prototypeCandidateCapValues: uniqueNumbers(
      caseResults
        .filter((result) => result.prototypeSemanticProviderRan)
        .map((result) => result.prototypeCandidateCap),
    ),
    prototypeSemanticProvider: "fixture-mock-local-embedding",
    tempEmbeddingProvider: tempEmbeddingEvaluation.providerId,
    tempEmbeddingProviderKind: tempEmbeddingEvaluation.providerKind,
    tempEmbeddingCandidateCount: tempEmbeddingEvaluation.candidateIds.length,
    tempEmbeddingIndexedAcceptedCount:
      tempEmbeddingEvaluation.indexedAcceptedCount,
    tempEmbeddingProviderCallCount: tempEmbeddingEvaluation.providerCallCount,
    providerCallCount: 0,
    categorySummaries: summarizeSemanticComparisonCategories(caseResults),
    caseResults,
    tempEmbeddingEvaluation,
  };
}

export function evaluateSemanticComparisonCase(
  item: SemanticComparisonCase,
): SemanticComparisonCaseResult {
  const acceptedRecords = item.acceptedMemories.map((memory) =>
    toMemoryRecord(memory, "accepted"),
  );
  const allRecords = [
    ...acceptedRecords,
    ...(item.nonAcceptedMemories ?? []).map((memory) =>
      toMemoryRecord(memory, memory.status ?? "proposal"),
    ),
  ];
  const retrieval = retrieveAcceptedMemoriesWithExplanation(
    allRecords,
    item.query,
  );
  const deterministicContext = buildModelContext(
    [{ role: "owner", content: item.query }],
    undefined,
    {
      memories: retrieval.snippets,
      explanations: retrieval.explanations,
    },
  );
  const deterministicTrace = toMemoryInjectionTrace(
    deterministicContext.stats.memoryInjectionExplanations,
    deterministicContext.stats.injectedMemoryIds,
    deterministicContext.stats.memoryContextCharacterCount,
  );
  const acceptedIds = new Set(acceptedRecords.map((memory) => memory.id));
  const prototypeGeneration = generatePrototypeCandidates(item);
  const explicitSemanticCandidateIds = uniqueIds(item.semanticCandidateIds);
  const prototypeSemanticCandidateIds =
    prototypeGeneration.prototypeSemanticCandidateIds;
  const safePrototypeSemanticCandidateIds =
    prototypeGeneration.safePrototypeSemanticCandidateIds;
  const semanticCandidateIds = uniqueIds([
    ...explicitSemanticCandidateIds,
    ...prototypeSemanticCandidateIds,
  ]);
  const acceptedOnlyViolationIds = semanticCandidateIds.filter(
    (candidateId) => !acceptedIds.has(candidateId),
  );
  const safeSemanticCandidateIds = semanticCandidateIds.filter((candidateId) =>
    acceptedIds.has(candidateId),
  );
  const deterministicInjectedIds = [...deterministicTrace.injectedMemoryIds];
  const hybridCandidateIds = uniqueIds([
    ...deterministicInjectedIds,
    ...safeSemanticCandidateIds,
  ]);
  const falsePositiveIds = hybridCandidateIds.filter(
    (candidateId) => !item.expectedInjectedIds.includes(candidateId),
  );
  const falseNegativeIds = item.expectedInjectedIds.filter(
    (expectedId) => !hybridCandidateIds.includes(expectedId),
  );
  const zeroOverlapSemanticCandidateIds = findZeroOverlapSemanticCandidateIds(
    item.query,
    acceptedRecords,
    safeSemanticCandidateIds,
  );
  const contextBudgetImpact = estimateContextBudgetImpact(
    item.query,
    acceptedRecords,
    deterministicTrace.memoryContextCharacterCount,
    deterministicInjectedIds,
    safeSemanticCandidateIds,
    hybridCandidateIds,
  );
  const privacyCheck = evaluatePrivacyCheck(item, {
    caseId: item.caseId,
    categories: item.categories ?? [],
    query: item.query,
    deterministicInjectedIds,
    explicitSemanticCandidateIds,
    prototypeSemanticCandidateIds,
    semanticCandidateIds,
    safeSemanticCandidateIds,
    hybridCandidateIds,
    semanticCandidateSourceBreakdown: {
      explicitFixtureAnnotationIds: explicitSemanticCandidateIds,
      fixtureEmbeddingPrototypeIds: prototypeSemanticCandidateIds,
    },
    expectedInjectedIds: item.expectedInjectedIds,
    falsePositiveIds,
    falseNegativeIds,
    acceptedOnlyViolationIds,
    zeroOverlapSemanticCandidateIds,
    providerCallCount: 0,
    prototypeSemanticProvider: prototypeGeneration.prototypeSemanticProvider,
    prototypeTopK: prototypeGeneration.topK,
    prototypeCandidateCap: prototypeGeneration.candidateCap,
    contextBudgetImpact,
    notes: item.notes ?? [],
  });
  const failureMessages = collectFailures(item, {
    deterministicInjectedIds,
    explicitSemanticCandidateIds,
    prototypeSemanticCandidateIds,
    safePrototypeSemanticCandidateIds,
    semanticCandidateIds,
    hybridCandidateIds,
    falsePositiveIds,
    falseNegativeIds,
    acceptedOnlyViolationIds,
    zeroOverlapSemanticCandidateIds,
    privacyCheck,
  });

  return {
    caseId: item.caseId,
    categories: [...(item.categories ?? [])],
    query: item.query,
    passed: failureMessages.length === 0,
    notes: [...(item.notes ?? [])],
    failureMessages,
    deterministicInjectedCount: deterministicInjectedIds.length,
    semanticCandidateCount: semanticCandidateIds.length,
    hybridCandidateCount: hybridCandidateIds.length,
    deterministicInjectedIds,
    explicitSemanticCandidateIds,
    prototypeSemanticCandidateIds,
    safePrototypeSemanticCandidateIds,
    nonAcceptedPrototypeCandidateIds:
      prototypeGeneration.nonAcceptedPrototypeCandidateIds,
    semanticCandidateIds,
    safeSemanticCandidateIds,
    hybridCandidateIds,
    semanticCandidateSourceBreakdown: {
      explicitFixtureAnnotationIds: explicitSemanticCandidateIds,
      fixtureEmbeddingPrototypeIds: prototypeSemanticCandidateIds,
    },
    expectedInjectedIds: [...item.expectedInjectedIds],
    falsePositiveIds,
    falseNegativeIds,
    acceptedOnlyViolationIds,
    acceptedOnlyPassed: acceptedOnlyViolationIds.length === 0,
    zeroOverlapSemanticCandidateIds,
    privacyPassed: privacyCheck.passed,
    privacyCheck,
    contextBudgetImpact,
    providerCallCount: 0,
    prototypeEmbeddingRequestCount: prototypeGeneration.embeddingRequestCount,
    prototypeSemanticProvider: prototypeGeneration.prototypeSemanticProvider,
    prototypeSemanticProviderRan: (item.prototypeQueryTerms ?? []).length > 0,
    prototypeTopK: prototypeGeneration.topK,
    prototypeCandidateCap: prototypeGeneration.candidateCap,
    semanticRuntimeId: "fixture-only",
    semanticModelId:
      (item.prototypeQueryTerms ?? []).length > 0
        ? "fixture-annotated-candidates+fixture-mock-local-embedding"
        : "fixture-annotated-candidates",
    indexImplementationId:
      (item.prototypeQueryTerms ?? []).length > 0
        ? "in-memory-fixture-vector-index"
        : "none-fixture-only",
  };
}

export function summarizeSemanticComparisonCategories(
  caseResults: readonly SemanticComparisonCaseResult[],
): SemanticComparisonCategorySummary[] {
  const summaries = new Map<
    SemanticComparisonCategory,
    SemanticComparisonCategorySummary
  >();

  for (const result of caseResults) {
    for (const category of result.categories) {
      const existing =
        summaries.get(category) ??
        {
          category,
          total: 0,
          passed: 0,
          failed: 0,
          failedCaseIds: [],
        };

      existing.total += 1;

      if (result.passed) {
        existing.passed += 1;
      } else {
        existing.failed += 1;
        existing.failedCaseIds.push(result.caseId);
      }

      summaries.set(category, existing);
    }
  }

  return [...summaries.values()].sort((left, right) =>
    left.category.localeCompare(right.category),
  );
}

function generatePrototypeCandidates(
  item: SemanticComparisonCase,
): FixtureSemanticCandidateGenerationResult {
  return generateFixtureSemanticCandidates({
    queryId: item.caseId,
    queryTerms: item.prototypeQueryTerms,
    memories: [
      ...item.acceptedMemories.map((memory) => ({
        id: memory.id,
        status: "accepted" as const,
        prototypeEmbeddingTerms: memory.prototypeEmbeddingTerms,
      })),
      ...(item.nonAcceptedMemories ?? []).map((memory) => ({
        id: memory.id,
        status: memory.status ?? "proposal",
        prototypeEmbeddingTerms: memory.prototypeEmbeddingTerms,
      })),
    ],
    topK: item.prototypeCandidateTopK,
    candidateCap: item.prototypeCandidateCap,
  });
}

export function formatSemanticComparisonSummary(
  result: SemanticComparisonRunResult,
): string {
  const lines = [
    "RIN semantic retrieval comparison evaluation.",
    "Mode: fixture-only, provider-free, report-only.",
    `Total: ${result.total}`,
    `Passed: ${result.passed}`,
    `Failed: ${result.failed}`,
    `providerCallCount: ${result.providerCallCount}`,
    `Prototype provider: ${result.prototypeSemanticProvider}`,
    `Prototype ran cases: ${result.prototypeRanCaseCount}`,
    `Prototype topK values: ${
      result.prototypeTopKValues.length > 0
        ? result.prototypeTopKValues.join(", ")
        : "none"
    }`,
    `Prototype candidate caps: ${
      result.prototypeCandidateCapValues.length > 0
        ? result.prototypeCandidateCapValues.join(", ")
        : "none"
    }`,
    `Temp embedding provider: ${result.tempEmbeddingProvider}`,
    `Temp embedding provider kind: ${result.tempEmbeddingProviderKind}`,
    `Temp embedding indexed accepted records: ${result.tempEmbeddingIndexedAcceptedCount}`,
    `Temp embedding candidates: ${result.tempEmbeddingCandidateCount}`,
    `Temp embedding providerCallCount: ${result.tempEmbeddingProviderCallCount}`,
    `Deterministic injected candidates: ${result.deterministicInjectedCount}`,
    `Semantic candidates: ${result.semanticCandidateCount}`,
    `Prototype semantic candidates: ${result.prototypeSemanticCandidateCount}`,
    `Hybrid candidates: ${result.hybridCandidateCount}`,
    `False positives: ${result.falsePositiveCount}`,
    `False negatives: ${result.falseNegativeCount}`,
    `Accepted-only violations detected: ${result.acceptedOnlyViolationCount}`,
    `Zero-overlap semantic candidates: ${result.zeroOverlapSemanticCandidateCount}`,
    `Failed case IDs: ${
      result.failedCaseIds.length > 0 ? result.failedCaseIds.join(", ") : "none"
    }`,
  ];

  if (result.categorySummaries.length > 0) {
    lines.push("Categories:");

    for (const summary of result.categorySummaries) {
      const failureSuffix =
        summary.failedCaseIds.length > 0
          ? `; failed IDs: ${summary.failedCaseIds.join(", ")}`
          : "";

      lines.push(
        `- ${summary.category}: ${summary.passed} passed / ${summary.failed} failed (${summary.total} total)${failureSuffix}`,
      );
    }
  } else {
    lines.push("Categories: none");
  }

  return lines.join("\n");
}

function collectFailures(
  item: SemanticComparisonCase,
  actual: {
    deterministicInjectedIds: readonly string[];
    explicitSemanticCandidateIds: readonly string[];
    prototypeSemanticCandidateIds: readonly string[];
    safePrototypeSemanticCandidateIds: readonly string[];
    semanticCandidateIds: readonly string[];
    hybridCandidateIds: readonly string[];
    falsePositiveIds: readonly string[];
    falseNegativeIds: readonly string[];
    acceptedOnlyViolationIds: readonly string[];
    zeroOverlapSemanticCandidateIds: readonly string[];
    privacyCheck: SemanticComparisonPrivacyCheck;
  },
): string[] {
  const failures: string[] = [];

  if (item.expectedDeterministicInjectedIds) {
    assertArrayEqual(
      failures,
      "deterministic injected ids",
      item.expectedDeterministicInjectedIds,
      actual.deterministicInjectedIds,
    );
  }

  assertArrayEqual(
    failures,
    "explicit semantic candidate ids",
    item.semanticCandidateIds,
    actual.explicitSemanticCandidateIds,
  );
  assertArrayEqual(
    failures,
    "prototype semantic candidate ids",
    item.expectedPrototypeSemanticCandidateIds ?? [],
    actual.prototypeSemanticCandidateIds,
  );
  assertArrayEqual(
    failures,
    "safe prototype semantic candidate ids",
    item.expectedSafePrototypeSemanticCandidateIds ?? [],
    actual.safePrototypeSemanticCandidateIds,
  );
  assertArrayEqual(
    failures,
    "semantic candidate ids",
    item.expectedSemanticCandidateIds ?? item.semanticCandidateIds,
    actual.semanticCandidateIds,
  );
  assertArrayEqual(
    failures,
    "hybrid candidate ids",
    item.expectedHybridCandidateIds ?? [
      ...actual.deterministicInjectedIds,
      ...actual.semanticCandidateIds,
    ],
    actual.hybridCandidateIds,
  );
  assertArrayEqual(
    failures,
    "false positive ids",
    item.expectedFalsePositiveIds ?? [],
    actual.falsePositiveIds,
  );
  assertArrayEqual(
    failures,
    "false negative ids",
    item.expectedFalseNegativeIds ?? [],
    actual.falseNegativeIds,
  );
  assertArrayEqual(
    failures,
    "accepted-only violation ids",
    item.expectedAcceptedOnlyViolationIds ?? [],
    actual.acceptedOnlyViolationIds,
  );
  assertArrayEqual(
    failures,
    "zero-overlap semantic candidate ids",
    item.expectedZeroOverlapSemanticCandidateIds ?? [],
    actual.zeroOverlapSemanticCandidateIds,
  );

  for (const violationId of actual.acceptedOnlyViolationIds) {
    if (actual.hybridCandidateIds.includes(violationId)) {
      failures.push(
        `Accepted-only violation ${violationId} appeared in hybrid candidate ids.`,
      );
    }
  }

  if (!actual.privacyCheck.passed) {
    failures.push(
      `Report privacy check failed; leaked memory text count=${actual.privacyCheck.leakedMemoryTextCount}.`,
    );
  }

  return failures;
}

function evaluatePrivacyCheck(
  item: SemanticComparisonCase,
  safeReport: Record<string, unknown>,
): SemanticComparisonPrivacyCheck {
  const reportJson = JSON.stringify(safeReport);
  let leakedMemoryTextCount = 0;

  for (const forbidden of item.expectedPrivacyForbiddenText ?? []) {
    if (reportJson.includes(forbidden)) {
      leakedMemoryTextCount += 1;
    }
  }

  return {
    passed: leakedMemoryTextCount === 0,
    leakedMemoryTextCount,
    leakedPromptTextCount: 0,
    leakedRawMetadataCount: 0,
  };
}

function estimateContextBudgetImpact(
  query: string,
  acceptedRecords: readonly MemoryRecord[],
  deterministicMemoryContextCharacters: number,
  deterministicInjectedIds: readonly string[],
  safeSemanticCandidateIds: readonly string[],
  hybridCandidateIds: readonly string[],
): SemanticComparisonContextBudgetImpact {
  const hybridContext = buildModelContext(
    [{ role: "owner", content: query }],
    undefined,
    {
      memories: snippetsForIds(acceptedRecords, hybridCandidateIds),
      maxInjectedMemories: hybridCandidateIds.length,
    },
  );

  return {
    deterministicMemoryContextCharacters,
    hybridMemoryContextCharacters:
      hybridContext.stats.memoryContextCharacterCount,
    characterDelta:
      hybridContext.stats.memoryContextCharacterCount -
      deterministicMemoryContextCharacters,
    wouldDropDeterministicIds: deterministicInjectedIds.filter(
      (memoryId) => !hybridCandidateIds.includes(memoryId),
    ),
    wouldAddSemanticIds: safeSemanticCandidateIds.filter(
      (memoryId) => !deterministicInjectedIds.includes(memoryId),
    ),
  };
}

function findZeroOverlapSemanticCandidateIds(
  query: string,
  acceptedRecords: readonly MemoryRecord[],
  safeSemanticCandidateIds: readonly string[],
): string[] {
  const queryProfile = buildRetrievalTokenProfile(query);
  const recordsById = new Map(acceptedRecords.map((memory) => [memory.id, memory]));

  return safeSemanticCandidateIds.filter((memoryId) => {
    const memory = recordsById.get(memoryId);

    if (!memory) {
      return false;
    }

    const snippet = memorySnippetText(memory.content);
    const memoryProfile = buildRetrievalTokenProfile(snippet);

    return scoreRetrievalOverlap(queryProfile, memoryProfile).overlapCount === 0;
  });
}

function snippetsForIds(
  records: readonly MemoryRecord[],
  ids: readonly string[],
): AcceptedMemorySnippet[] {
  const recordsById = new Map(records.map((memory) => [memory.id, memory]));

  return ids.flatMap((memoryId) => {
    const memory = recordsById.get(memoryId);

    if (!memory) {
      return [];
    }

    return [{ id: memoryId, text: memorySnippetText(memory.content) }];
  });
}

function toMemoryRecord(
  input: SemanticComparisonMemoryInput,
  status: MemoryStatus,
): MemoryRecord {
  const timestamp = input.updatedAt ?? DEFAULT_SEMANTIC_EVAL_NOW;

  return {
    id: input.id,
    memoryType: input.memoryType ?? "semantic",
    content: { text: input.text },
    metadata: {
      tags: [...(input.metadata?.tags ?? [])],
      importance: input.metadata?.importance ?? "normal",
      confidence: input.metadata?.confidence ?? "medium",
      source: input.metadata?.source ?? null,
      reviewedAt: null,
      acceptedAt: null,
    },
    sourceMessageId: null,
    status,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function sumLengths(
  results: readonly SemanticComparisonCaseResult[],
  key:
    | "deterministicInjectedIds"
    | "semanticCandidateIds"
    | "prototypeSemanticCandidateIds"
    | "hybridCandidateIds"
    | "falsePositiveIds"
    | "falseNegativeIds"
    | "acceptedOnlyViolationIds"
    | "zeroOverlapSemanticCandidateIds",
): number {
  return results.reduce((total, result) => total + result[key].length, 0);
}

function assertArrayEqual(
  failures: string[],
  label: string,
  expected: readonly string[],
  actual: readonly string[],
): void {
  const expectedSorted = [...expected].sort();
  const actualSorted = [...actual].sort();

  if (expectedSorted.length !== actualSorted.length) {
    failures.push(
      `Expected ${label} ${expectedSorted.join(",")}; actual=${actualSorted.join(",")}`,
    );
    return;
  }

  for (let index = 0; index < expectedSorted.length; index += 1) {
    if (expectedSorted[index] !== actualSorted[index]) {
      failures.push(
        `Expected ${label} ${expectedSorted.join(",")}; actual=${actualSorted.join(",")}`,
      );
      return;
    }
  }
}
