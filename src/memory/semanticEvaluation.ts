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
  deterministicInjectedIds: string[];
  semanticCandidateIds: string[];
  safeSemanticCandidateIds: string[];
  hybridCandidateIds: string[];
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
  semanticRuntimeId: "fixture-only";
  semanticModelId: "fixture-annotated-candidates";
  indexImplementationId: "none-fixture-only";
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
  providerCallCount: 0;
  categorySummaries: SemanticComparisonCategorySummary[];
  caseResults: SemanticComparisonCaseResult[];
};

const DEFAULT_SEMANTIC_EVAL_NOW = "2026-05-22T00:00:00.000Z";

export function runBuiltInSemanticComparisonEvaluation(): SemanticComparisonRunResult {
  return runSemanticComparisonCases(BUILT_IN_SEMANTIC_COMPARISON_CASES);
}

export function runSemanticComparisonCases(
  cases: readonly SemanticComparisonCase[],
): SemanticComparisonRunResult {
  const caseResults = cases.map((item) => evaluateSemanticComparisonCase(item));
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
    providerCallCount: 0,
    categorySummaries: summarizeSemanticComparisonCategories(caseResults),
    caseResults,
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
  const semanticCandidateIds = uniqueIds(item.semanticCandidateIds);
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
    semanticCandidateIds,
    safeSemanticCandidateIds,
    hybridCandidateIds,
    expectedInjectedIds: item.expectedInjectedIds,
    falsePositiveIds,
    falseNegativeIds,
    acceptedOnlyViolationIds,
    zeroOverlapSemanticCandidateIds,
    providerCallCount: 0,
    contextBudgetImpact,
    notes: item.notes ?? [],
  });
  const failureMessages = collectFailures(item, {
    deterministicInjectedIds,
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
    deterministicInjectedIds,
    semanticCandidateIds,
    safeSemanticCandidateIds,
    hybridCandidateIds,
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
    semanticRuntimeId: "fixture-only",
    semanticModelId: "fixture-annotated-candidates",
    indexImplementationId: "none-fixture-only",
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

function sumLengths(
  results: readonly SemanticComparisonCaseResult[],
  key:
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
