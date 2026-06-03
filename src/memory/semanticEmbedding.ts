export type SemanticEmbeddingVector = readonly number[];

export type SemanticEmbeddingProviderKind =
  | "fixture-mock-local"
  | "disabled-local-scaffold";

export type SemanticEmbeddingInput = {
  id: string;
  terms: readonly string[];
};

export type SemanticEmbeddingResult = {
  id: string;
  vector: SemanticEmbeddingVector;
  providerId: string;
  providerKind: SemanticEmbeddingProviderKind;
  providerCallCount: 0;
};

export type SemanticEmbeddingProvider = {
  providerId: string;
  providerKind: SemanticEmbeddingProviderKind;
  dimension: number;
  embed(input: SemanticEmbeddingInput): SemanticEmbeddingResult;
};

export type FixtureSemanticEmbeddingProviderOptions = {
  dimension?: number;
};

export type LocalEmbeddingProviderConfig =
  | { enabled: false }
  | {
      enabled: true;
      provider: "ollama-local" | "local-process";
      model: string;
      endpoint?: string;
    };

export type LocalEmbeddingProviderReadiness = {
  enabled: boolean;
  status: "disabled" | "unsupported";
  providerId: string | null;
  providerCallCount: 0;
  message: string;
};

export const FIXTURE_SEMANTIC_EMBEDDING_PROVIDER_ID =
  "fixture-mock-local-embedding";
export const DISABLED_LOCAL_EMBEDDING_PROVIDER_ID =
  "disabled-local-embedding-scaffold";
export const DEFAULT_FIXTURE_EMBEDDING_DIMENSION = 16;
export const DEFAULT_LOCAL_EMBEDDING_PROVIDER_CONFIG: LocalEmbeddingProviderConfig =
  {
    enabled: false,
  };

export function createFixtureSemanticEmbeddingProvider(
  options: FixtureSemanticEmbeddingProviderOptions = {},
): SemanticEmbeddingProvider {
  const dimension = Math.max(
    1,
    options.dimension ?? DEFAULT_FIXTURE_EMBEDDING_DIMENSION,
  );

  return {
    providerId: FIXTURE_SEMANTIC_EMBEDDING_PROVIDER_ID,
    providerKind: "fixture-mock-local",
    dimension,
    embed(input) {
      return {
        id: input.id,
        vector: embedFixtureTerms(input.terms, dimension),
        providerId: FIXTURE_SEMANTIC_EMBEDDING_PROVIDER_ID,
        providerKind: "fixture-mock-local",
        providerCallCount: 0,
      };
    },
  };
}

export function evaluateLocalEmbeddingProviderReadiness(
  config: LocalEmbeddingProviderConfig = DEFAULT_LOCAL_EMBEDDING_PROVIDER_CONFIG,
): LocalEmbeddingProviderReadiness {
  if (!config.enabled) {
    return {
      enabled: false,
      status: "disabled",
      providerId: null,
      providerCallCount: 0,
      message:
        "Local embedding providers are disabled by default; semantic retrieval remains report-only.",
    };
  }

  return {
    enabled: true,
    status: "unsupported",
    providerId: config.provider,
    providerCallCount: 0,
    message:
      "Local embedding provider scaffold is present but no real provider calls are implemented in this milestone.",
  };
}

export function createUnsupportedLocalEmbeddingProvider(
  config: LocalEmbeddingProviderConfig,
): never {
  const provider = config.enabled ? config.provider : "disabled";

  throw new Error(
    `Local embedding provider ${provider} is a disabled scaffold only; no provider calls are implemented.`,
  );
}

export function normalizeVector(
  vector: SemanticEmbeddingVector,
): SemanticEmbeddingVector {
  const magnitude = Math.sqrt(dotProduct(vector, vector));

  if (magnitude === 0) {
    return vector.map(() => 0);
  }

  return vector.map((value) => value / magnitude);
}

export function dotProduct(
  left: SemanticEmbeddingVector,
  right: SemanticEmbeddingVector,
): number {
  assertSameDimension(left, right);

  return left.reduce((total, value, index) => total + value * right[index], 0);
}

export function cosineSimilarity(
  left: SemanticEmbeddingVector,
  right: SemanticEmbeddingVector,
): number {
  assertSameDimension(left, right);

  const leftMagnitude = Math.sqrt(dotProduct(left, left));
  const rightMagnitude = Math.sqrt(dotProduct(right, right));

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dotProduct(left, right) / (leftMagnitude * rightMagnitude);
}

function embedFixtureTerms(
  terms: readonly string[],
  dimension: number,
): SemanticEmbeddingVector {
  const vector = Array.from({ length: dimension }, () => 0);

  for (const term of terms) {
    const normalized = normalizeFixtureTerm(term);

    if (normalized.length === 0) {
      continue;
    }

    const bucket = stableHash(`bucket:${normalized}`) % dimension;
    const sign = stableHash(`sign:${normalized}`) % 2 === 0 ? 1 : -1;
    vector[bucket] += sign;
  }

  return normalizeVector(vector);
}

function normalizeFixtureTerm(term: string): string {
  return term.normalize("NFKC").trim().toLowerCase();
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function assertSameDimension(
  left: SemanticEmbeddingVector,
  right: SemanticEmbeddingVector,
): void {
  if (left.length !== right.length) {
    throw new Error(
      `Vector dimensions differ: left=${left.length}, right=${right.length}.`,
    );
  }
}
