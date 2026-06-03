import type { MemoryRecord } from "./manager";
import {
  runSemanticAcceptedMemoryIndexReport,
  type SemanticAcceptedMemoryIndexReport,
} from "./semanticAcceptedMemoryIndex";
import { retrieveAcceptedMemoriesWithExplanation } from "./retrieval";

export type HybridRetrievalReportStatus =
  | "disabled"
  | "ready"
  | "invalid_request";

export type HybridRetrievalReport = {
  mode: "hybrid-retrieval-candidate-report";
  status: HybridRetrievalReportStatus;
  enabled: boolean;
  optInSatisfied: boolean;
  deterministicCandidateIds: string[];
  semanticCandidateIds: string[];
  hybridCandidateIds: string[];
  semanticOnlyCandidateIds: string[];
  deterministicOnlyCandidateIds: string[];
  overlapCandidateIds: string[];
  acceptedOnlyViolationIds: string[];
  falsePositiveIds: string[];
  falseNegativeIds: string[];
  contextInjectionEnabled: false;
  productionIntegrationEnabled: false;
  fullTextIncluded: false;
  providerCallCount: number;
  errorCode: string | null;
  semanticIndexReport: SemanticAcceptedMemoryIndexReport | null;
};

export type HybridRetrievalReportOptions = {
  optIn: boolean;
  queryText?: string;
  memories?: readonly MemoryRecord[];
  loadMemories?: () => readonly MemoryRecord[] | Promise<readonly MemoryRecord[]>;
  semanticCandidateIds?: readonly string[];
  expectedCandidateIds?: readonly string[];
  topK?: number;
  candidateCap?: number;
};

export async function runHybridRetrievalReport(
  options: HybridRetrievalReportOptions,
): Promise<HybridRetrievalReport> {
  if (!options.optIn) {
    return {
      ...baseHybridRetrievalReport(),
      status: "disabled",
      enabled: false,
      optInSatisfied: false,
      errorCode: "HYBRID_RETRIEVAL_DISABLED",
    };
  }

  if (!options.queryText || options.queryText.trim().length === 0) {
    return {
      ...baseHybridRetrievalReport(),
      status: "invalid_request",
      enabled: true,
      optInSatisfied: true,
      errorCode: "HYBRID_RETRIEVAL_QUERY_REQUIRED",
    };
  }

  const memories = [
    ...(options.memories ?? (options.loadMemories ? await options.loadMemories() : [])),
  ];
  const acceptedIds = new Set(
    memories.filter((memory) => memory.status === "accepted").map((memory) => memory.id),
  );
  const deterministicCandidateIds = retrieveAcceptedMemoriesWithExplanation(
    memories,
    options.queryText,
  ).snippets.map((snippet) => snippet.id);
  const semanticIndexReport = options.semanticCandidateIds
    ? null
    : await runSemanticAcceptedMemoryIndexReport({
        optIn: true,
        queryText: options.queryText,
        memories,
        topK: options.topK,
        candidateCap: options.candidateCap,
      });
  const rawSemanticCandidateIds = uniqueIds(
    options.semanticCandidateIds ?? semanticIndexReport?.candidateIds ?? [],
  );
  const acceptedOnlyViolationIds = rawSemanticCandidateIds.filter(
    (candidateId) => !acceptedIds.has(candidateId),
  );
  const semanticCandidateIds = rawSemanticCandidateIds.filter((candidateId) =>
    acceptedIds.has(candidateId),
  );
  const hybridCandidateIds = uniqueIds([
    ...deterministicCandidateIds,
    ...semanticCandidateIds,
  ]);
  const expectedIds = options.expectedCandidateIds ?? [];

  return {
    ...baseHybridRetrievalReport(),
    status: "ready",
    enabled: true,
    optInSatisfied: true,
    deterministicCandidateIds,
    semanticCandidateIds,
    hybridCandidateIds,
    semanticOnlyCandidateIds: semanticCandidateIds.filter(
      (candidateId) => !deterministicCandidateIds.includes(candidateId),
    ),
    deterministicOnlyCandidateIds: deterministicCandidateIds.filter(
      (candidateId) => !semanticCandidateIds.includes(candidateId),
    ),
    overlapCandidateIds: deterministicCandidateIds.filter((candidateId) =>
      semanticCandidateIds.includes(candidateId),
    ),
    acceptedOnlyViolationIds,
    falsePositiveIds:
      expectedIds.length > 0
        ? hybridCandidateIds.filter((candidateId) => !expectedIds.includes(candidateId))
        : [],
    falseNegativeIds:
      expectedIds.length > 0
        ? expectedIds.filter((candidateId) => !hybridCandidateIds.includes(candidateId))
        : [],
    providerCallCount: semanticIndexReport?.providerCallCount ?? 0,
    semanticIndexReport,
  };
}

export function formatHybridRetrievalReport(report: HybridRetrievalReport): string {
  return [
    "RIN hybrid retrieval candidate report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Enabled: ${report.enabled ? "yes" : "no"}`,
    `Opt-in satisfied: ${report.optInSatisfied ? "yes" : "no"}`,
    `Deterministic candidate IDs: ${formatIds(report.deterministicCandidateIds)}`,
    `Semantic candidate IDs: ${formatIds(report.semanticCandidateIds)}`,
    `Hybrid candidate IDs: ${formatIds(report.hybridCandidateIds)}`,
    `Semantic-only candidate IDs: ${formatIds(report.semanticOnlyCandidateIds)}`,
    `Deterministic-only candidate IDs: ${formatIds(
      report.deterministicOnlyCandidateIds,
    )}`,
    `Overlap candidate IDs: ${formatIds(report.overlapCandidateIds)}`,
    `Accepted-only violation IDs: ${formatIds(report.acceptedOnlyViolationIds)}`,
    `False positive IDs: ${formatIds(report.falsePositiveIds)}`,
    `False negative IDs: ${formatIds(report.falseNegativeIds)}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Error code: ${report.errorCode ?? "none"}`,
    `Production integration enabled: ${
      report.productionIntegrationEnabled ? "yes" : "no"
    }`,
    `Context injection enabled: ${report.contextInjectionEnabled ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
  ].join("\n");
}

function baseHybridRetrievalReport(): HybridRetrievalReport {
  return {
    mode: "hybrid-retrieval-candidate-report",
    status: "disabled",
    enabled: false,
    optInSatisfied: false,
    deterministicCandidateIds: [],
    semanticCandidateIds: [],
    hybridCandidateIds: [],
    semanticOnlyCandidateIds: [],
    deterministicOnlyCandidateIds: [],
    overlapCandidateIds: [],
    acceptedOnlyViolationIds: [],
    falsePositiveIds: [],
    falseNegativeIds: [],
    contextInjectionEnabled: false,
    productionIntegrationEnabled: false,
    fullTextIncluded: false,
    providerCallCount: 0,
    errorCode: null,
    semanticIndexReport: null,
  };
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function formatIds(ids: readonly string[]): string {
  return ids.length > 0 ? ids.join(", ") : "none";
}
