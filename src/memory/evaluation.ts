import { buildModelContext } from "../context";
import type { MemoryRecord, MemoryStatus } from "./manager";
import {
  retrieveAcceptedMemoriesWithExplanation,
  toMemoryInjectionTrace,
  type MemoryInjectionTrace,
  type MemoryRetrievalOptions,
  type MemorySkipReason,
} from "./retrieval";
import {
  BUILT_IN_MEMORY_EVALUATION_CASES,
  type MemoryEvaluationCase,
  type MemoryEvaluationCategory,
  type MemoryEvaluationMemoryInput,
} from "./evaluationFixtures";

export type MemoryEvaluationFailure = {
  caseId: string;
  message: string;
};

export type MemoryEvaluationCaseResult = {
  caseId: string;
  categories: MemoryEvaluationCategory[];
  passed: boolean;
  failures: string[];
  injectedIds: string[];
  expectedInjectedIds: string[];
  matchedTokensByMemoryId: Record<string, string[]>;
  matchedTypeSignalsByMemoryId: Record<string, string[]>;
  typeMatchBonusesByMemoryId: Record<string, number>;
  matchedTagsByMemoryId: Record<string, string[]>;
  tagMatchBonusesByMemoryId: Record<string, number>;
  importanceBonusesByMemoryId: Record<string, number>;
  confidenceAdjustmentsByMemoryId: Record<string, number>;
  metadataBonusesByMemoryId: Record<string, number>;
  metadataSignalsByMemoryId: Record<string, string[]>;
  skipReasonsByMemoryId: Record<string, MemorySkipReason | null>;
  privacyPassed: boolean;
  trace: MemoryInjectionTrace;
};

export type MemoryEvaluationCategorySummary = {
  category: MemoryEvaluationCategory;
  total: number;
  passed: number;
  failed: number;
  failedCaseIds: string[];
};

export type MemoryEvaluationRunResult = {
  total: number;
  passed: number;
  failed: number;
  failedCaseIds: string[];
  providerCallCount: 0;
  categorySummaries: MemoryEvaluationCategorySummary[];
  caseResults: MemoryEvaluationCaseResult[];
};

const DEFAULT_EVAL_NOW = "2026-05-19T00:00:00.000Z";

export function runBuiltInMemoryEvaluation(): MemoryEvaluationRunResult {
  return runMemoryEvaluationCases(BUILT_IN_MEMORY_EVALUATION_CASES);
}

export function runMemoryEvaluationCases(
  cases: readonly MemoryEvaluationCase[],
): MemoryEvaluationRunResult {
  const caseResults = cases.map((item) => evaluateMemoryCase(item));
  const failedCaseIds = caseResults
    .filter((result) => !result.passed)
    .map((result) => result.caseId);

  return {
    total: caseResults.length,
    passed: caseResults.length - failedCaseIds.length,
    failed: failedCaseIds.length,
    failedCaseIds,
    providerCallCount: 0,
    categorySummaries: summarizeMemoryEvaluationCategories(caseResults),
    caseResults,
  };
}

