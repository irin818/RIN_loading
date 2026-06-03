import type { MemoryRecord } from "./manager";
import { memorySnippetText, retrieveAcceptedMemoriesWithExplanation } from "./retrieval";
import { buildRetrievalTokenProfile } from "./retrievalTokens";
import {
  createFixtureSemanticEmbeddingProvider,
  createOllamaLocalEmbeddingProvider,
  evaluateLocalEmbeddingProviderReadiness,
  type LocalEmbeddingErrorCode,
  type LocalEmbeddingProvider,
  type LocalEmbeddingProviderConfig,
  type SemanticEmbeddingProvider,
  type SemanticEmbeddingProviderKind,
} from "./semanticEmbedding";
import { createInMemoryVectorIndex } from "./vectorIndex";

export type SemanticAcceptedMemoryIndexProviderMode =
  | "disabled"
  | "fixture-mock"
  | "live-local";

export type SemanticAcceptedMemoryIndexStatus =
  | "disabled"
  | "ready"
  | "no_accepted_memories"
  | "provider_unavailable"
  | "invalid_request";

export type SemanticAcceptedMemoryIndexReport = {
  mode: "accepted-memory-semantic-index-report";
  status: SemanticAcceptedMemoryIndexStatus;
  enabled: boolean;
  optInSatisfied: boolean;
  providerId: string | null;
  providerMode: SemanticAcceptedMemoryIndexProviderMode;
  providerKind: SemanticEmbeddingProviderKind | null;
  modelId: string | null;
  indexedAcceptedMemoryCount: number;
  skippedNonAcceptedCount: number;
  skippedNonAcceptedIds: string[];
  candidateIds: string[];
  topK: number;
  candidateCap: number;
  embeddingRequestCount: number;
  providerCallCount: number;
  errorCode: LocalEmbeddingErrorCode | null;
  productionIntegrationEnabled: false;
  contextInjectionEnabled: false;
  fullTextIncluded: false;
};

export type SemanticAcceptedMemoryIndexOptions = {
  optIn: boolean;
  queryTerms?: readonly string[];
  queryText?: string;
  memories?: readonly MemoryRecord[];
  loadMemories?: () => readonly MemoryRecord[] | Promise<readonly MemoryRecord[]>;
  provider?: SemanticEmbeddingProvider;
  localProvider?: LocalEmbeddingProvider;
  localProviderConfig?: LocalEmbeddingProviderConfig;
  providerMode?: Exclude<SemanticAcceptedMemoryIndexProviderMode, "disabled">;
  topK?: number;
  candidateCap?: number;
};

const DEFAULT_TOP_K = 5;

export async function runSemanticAcceptedMemoryIndexReport(
  options: SemanticAcceptedMemoryIndexOptions,
): Promise<SemanticAcceptedMemoryIndexReport> {
  const topK = Math.max(0, options.topK ?? DEFAULT_TOP_K);
  const candidateCap = Math.max(0, options.candidateCap ?? topK);

  if (!options.optIn) {
    return disabledAcceptedMemoryIndexReport({
      topK,
      candidateCap,
      errorCode: "LOCAL_EMBEDDING_DISABLED",
    });
  }

  const memories = [
    ...(options.memories ?? (options.loadMemories ? await options.loadMemories() : [])),
  ];
  const acceptedMemories = memories.filter((memory) => memory.status === "accepted");
  const skippedNonAcceptedIds = memories
    .filter((memory) => memory.status !== "accepted")
    .map((memory) => memory.id)
    .sort();

  if (acceptedMemories.length === 0) {
    return {
      ...baseAcceptedMemoryIndexReport({ topK, candidateCap }),
      status: "no_accepted_memories",
      enabled: true,
      optInSatisfied: true,
      providerMode: options.providerMode ?? "fixture-mock",
      skippedNonAcceptedCount: skippedNonAcceptedIds.length,
      skippedNonAcceptedIds,
    };
  }

  const queryTerms = normalizedQueryTerms(options);

  if (queryTerms.length === 0 || topK === 0 || candidateCap === 0) {
    return {
      ...baseAcceptedMemoryIndexReport({ topK, candidateCap }),
      status: "invalid_request",
      enabled: true,
      optInSatisfied: true,
      providerMode: options.providerMode ?? "fixture-mock",
      indexedAcceptedMemoryCount: acceptedMemories.length,
      skippedNonAcceptedCount: skippedNonAcceptedIds.length,
      skippedNonAcceptedIds,
    };
  }

  if (options.providerMode === "live-local" || options.localProvider) {
    return runLiveLocalAcceptedMemoryIndexReport({
      acceptedMemories,
      skippedNonAcceptedIds,
      queryTerms,
      topK,
      candidateCap,
      localProvider: options.localProvider,
      localProviderConfig: options.localProviderConfig,
    });
  }

  return runFixtureAcceptedMemoryIndexReport({
    acceptedMemories,
    skippedNonAcceptedIds,
    queryTerms,
    topK,
    candidateCap,
    provider: options.provider ?? createFixtureSemanticEmbeddingProvider(),
  });
}

