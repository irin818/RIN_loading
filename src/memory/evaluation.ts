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
  type MemoryEvaluationMemoryInput,
} from "./evaluationFixtures";

export type MemoryEvaluationFailure = {
  caseId: string;
  message: string;
};

export type MemoryEvaluationCaseResult = {
  caseId: string;
  passed: boolean;
  failures: string[];
  injectedIds: string[];
  expectedInjectedIds: string[];
  matchedTokensByMemoryId: Record<string, string[]>;
  matchedTypeSignalsByMemoryId: Record<string, string[]>;
  typeMatchBonusesByMemoryId: Record<string, number>;
  skipReasonsByMemoryId: Record<string, MemorySkipReason | null>;
  privacyPassed: boolean;
  trace: MemoryInjectionTrace;
};

export type MemoryEvaluationRunResult = {
  total: number;
  passed: number;
  failed: number;
  failedCaseIds: string[];
  providerCallCount: 0;
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
  for (const forbidden of item.expectedPrivacyForbiddenText ?? []) {
    if (traceJson.includes(forbidden)) {
      failures.push(`Trace leaked forbidden memory text: ${forbidden}`);
    }
  }

  const privacyPassed = !failures.some((failure) =>
    failure.startsWith("Trace leaked forbidden memory text:"),
  );

  return {
    caseId: item.caseId,
    passed: failures.length === 0,
    failures,
    injectedIds,
    expectedInjectedIds: item.expectedInjectedIds,
    matchedTokensByMemoryId,
    matchedTypeSignalsByMemoryId,
    typeMatchBonusesByMemoryId,
    skipReasonsByMemoryId,
    privacyPassed,
    trace,
  };
}

export function formatMemoryEvaluationSummary(
  result: MemoryEvaluationRunResult,
): string {
  const lines = [
    "RIN memory injection evaluation.",
    `Total: ${result.total}`,
    `Passed: ${result.passed}`,
    `Failed: ${result.failed}`,
  ];

  if (result.failedCaseIds.length > 0) {
    lines.push(`Failed case IDs: ${result.failedCaseIds.join(", ")}`);
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