export function evaluateMemoryCase(
  item: MemoryEvaluationCase,
): MemoryEvaluationCaseResult {
  const memories = [
    ...item.acceptedMemories.map((memory) => toMemoryRecord(memory, "accepted")),
    ...(item.nonAcceptedMemories ?? []).map((memory) =>
      toMemoryRecord(memory, memory.status ?? "proposal"),
    ),
  ];
  const retrievalOptions: MemoryRetrievalOptions = {
    maxInjectedMemories: item.maxInjectedMemories,
  };
  const retrieval = retrieveAcceptedMemoriesWithExplanation(
    memories,
    item.query,
    retrievalOptions,
  );
  const context = buildModelContext(
    [{ role: "owner", content: item.query }],
    undefined,
    {
      memories: retrieval.snippets,
      explanations: retrieval.explanations,
      maxInjectedMemories: item.maxInjectedMemories,
      maxMemoryContextCharacters: item.maxMemoryContextCharacters,
    },
  );
  const trace = toMemoryInjectionTrace(
    context.stats.memoryInjectionExplanations,
    context.stats.injectedMemoryIds,
    context.stats.memoryContextCharacterCount,
  );
  const failures: string[] = [];
  const injectedIds = trace.injectedMemoryIds;
  const matchedTokensByMemoryId = Object.fromEntries(
    trace.items.map((traceItem) => [traceItem.memoryId, traceItem.matchedKeywords]),
  );
  const matchedTypeSignalsByMemoryId = Object.fromEntries(
    trace.items.map((traceItem) => [
      traceItem.memoryId,
      traceItem.matchedTypeSignals,
    ]),
  );
  const typeMatchBonusesByMemoryId = Object.fromEntries(
    trace.items.map((traceItem) => [
      traceItem.memoryId,
      traceItem.typeMatchBonus,
    ]),
  );
  const matchedTagsByMemoryId = Object.fromEntries(
    trace.items.map((traceItem) => [traceItem.memoryId, traceItem.matchedTags]),
  );
  const tagMatchBonusesByMemoryId = Object.fromEntries(
    trace.items.map((traceItem) => [
      traceItem.memoryId,
      traceItem.tagMatchBonus,
    ]),
  );
  const importanceBonusesByMemoryId = Object.fromEntries(
    trace.items.map((traceItem) => [
      traceItem.memoryId,
      traceItem.importanceBonus,
    ]),
  );
  const confidenceAdjustmentsByMemoryId = Object.fromEntries(
    trace.items.map((traceItem) => [
      traceItem.memoryId,
      traceItem.confidenceAdjustment,
    ]),
  );
  const metadataBonusesByMemoryId = Object.fromEntries(
    trace.items.map((traceItem) => [
      traceItem.memoryId,
      traceItem.metadataBonus,
    ]),
  );
  const metadataSignalsByMemoryId = Object.fromEntries(
    trace.items.map((traceItem) => [
      traceItem.memoryId,
      traceItem.metadataSignals,
    ]),
  );
  const skipReasonsByMemoryId = Object.fromEntries(
    trace.items.map((traceItem) => [traceItem.memoryId, traceItem.skippedReason]),
  );

  assertArrayEqual(
    failures,
    "injected ids",
    item.expectedInjectedIds,
    injectedIds,
  );

  for (const memoryId of item.expectedNotInjectedIds ?? []) {
    if (injectedIds.includes(memoryId)) {
      failures.push(`Expected ${memoryId} not to be injected.`);
    }
  }

  for (const [memoryId, expectedTokens] of Object.entries(
    item.expectedMatchedTokens ?? {},
  )) {
    const actualTokens = matchedTokensByMemoryId[memoryId] ?? [];
    for (const token of expectedTokens) {
      if (!actualTokens.includes(token)) {
        failures.push(
          `Expected ${memoryId} matched tokens to include ${token}; actual=${actualTokens.join(",")}`,
        );
      }
    }
  }

  for (const [memoryId, expectedSignals] of Object.entries(
    item.expectedMatchedTypeSignals ?? {},
  )) {
    const actualSignals = matchedTypeSignalsByMemoryId[memoryId] ?? [];
    for (const signal of expectedSignals) {
      if (!actualSignals.includes(signal)) {
        failures.push(
          `Expected ${memoryId} matched type signals to include ${signal}; actual=${actualSignals.join(",")}`,
        );
      }
    }
  }

  for (const [memoryId, expectedBonus] of Object.entries(
    item.expectedTypeMatchBonuses ?? {},
  )) {
    const actualBonus = typeMatchBonusesByMemoryId[memoryId];
    if (actualBonus !== expectedBonus) {
      failures.push(
        `Expected ${memoryId} type match bonus ${expectedBonus}; actual=${actualBonus ?? "missing"}`,
      );
    }
  }

  for (const [memoryId, expectedTags] of Object.entries(
    item.expectedMatchedTags ?? {},
  )) {
    const actualTags = matchedTagsByMemoryId[memoryId] ?? [];
    for (const tag of expectedTags) {
      if (!actualTags.includes(tag)) {
        failures.push(
          `Expected ${memoryId} matched tags to include ${tag}; actual=${actualTags.join(",")}`,
        );
      }
    }
  }

  for (const [memoryId, expectedBonus] of Object.entries(
    item.expectedTagMatchBonuses ?? {},
  )) {
    const actualBonus = tagMatchBonusesByMemoryId[memoryId];
    if (actualBonus !== expectedBonus) {
      failures.push(
        `Expected ${memoryId} tag match bonus ${expectedBonus}; actual=${actualBonus ?? "missing"}`,
      );
    }
  }

  for (const [memoryId, expectedBonus] of Object.entries(
    item.expectedImportanceBonuses ?? {},
  )) {
    const actualBonus = importanceBonusesByMemoryId[memoryId];
    if (actualBonus !== expectedBonus) {
      failures.push(
        `Expected ${memoryId} importance bonus ${expectedBonus}; actual=${actualBonus ?? "missing"}`,
      );
    }
  }

  for (const [memoryId, expectedAdjustment] of Object.entries(
    item.expectedConfidenceAdjustments ?? {},
  )) {
    const actualAdjustment = confidenceAdjustmentsByMemoryId[memoryId];
    if (actualAdjustment !== expectedAdjustment) {
      failures.push(
        `Expected ${memoryId} confidence adjustment ${expectedAdjustment}; actual=${actualAdjustment ?? "missing"}`,
      );
    }
  }

  for (const [memoryId, expectedBonus] of Object.entries(
    item.expectedMetadataBonuses ?? {},
  )) {
    const actualBonus = metadataBonusesByMemoryId[memoryId];
    if (actualBonus !== expectedBonus) {
      failures.push(
        `Expected ${memoryId} metadata bonus ${expectedBonus}; actual=${actualBonus ?? "missing"}`,
      );
    }
  }

  for (const [memoryId, expectedSignals] of Object.entries(
    item.expectedMetadataSignals ?? {},
  )) {
    const actualSignals = metadataSignalsByMemoryId[memoryId] ?? [];
    for (const signal of expectedSignals) {
      if (!actualSignals.includes(signal)) {
        failures.push(
          `Expected ${memoryId} metadata signals to include ${signal}; actual=${actualSignals.join(",")}`,
        );
      }
    }
  }

  for (const [memoryId, expectedReason] of Object.entries(
    item.expectedSkipReasons ?? {},
  )) {
    const actualReason = skipReasonsByMemoryId[memoryId];
    if (actualReason !== expectedReason) {
      failures.push(
        `Expected ${memoryId} skip reason ${expectedReason}; actual=${actualReason ?? "missing"}`,
      );
    }
  }

  if (item.maxInjectedMemories !== undefined && injectedIds.length > item.maxInjectedMemories) {
    failures.push(
      `Injected ${injectedIds.length} memories, exceeding max ${item.maxInjectedMemories}.`,
    );
  }

  if (
    item.maxMemoryContextCharacters !== undefined &&
    trace.memoryContextCharacterCount > item.maxMemoryContextCharacters
  ) {
    failures.push(
      `Memory context character count ${trace.memoryContextCharacterCount} exceeds max ${item.maxMemoryContextCharacters}.`,
    );
  }

  const traceJson = JSON.stringify(trace);
  for (const [index, forbidden] of (
    item.expectedPrivacyForbiddenText ?? []
  ).entries()) {
    if (traceJson.includes(forbidden)) {
      failures.push(`Trace leaked forbidden memory text entry ${index + 1}.`);
    }
  }

  const privacyPassed = !failures.some((failure) =>
    failure.startsWith("Trace leaked forbidden memory text"),
  );

  return {
    caseId: item.caseId,
    categories: [...(item.categories ?? [])],
    passed: failures.length === 0,
    failures,
    injectedIds,
    expectedInjectedIds: item.expectedInjectedIds,
    matchedTokensByMemoryId,
    matchedTypeSignalsByMemoryId,
    typeMatchBonusesByMemoryId,
    matchedTagsByMemoryId,
    tagMatchBonusesByMemoryId,
    importanceBonusesByMemoryId,
    confidenceAdjustmentsByMemoryId,
    metadataBonusesByMemoryId,
    metadataSignalsByMemoryId,
    skipReasonsByMemoryId,
    privacyPassed,
    trace,
  };
}

export function summarizeMemoryEvaluationCategories(
  caseResults: readonly MemoryEvaluationCaseResult[],
): MemoryEvaluationCategorySummary[] {
  const summaries = new Map<MemoryEvaluationCategory, MemoryEvaluationCategorySummary>();

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

export function formatMemoryEvaluationSummary(
  result: MemoryEvaluationRunResult,
): string {
  const lines = [
    "RIN memory injection evaluation.",
    `Total: ${result.total}`,
    `Passed: ${result.passed}`,
    `Failed: ${result.failed}`,
    `providerCallCount: ${result.providerCallCount}`,
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

function toMemoryRecord(
  input: MemoryEvaluationMemoryInput,
  status: MemoryStatus,
): MemoryRecord {
  const timestamp = input.updatedAt ?? DEFAULT_EVAL_NOW;

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
