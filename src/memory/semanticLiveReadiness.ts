import {
  createOllamaLocalEmbeddingProvider,
  evaluateLocalEmbeddingProviderReadiness,
  type LocalEmbeddingProviderConfig,
  type LocalEmbeddingProviderReadiness,
} from "./semanticEmbedding";

export type SemanticLiveReadinessEnvironment = Record<string, string | undefined>;

export type SemanticLiveReadinessReport = {
  mode: "explicit-live-local-embedding-readiness";
  skipped: boolean;
  safeToSkip: true;
  providerConfigured: boolean;
  modelConfigured: boolean;
  providerCallCount: number;
  readiness: LocalEmbeddingProviderReadiness;
};

export async function getSemanticLiveReadinessReport(
  env: SemanticLiveReadinessEnvironment = process.env,
): Promise<SemanticLiveReadinessReport> {
  const config = readSemanticLiveEmbeddingConfig(env);

  if (!config.enabled) {
    return {
      mode: "explicit-live-local-embedding-readiness",
      skipped: true,
      safeToSkip: true,
      providerConfigured: false,
      modelConfigured: false,
      providerCallCount: 0,
      readiness: evaluateLocalEmbeddingProviderReadiness(config),
    };
  }

  if (config.provider !== "ollama-local") {
    return {
      mode: "explicit-live-local-embedding-readiness",
      skipped: true,
      safeToSkip: true,
      providerConfigured: true,
      modelConfigured: Boolean(config.model),
      providerCallCount: 0,
      readiness: evaluateLocalEmbeddingProviderReadiness(config),
    };
  }

  const provider = createOllamaLocalEmbeddingProvider({
    ...config,
    provider: "ollama-local",
  });
  const readiness = await provider.checkReadiness();

  return {
    mode: "explicit-live-local-embedding-readiness",
    skipped: false,
    safeToSkip: true,
    providerConfigured: true,
    modelConfigured: true,
    providerCallCount: readiness.providerCallCount,
    readiness,
  };
}

export function formatSemanticLiveReadinessReport(
  report: SemanticLiveReadinessReport,
): string {
  return [
    "RIN semantic live local embedding readiness report.",
    `Mode: ${report.mode}`,
    `Skipped: ${report.skipped ? "yes" : "no"}`,
    `Safe to skip: ${report.safeToSkip ? "yes" : "no"}`,
    `Provider configured: ${report.providerConfigured ? "yes" : "no"}`,
    `Model configured: ${report.modelConfigured ? "yes" : "no"}`,
    `Provider status: ${report.readiness.status}`,
    `Provider id: ${report.readiness.providerId ?? "none"}`,
    `Provider kind: ${report.readiness.providerKind ?? "none"}`,
    `Model id: ${report.readiness.modelId ?? "none"}`,
    `Dimension: ${report.readiness.dimension ?? "unknown"}`,
    `Latency ms: ${report.readiness.latencyMs ?? "unknown"}`,
    `Error code: ${report.readiness.errorCode ?? "none"}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Message: ${report.readiness.message}`,
  ].join("\n");
}

function readSemanticLiveEmbeddingConfig(
  env: SemanticLiveReadinessEnvironment,
): LocalEmbeddingProviderConfig {
  if (env.RIN_SEMANTIC_LIVE_PROVIDER !== "ollama-local") {
    return { enabled: false };
  }

  const model =
    env.RIN_SEMANTIC_OLLAMA_EMBEDDING_MODEL ??
    env.RIN_OLLAMA_EMBEDDING_MODEL ??
    "";

  if (model.trim().length === 0) {
    return {
      enabled: true,
      provider: "local-process",
      model: "",
    };
  }

  return {
    enabled: true,
    provider: "ollama-local",
    model: model.trim(),
    baseUrl: env.RIN_OLLAMA_BASE_URL,
    timeoutMs: parsePositiveInteger(env.RIN_SEMANTIC_OLLAMA_TIMEOUT_MS),
    expectedDimension: parsePositiveInteger(
      env.RIN_SEMANTIC_OLLAMA_EXPECTED_DIMENSION,
    ),
  };
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
