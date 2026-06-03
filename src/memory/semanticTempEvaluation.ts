import type { MemoryStatus } from "./manager";
import {
  createFixtureSemanticEmbeddingProvider,
  FIXTURE_SEMANTIC_EMBEDDING_PROVIDER_ID,
  type SemanticEmbeddingProvider,
  type SemanticEmbeddingProviderKind,
} from "./semanticEmbedding";
import { createInMemoryVectorIndex } from "./vectorIndex";

export type TempSemanticEmbeddingRecord = {
  id: string;
  status?: MemoryStatus;
  embeddingTerms: readonly string[];
};

export type TempSemanticEmbeddingEvaluationOptions = {
  queryId: string;
  queryTerms: readonly string[];
  records: readonly TempSemanticEmbeddingRecord[];
  provider?: SemanticEmbeddingProvider;
  topK?: number;
  candidateCap?: number;
};

export type TempSemanticEmbeddingEvaluationResult = {
  mode: "temp-fixture-report-only";
  providerId: string;
  providerKind: SemanticEmbeddingProviderKind;
  providerCallCount: number;
  providerCallCountByProviderKind: Record<string, number>;
  embeddingRequestCount: number;
  indexedAcceptedCount: number;
  excludedNonAcceptedIds: string[];
  candidateIds: string[];
  topK: number;
  candidateCap: number;
  privacyPassed: boolean;
};

const DEFAULT_TOP_K = 3;

export function runBuiltInTempSemanticEmbeddingEvaluation(): TempSemanticEmbeddingEvaluationResult {
  return runTempSemanticEmbeddingEvaluation({
    queryId: "temp-query-report-only",
    queryTerms: ["semantic-readiness", "local-provider"],
    records: [
      {
        id: "temp-local-provider-boundary",
        status: "accepted",
        embeddingTerms: ["semantic-readiness", "local-provider"],
      },
      {
        id: "temp-semantic-index-lifecycle",
        status: "accepted",
        embeddingTerms: ["semantic-readiness", "index-lifecycle"],
      },
      {
        id: "temp-pending-provider-boundary",
        status: "proposal",
        embeddingTerms: ["semantic-readiness", "local-provider"],
      },
    ],
    topK: 2,
    candidateCap: 2,
  });
}

export function runTempSemanticEmbeddingEvaluation(
  options: TempSemanticEmbeddingEvaluationOptions,
): TempSemanticEmbeddingEvaluationResult {
  const provider = options.provider ?? createFixtureSemanticEmbeddingProvider();
  const topK = Math.max(0, options.topK ?? DEFAULT_TOP_K);
  const candidateCap = Math.max(0, options.candidateCap ?? topK);
  const acceptedRecords = options.records.filter(
    (record) => (record.status ?? "accepted") === "accepted",
  );
  const excludedNonAcceptedIds = options.records
    .filter((record) => (record.status ?? "accepted") !== "accepted")
    .map((record) => record.id)
    .sort();

  if (options.queryTerms.length === 0 || topK === 0 || candidateCap === 0) {
    return {
      mode: "temp-fixture-report-only",
      providerId: provider.providerId,
      providerKind: provider.providerKind,
      providerCallCount: 0,
      providerCallCountByProviderKind: { [provider.providerKind]: 0 },
      embeddingRequestCount: 0,
      indexedAcceptedCount: acceptedRecords.length,
      excludedNonAcceptedIds,
      candidateIds: [],
      topK,
      candidateCap,
      privacyPassed: true,
    };
  }

  const queryEmbedding = provider.embed({
    id: options.queryId,
    terms: options.queryTerms,
  });
  const indexedEntries = acceptedRecords.map((record) => ({
    id: record.id,
    vector: provider.embed({
      id: record.id,
      terms: record.embeddingTerms,
    }).vector,
  }));
  const index = createInMemoryVectorIndex(indexedEntries);
  const candidateIds = index
    .query(queryEmbedding.vector, { topK, candidateCap })
    .map((match) => match.id);

  return {
    mode: "temp-fixture-report-only",
    providerId: provider.providerId,
    providerKind: provider.providerKind,
    providerCallCount: 0,
    providerCallCountByProviderKind: { [provider.providerKind]: 0 },
    embeddingRequestCount: 1 + indexedEntries.length,
    indexedAcceptedCount: acceptedRecords.length,
    excludedNonAcceptedIds,
    candidateIds,
    topK,
    candidateCap,
    privacyPassed: true,
  };
}

export function formatTempSemanticEmbeddingEvaluationSummary(
  result: TempSemanticEmbeddingEvaluationResult,
): string {
  return [
    "Temp semantic embedding evaluation.",
    `Mode: ${result.mode}`,
    `Provider: ${result.providerId}`,
    `Provider kind: ${result.providerKind}`,
    `providerCallCount: ${result.providerCallCount}`,
    `Embedding requests: ${result.embeddingRequestCount}`,
    `Indexed accepted records: ${result.indexedAcceptedCount}`,
    `Excluded non-accepted IDs: ${formatIds(result.excludedNonAcceptedIds)}`,
    `Candidate IDs: ${formatIds(result.candidateIds)}`,
    `topK: ${result.topK}`,
    `candidateCap: ${result.candidateCap}`,
    `Privacy passed: ${result.privacyPassed ? "yes" : "no"}`,
  ].join("\n");
}

export function isDefaultTempSemanticProvider(
  result: TempSemanticEmbeddingEvaluationResult,
): boolean {
  return result.providerId === FIXTURE_SEMANTIC_EMBEDDING_PROVIDER_ID;
}

function formatIds(ids: readonly string[]): string {
  return ids.length > 0 ? ids.join(", ") : "none";
}
