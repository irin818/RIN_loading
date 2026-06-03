import {
  cosineSimilarity,
  normalizeVector,
  type SemanticEmbeddingVector,
} from "./semanticEmbedding";

export type VectorIndexEntry = {
  id: string;
  vector: SemanticEmbeddingVector;
};

export type VectorIndexMatch = {
  id: string;
  score: number;
  rank: number;
};

export type VectorIndexQueryOptions = {
  topK?: number;
  candidateCap?: number;
  minScore?: number;
};

export type InMemoryVectorIndex = {
  readonly dimension: number;
  readonly size: number;
  query(
    queryVector: SemanticEmbeddingVector,
    options?: VectorIndexQueryOptions,
  ): VectorIndexMatch[];
};

export function createInMemoryVectorIndex(
  entries: readonly VectorIndexEntry[],
): InMemoryVectorIndex {
  const dimension = inferDimension(entries);
  const indexedEntries = entries.map((entry) => {
    if (entry.vector.length !== dimension) {
      throw new Error(
        `Vector dimensions differ for ${entry.id}: expected=${dimension}, actual=${entry.vector.length}.`,
      );
    }

    return {
      id: entry.id,
      vector: normalizeVector(entry.vector),
    };
  });

  return {
    dimension,
    size: indexedEntries.length,
    query(queryVector, options = {}) {
      if (indexedEntries.length === 0) {
        return [];
      }

      if (queryVector.length !== dimension) {
        throw new Error(
          `Query vector dimension ${queryVector.length} does not match index dimension ${dimension}.`,
        );
      }

      const normalizedQuery = normalizeVector(queryVector);
      const topK = Math.max(0, options.topK ?? indexedEntries.length);
      const candidateCap = Math.max(0, options.candidateCap ?? topK);
      const minScore = options.minScore ?? Number.EPSILON;
      const limit = Math.min(topK, candidateCap);

      return indexedEntries
        .map((entry) => ({
          id: entry.id,
          score: roundScore(cosineSimilarity(normalizedQuery, entry.vector)),
        }))
        .filter((match) => match.score >= minScore)
        .sort(compareVectorMatches)
        .slice(0, limit)
        .map((match, index) => ({
          ...match,
          rank: index + 1,
        }));
    },
  };
}

function inferDimension(entries: readonly VectorIndexEntry[]): number {
  if (entries.length === 0) {
    return 0;
  }

  const dimension = entries[0].vector.length;

  if (dimension === 0) {
    throw new Error("Vector index entries must not use zero-length vectors.");
  }

  return dimension;
}

function compareVectorMatches(
  left: Omit<VectorIndexMatch, "rank">,
  right: Omit<VectorIndexMatch, "rank">,
): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return left.id.localeCompare(right.id);
}

function roundScore(score: number): number {
  return Math.round(score * 1_000_000_000_000) / 1_000_000_000_000;
}
