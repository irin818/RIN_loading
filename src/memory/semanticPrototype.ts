import type { MemoryStatus } from "./manager";
import {
  createFixtureSemanticEmbeddingProvider,
  FIXTURE_SEMANTIC_EMBEDDING_PROVIDER_ID,
  type SemanticEmbeddingProvider,
} from "./semanticEmbedding";
import {
  createInMemoryVectorIndex,
  type VectorIndexMatch,
} from "./vectorIndex";

export type FixtureSemanticPrototypeMemory = {
  id: string;
  status?: MemoryStatus;
  prototypeEmbeddingTerms?: readonly string[];
};

export type FixtureSemanticCandidateGenerationOptions = {
  queryId: string;
  queryTerms?: readonly string[];
  memories: readonly FixtureSemanticPrototypeMemory[];
  topK?: number;
  candidateCap?: number;
  minScore?: number;
  provider?: SemanticEmbeddingProvider;
};

export type FixtureSemanticCandidateGenerationResult = {
  prototypeSemanticProvider: typeof FIXTURE_SEMANTIC_EMBEDDING_PROVIDER_ID;
  providerCallCount: 0;
  embeddingRequestCount: number;
  topK: number;
  candidateCap: number;
  minScore: number;
  prototypeSemanticCandidateIds: string[];
  safePrototypeSemanticCandidateIds: string[];
  nonAcceptedPrototypeCandidateIds: string[];
  prototypeScoresByMemoryId: Record<string, number>;
};

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = Number.EPSILON;

export function generateFixtureSemanticCandidates(
  options: FixtureSemanticCandidateGenerationOptions,
): FixtureSemanticCandidateGenerationResult {
  const provider =
    options.provider ?? createFixtureSemanticEmbeddingProvider();
  const topK = Math.max(0, options.topK ?? DEFAULT_TOP_K);
  const candidateCap = Math.max(0, options.candidateCap ?? topK);
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const queryTerms = options.queryTerms ?? [];

  if (queryTerms.length === 0 || topK === 0 || candidateCap === 0) {
    return emptyGenerationResult(topK, candidateCap, minScore);
  }

  const queryEmbedding = provider.embed({
    id: options.queryId,
    terms: queryTerms,
  });
  const indexableMemories = options.memories.filter(
    (memory) => (memory.prototypeEmbeddingTerms ?? []).length > 0,
  );
  const acceptedMemories = indexableMemories.filter(
    (memory) => (memory.status ?? "accepted") === "accepted",
  );
  const nonAcceptedMemories = indexableMemories.filter(
    (memory) => (memory.status ?? "accepted") !== "accepted",
  );
  const acceptedMatches = queryMemories(
    provider,
    acceptedMemories,
    queryEmbedding.vector,
    { topK, candidateCap, minScore },
  );
  const nonAcceptedMatches = queryMemories(
    provider,
    nonAcceptedMemories,
    queryEmbedding.vector,
    { topK, candidateCap, minScore },
  );
  const prototypeSemanticCandidateIds = uniqueIds([
    ...acceptedMatches.map((match) => match.id),
    ...nonAcceptedMatches.map((match) => match.id),
  ]);
  const prototypeScoresByMemoryId = Object.fromEntries(
    [...acceptedMatches, ...nonAcceptedMatches].map((match) => [
      match.id,
      match.score,
    ]),
  );

  return {
    prototypeSemanticProvider: FIXTURE_SEMANTIC_EMBEDDING_PROVIDER_ID,
    providerCallCount: 0,
    embeddingRequestCount: 1 + indexableMemories.length,
    topK,
    candidateCap,
    minScore,
    prototypeSemanticCandidateIds,
    safePrototypeSemanticCandidateIds: acceptedMatches.map((match) => match.id),
    nonAcceptedPrototypeCandidateIds: nonAcceptedMatches.map(
      (match) => match.id,
    ),
    prototypeScoresByMemoryId,
  };
}

function queryMemories(
  provider: SemanticEmbeddingProvider,
  memories: readonly FixtureSemanticPrototypeMemory[],
  queryVector: readonly number[],
  options: {
    topK: number;
    candidateCap: number;
    minScore: number;
  },
): VectorIndexMatch[] {
  const index = createInMemoryVectorIndex(
    memories.map((memory) => ({
      id: memory.id,
      vector: provider.embed({
        id: memory.id,
        terms: memory.prototypeEmbeddingTerms ?? [],
      }).vector,
    })),
  );

  return index.query(queryVector, options);
}

function emptyGenerationResult(
  topK: number,
  candidateCap: number,
  minScore: number,
): FixtureSemanticCandidateGenerationResult {
  return {
    prototypeSemanticProvider: FIXTURE_SEMANTIC_EMBEDDING_PROVIDER_ID,
    providerCallCount: 0,
    embeddingRequestCount: 0,
    topK,
    candidateCap,
    minScore,
    prototypeSemanticCandidateIds: [],
    safePrototypeSemanticCandidateIds: [],
    nonAcceptedPrototypeCandidateIds: [],
    prototypeScoresByMemoryId: {},
  };
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
