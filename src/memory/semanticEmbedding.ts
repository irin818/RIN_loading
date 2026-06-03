export type SemanticEmbeddingVector = readonly number[];

export type SemanticEmbeddingProviderKind =
  | "fixture-mock-local"
  | "disabled-local-scaffold"
  | "ollama-local"
  | "local-process";

export type LocalEmbeddingErrorCode =
  | "LOCAL_EMBEDDING_DISABLED"
  | "LOCAL_EMBEDDING_UNSUPPORTED"
  | "LOCAL_EMBEDDING_UNAVAILABLE"
  | "LOCAL_EMBEDDING_TIMEOUT"
  | "LOCAL_EMBEDDING_INVALID_RESPONSE"
  | "LOCAL_EMBEDDING_DIMENSION_MISMATCH";

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

export type LocalEmbeddingTextInput = {
  id: string;
  text: string;
};

export type LocalEmbeddingResult = {
  id: string;
  vector: SemanticEmbeddingVector;
  providerId: string;
  providerKind: Extract<SemanticEmbeddingProviderKind, "ollama-local">;
  modelId: string;
  dimension: number;
  latencyMs: number;
  providerCallCount: 1;
};

export type LocalEmbeddingProvider = {
  providerId: string;
  providerKind: Extract<SemanticEmbeddingProviderKind, "ollama-local">;
  modelId: string;
  expectedDimension: number | null;
  timeoutMs: number;
  checkReadiness(): Promise<LocalEmbeddingProviderReadiness>;
  embedText(input: LocalEmbeddingTextInput): Promise<LocalEmbeddingResult>;
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
      baseUrl?: string;
      endpoint?: string;
      timeoutMs?: number;
      expectedDimension?: number;
    };

export type LocalEmbeddingProviderReadiness = {
  enabled: boolean;
  status:
    | "disabled"
    | "unsupported"
    | "available"
    | "unavailable"
    | "timeout"
    | "invalid_response"
    | "dimension_mismatch";
  providerId: string | null;
  providerKind: SemanticEmbeddingProviderKind | null;
  modelId: string | null;
  dimension: number | null;
  latencyMs: number | null;
  providerCallCount: number;
  errorCode: LocalEmbeddingErrorCode | null;
  message: string;
};

export const FIXTURE_SEMANTIC_EMBEDDING_PROVIDER_ID =
  "fixture-mock-local-embedding";
export const DISABLED_LOCAL_EMBEDDING_PROVIDER_ID =
  "disabled-local-embedding-scaffold";
export const DEFAULT_FIXTURE_EMBEDDING_DIMENSION = 16;
export const DEFAULT_LOCAL_EMBEDDING_TIMEOUT_MS = 10_000;
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
      providerKind: "disabled-local-scaffold",
      modelId: null,
      dimension: null,
      latencyMs: null,
      providerCallCount: 0,
      errorCode: "LOCAL_EMBEDDING_DISABLED",
      message:
        "Local embedding providers are disabled by default; semantic retrieval remains report-only.",
    };
  }

  return {
    enabled: true,
    status: "unsupported",
    providerId: config.provider,
    providerKind: config.provider,
    modelId: config.model,
    dimension: null,
    latencyMs: null,
    providerCallCount: 0,
    errorCode: "LOCAL_EMBEDDING_UNSUPPORTED",
    message:
      "Local embedding provider scaffold is present but no real provider calls are implemented in this milestone.",
  };
}

export function createUnsupportedLocalEmbeddingProvider(
  config: LocalEmbeddingProviderConfig,
): never {
  const provider = config.enabled ? config.provider : "disabled";

  throw new LocalEmbeddingProviderError(
    "LOCAL_EMBEDDING_UNSUPPORTED",
    `Local embedding provider ${provider} is a disabled scaffold only; no provider calls are implemented.`,
  );
}

export class LocalEmbeddingProviderError extends Error {
  constructor(
    public readonly code: LocalEmbeddingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LocalEmbeddingProviderError";
  }
}

export function createOllamaLocalEmbeddingProvider(
  config: Extract<LocalEmbeddingProviderConfig, { enabled: true }> & {
    provider: "ollama-local";
  },
): LocalEmbeddingProvider {
  const baseUrl = sanitizeBaseUrl(config.baseUrl ?? config.endpoint);
  const timeoutMs = Math.max(
    1,
    config.timeoutMs ?? DEFAULT_LOCAL_EMBEDDING_TIMEOUT_MS,
  );
  const expectedDimension = config.expectedDimension ?? null;

  return {
    providerId: "ollama-local-embedding",
    providerKind: "ollama-local",
    modelId: config.model,
    expectedDimension,
    timeoutMs,
    async checkReadiness() {
      const startedAt = Date.now();

      try {
        const result = await embedOllamaText({
          baseUrl,
          model: config.model,
          input: "rin semantic readiness probe",
          timeoutMs,
          expectedDimension,
        });

        return {
          enabled: true,
          status: "available",
          providerId: "ollama-local-embedding",
          providerKind: "ollama-local",
          modelId: config.model,
          dimension: result.vector.length,
          latencyMs: Date.now() - startedAt,
          providerCallCount: 1,
          errorCode: null,
          message:
            "Local Ollama embedding provider responded for a temp readiness probe.",
        };
      } catch (error) {
        const classified = classifyLocalEmbeddingError(error);

        return {
          enabled: true,
          status: statusForErrorCode(classified.code),
          providerId: "ollama-local-embedding",
          providerKind: "ollama-local",
          modelId: config.model,
          dimension: null,
          latencyMs: Date.now() - startedAt,
          providerCallCount: 1,
          errorCode: classified.code,
          message: classified.message,
        };
      }
    },
    async embedText(input) {
      const startedAt = Date.now();
      const result = await embedOllamaText({
        baseUrl,
        model: config.model,
        input: input.text,
        timeoutMs,
        expectedDimension,
      });

      return {
        id: input.id,
        vector: normalizeVector(result.vector),
        providerId: "ollama-local-embedding",
        providerKind: "ollama-local",
        modelId: config.model,
        dimension: result.vector.length,
        latencyMs: Date.now() - startedAt,
        providerCallCount: 1,
      };
    },
  };
}