export function formatSemanticAcceptedMemoryIndexReport(
  report: SemanticAcceptedMemoryIndexReport,
): string {
  return [
    "RIN semantic accepted-memory index report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Enabled: ${report.enabled ? "yes" : "no"}`,
    `Opt-in satisfied: ${report.optInSatisfied ? "yes" : "no"}`,
    `Provider: ${report.providerId ?? "none"}`,
    `Provider mode: ${report.providerMode}`,
    `Provider kind: ${report.providerKind ?? "none"}`,
    `Model id: ${report.modelId ?? "none"}`,
    `Indexed accepted memories: ${report.indexedAcceptedMemoryCount}`,
    `Skipped non-accepted memories: ${report.skippedNonAcceptedCount}`,
    `Skipped non-accepted IDs: ${formatIds(report.skippedNonAcceptedIds)}`,
    `Candidate IDs: ${formatIds(report.candidateIds)}`,
    `topK: ${report.topK}`,
    `candidateCap: ${report.candidateCap}`,
    `Embedding requests: ${report.embeddingRequestCount}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Error code: ${report.errorCode ?? "none"}`,
    `Production integration enabled: ${
      report.productionIntegrationEnabled ? "yes" : "no"
    }`,
    `Context injection enabled: ${report.contextInjectionEnabled ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
  ].join("\n");
}

function runFixtureAcceptedMemoryIndexReport(options: {
  acceptedMemories: readonly MemoryRecord[];
  skippedNonAcceptedIds: readonly string[];
  queryTerms: readonly string[];
  topK: number;
  candidateCap: number;
  provider: SemanticEmbeddingProvider;
}): SemanticAcceptedMemoryIndexReport {
  const queryEmbedding = options.provider.embed({
    id: "accepted-memory-query",
    terms: options.queryTerms,
  });
  const entries = options.acceptedMemories.map((memory) => ({
    id: memory.id,
    vector: options.provider.embed({
      id: memory.id,
      terms: termsForMemory(memory),
    }).vector,
  }));
  const index = createInMemoryVectorIndex(entries);
  const candidateIds = index
    .query(queryEmbedding.vector, {
      topK: options.topK,
      candidateCap: options.candidateCap,
    })
    .map((match) => match.id);

  return {
    ...baseAcceptedMemoryIndexReport({
      topK: options.topK,
      candidateCap: options.candidateCap,
    }),
    status: "ready",
    enabled: true,
    optInSatisfied: true,
    providerId: options.provider.providerId,
    providerMode: "fixture-mock",
    providerKind: options.provider.providerKind,
    indexedAcceptedMemoryCount: options.acceptedMemories.length,
    skippedNonAcceptedCount: options.skippedNonAcceptedIds.length,
    skippedNonAcceptedIds: [...options.skippedNonAcceptedIds],
    candidateIds,
    embeddingRequestCount: 1 + entries.length,
  };
}

async function runLiveLocalAcceptedMemoryIndexReport(options: {
  acceptedMemories: readonly MemoryRecord[];
  skippedNonAcceptedIds: readonly string[];
  queryTerms: readonly string[];
  topK: number;
  candidateCap: number;
  localProvider?: LocalEmbeddingProvider;
  localProviderConfig?: LocalEmbeddingProviderConfig;
}): Promise<SemanticAcceptedMemoryIndexReport> {
  const provider =
    options.localProvider ??
    localProviderFromConfig(options.localProviderConfig ?? { enabled: false });

  if (!provider) {
    const readiness = evaluateLocalEmbeddingProviderReadiness(
      options.localProviderConfig ?? { enabled: false },
    );

    return {
      ...baseAcceptedMemoryIndexReport({
        topK: options.topK,
        candidateCap: options.candidateCap,
      }),
      status: "provider_unavailable",
      enabled: true,
      optInSatisfied: true,
      providerId: readiness.providerId,
      providerMode: "live-local",
      providerKind: readiness.providerKind,
      modelId: readiness.modelId,
      indexedAcceptedMemoryCount: options.acceptedMemories.length,
      skippedNonAcceptedCount: options.skippedNonAcceptedIds.length,
      skippedNonAcceptedIds: [...options.skippedNonAcceptedIds],
      providerCallCount: readiness.providerCallCount,
      errorCode: readiness.errorCode,
    };
  }

  try {
    const queryEmbedding = await provider.embedText({
      id: "accepted-memory-query",
      text: options.queryTerms.join(" "),
    });
    const embedded = await Promise.all(
      options.acceptedMemories.map(async (memory) => ({
        id: memory.id,
        result: await provider.embedText({
          id: memory.id,
          text: memorySnippetText(memory.content),
        }),
      })),
    );
    const index = createInMemoryVectorIndex(
      embedded.map((item) => ({
        id: item.id,
        vector: item.result.vector,
      })),
    );
    const candidateIds = index
      .query(queryEmbedding.vector, {
        topK: options.topK,
        candidateCap: options.candidateCap,
      })
      .map((match) => match.id);

    return {
      ...baseAcceptedMemoryIndexReport({
        topK: options.topK,
        candidateCap: options.candidateCap,
      }),
      status: "ready",
      enabled: true,
      optInSatisfied: true,
      providerId: provider.providerId,
      providerMode: "live-local",
      providerKind: provider.providerKind,
      modelId: provider.modelId,
      indexedAcceptedMemoryCount: options.acceptedMemories.length,
      skippedNonAcceptedCount: options.skippedNonAcceptedIds.length,
      skippedNonAcceptedIds: [...options.skippedNonAcceptedIds],
      candidateIds,
      embeddingRequestCount: 1 + embedded.length,
      providerCallCount: 1 + embedded.length,
    };
  } catch {
    return {
      ...baseAcceptedMemoryIndexReport({
        topK: options.topK,
        candidateCap: options.candidateCap,
      }),
      status: "provider_unavailable",
      enabled: true,
      optInSatisfied: true,
      providerId: provider.providerId,
      providerMode: "live-local",
      providerKind: provider.providerKind,
      modelId: provider.modelId,
      indexedAcceptedMemoryCount: options.acceptedMemories.length,
      skippedNonAcceptedCount: options.skippedNonAcceptedIds.length,
      skippedNonAcceptedIds: [...options.skippedNonAcceptedIds],
      errorCode: "LOCAL_EMBEDDING_UNAVAILABLE",
    };
  }
}

function localProviderFromConfig(
  config: LocalEmbeddingProviderConfig,
): LocalEmbeddingProvider | null {
  if (!config.enabled || config.provider !== "ollama-local") {
    return null;
  }

  return createOllamaLocalEmbeddingProvider({
    ...config,
    provider: "ollama-local",
  });
}

function disabledAcceptedMemoryIndexReport(input: {
  topK: number;
  candidateCap: number;
  errorCode: LocalEmbeddingErrorCode;
}): SemanticAcceptedMemoryIndexReport {
  return {
    ...baseAcceptedMemoryIndexReport(input),
    status: "disabled",
    enabled: false,
    optInSatisfied: false,
    providerMode: "disabled",
    errorCode: input.errorCode,
  };
}

function baseAcceptedMemoryIndexReport(input: {
  topK: number;
  candidateCap: number;
}): SemanticAcceptedMemoryIndexReport {
  return {
    mode: "accepted-memory-semantic-index-report",
    status: "disabled",
    enabled: false,
    optInSatisfied: false,
    providerId: null,
    providerMode: "disabled",
    providerKind: null,
    modelId: null,
    indexedAcceptedMemoryCount: 0,
    skippedNonAcceptedCount: 0,
    skippedNonAcceptedIds: [],
    candidateIds: [],
    topK: input.topK,
    candidateCap: input.candidateCap,
    embeddingRequestCount: 0,
    providerCallCount: 0,
    errorCode: null,
    productionIntegrationEnabled: false,
    contextInjectionEnabled: false,
    fullTextIncluded: false,
  };
}

function normalizedQueryTerms(
  options: Pick<SemanticAcceptedMemoryIndexOptions, "queryTerms" | "queryText">,
): string[] {
  if (options.queryTerms && options.queryTerms.length > 0) {
    return [...new Set(options.queryTerms.map((term) => term.trim()).filter(Boolean))].sort();
  }

  if (!options.queryText) {
    return [];
  }

  const profile = buildRetrievalTokenProfile(options.queryText);
  return [...profile.latinTokens, ...profile.cjkBigrams].sort();
}

function termsForMemory(memory: MemoryRecord): string[] {
  const snippet = memorySnippetText(memory.content);
  const profile = buildRetrievalTokenProfile(snippet);
  return [...profile.latinTokens, ...profile.cjkBigrams].sort();
}

function formatIds(ids: readonly string[]): string {
  return ids.length > 0 ? ids.join(", ") : "none";
}

export function deterministicCandidateIdsForMemories(
  memories: readonly MemoryRecord[],
  query: string,
): string[] {
  return retrieveAcceptedMemoriesWithExplanation(memories, query).snippets.map(
    (snippet) => snippet.id,
  );
}