export function classifyLocalEmbeddingError(error: unknown): {
  code: LocalEmbeddingErrorCode;
  message: string;
} {
  if (error instanceof LocalEmbeddingProviderError) {
    return { code: error.code, message: safeMessageForErrorCode(error.code) };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      code: "LOCAL_EMBEDDING_TIMEOUT",
      message: safeMessageForErrorCode("LOCAL_EMBEDDING_TIMEOUT"),
    };
  }

  return {
    code: "LOCAL_EMBEDDING_UNAVAILABLE",
    message: safeMessageForErrorCode("LOCAL_EMBEDDING_UNAVAILABLE"),
  };
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

type OllamaEmbeddingResponse = {
  embedding?: unknown;
  embeddings?: unknown;
};

async function embedOllamaText(options: {
  baseUrl: string;
  model: string;
  input: string;
  timeoutMs: number;
  expectedDimension: number | null;
}): Promise<{ vector: number[] }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(`${options.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: options.model,
        prompt: options.input,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new LocalEmbeddingProviderError(
        "LOCAL_EMBEDDING_UNAVAILABLE",
        "Local embedding provider is unavailable.",
      );
    }

    const payload = (await response.json()) as OllamaEmbeddingResponse;
    const vector = readOllamaEmbeddingVector(payload);

    if (options.expectedDimension !== null && vector.length !== options.expectedDimension) {
      throw new LocalEmbeddingProviderError(
        "LOCAL_EMBEDDING_DIMENSION_MISMATCH",
        "Local embedding provider returned an unexpected vector dimension.",
      );
    }

    return { vector };
  } catch (error) {
    if (error instanceof LocalEmbeddingProviderError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new LocalEmbeddingProviderError(
      "LOCAL_EMBEDDING_UNAVAILABLE",
      "Local embedding provider is unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function readOllamaEmbeddingVector(payload: OllamaEmbeddingResponse): number[] {
  const candidate = Array.isArray(payload.embedding)
    ? payload.embedding
    : Array.isArray(payload.embeddings) && Array.isArray(payload.embeddings[0])
      ? payload.embeddings[0]
      : null;

  if (!candidate || candidate.length === 0) {
    throw new LocalEmbeddingProviderError(
      "LOCAL_EMBEDDING_INVALID_RESPONSE",
      "Local embedding provider returned an invalid response.",
    );
  }

  if (!candidate.every((value) => typeof value === "number" && Number.isFinite(value))) {
    throw new LocalEmbeddingProviderError(
      "LOCAL_EMBEDDING_INVALID_RESPONSE",
      "Local embedding provider returned an invalid response.",
    );
  }

  return candidate;
}

function sanitizeBaseUrl(value: string | undefined): string {
  const baseUrl = value ?? "http://127.0.0.1:11434";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function statusForErrorCode(
  code: LocalEmbeddingErrorCode,
): LocalEmbeddingProviderReadiness["status"] {
  switch (code) {
    case "LOCAL_EMBEDDING_DISABLED":
      return "disabled";
    case "LOCAL_EMBEDDING_UNSUPPORTED":
      return "unsupported";
    case "LOCAL_EMBEDDING_TIMEOUT":
      return "timeout";
    case "LOCAL_EMBEDDING_INVALID_RESPONSE":
      return "invalid_response";
    case "LOCAL_EMBEDDING_DIMENSION_MISMATCH":
      return "dimension_mismatch";
    default:
      return "unavailable";
  }
}

function safeMessageForErrorCode(code: LocalEmbeddingErrorCode): string {
  switch (code) {
    case "LOCAL_EMBEDDING_DISABLED":
      return "Local embedding providers are disabled by default.";
    case "LOCAL_EMBEDDING_UNSUPPORTED":
      return "Local embedding provider configuration is unsupported.";
    case "LOCAL_EMBEDDING_TIMEOUT":
      return "Local embedding provider timed out.";
    case "LOCAL_EMBEDDING_INVALID_RESPONSE":
      return "Local embedding provider returned an invalid response.";
    case "LOCAL_EMBEDDING_DIMENSION_MISMATCH":
      return "Local embedding provider returned an unexpected vector dimension.";
    default:
      return "Local embedding provider is unavailable.";
  }
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
