import {
  evaluateLocalEmbeddingProviderReadiness,
  type LocalEmbeddingProviderConfig,
  type LocalEmbeddingProviderReadiness,
} from "./semanticEmbedding";
import { runBuiltInSemanticComparisonEvaluation } from "./semanticEvaluation";

export type SemanticReadinessCheck = {
  id: string;
  status: "pass" | "warn" | "fail";
  message: string;
};

export type SemanticReadinessReport = {
  ready: boolean;
  deterministicBaselineStatus: "production-baseline-unchanged";
  semanticEvalAvailable: boolean;
  fixturePrototypeAvailable: boolean;
  productionSemanticRetrievalEnabled: false;
  contextIntegrationEnabled: false;
  runtimeIntegrationEnabled: false;
  serverIntegrationEnabled: false;
  consoleIntegrationEnabled: false;
  vectorDbConfigured: false;
  realDataIndexingEnabled: false;
  localEmbeddingProvider: LocalEmbeddingProviderReadiness;
  providerCallCount: 0;
  checks: SemanticReadinessCheck[];
};

export function getSemanticReadinessReport(
  config?: LocalEmbeddingProviderConfig,
): SemanticReadinessReport {
  const semanticEval = runBuiltInSemanticComparisonEvaluation();
  const localEmbeddingProvider = evaluateLocalEmbeddingProviderReadiness(config);
  const checks: SemanticReadinessCheck[] = [
    {
      id: "deterministic-baseline",
      status: "pass",
      message:
        "Deterministic accepted-memory retrieval remains the production baseline.",
    },
    {
      id: "semantic-eval",
      status: semanticEval.failed === 0 ? "pass" : "fail",
      message: `Semantic comparison fixtures passed ${semanticEval.passed}/${semanticEval.total}.`,
    },
    {
      id: "fixture-prototype",
      status: semanticEval.prototypeRanCaseCount > 0 ? "pass" : "fail",
      message: `Fixture embedding prototype ran in ${semanticEval.prototypeRanCaseCount} cases.`,
    },
    {
      id: "local-embedding-provider",
      status:
        localEmbeddingProvider.status === "disabled" ? "pass" : "warn",
      message: localEmbeddingProvider.message,
    },
    {
      id: "production-integration",
      status: "pass",
      message:
        "Production semantic retrieval, context injection, server APIs, and Console behavior remain disabled.",
    },
    {
      id: "real-data-indexing",
      status: "pass",
      message:
        "Semantic readiness uses fixture data only and does not index real .rin-data.",
    },
    {
      id: "vector-db",
      status: "pass",
      message: "No vector database is configured or required.",
    },
    {
      id: "provider-isolation",
      status: "pass",
      message: "Default semantic readiness performs no provider calls.",
    },
  ];

  return {
    ready: checks.every((check) => check.status !== "fail"),
    deterministicBaselineStatus: "production-baseline-unchanged",
    semanticEvalAvailable: true,
    fixturePrototypeAvailable: semanticEval.prototypeRanCaseCount > 0,
    productionSemanticRetrievalEnabled: false,
    contextIntegrationEnabled: false,
    runtimeIntegrationEnabled: false,
    serverIntegrationEnabled: false,
    consoleIntegrationEnabled: false,
    vectorDbConfigured: false,
    realDataIndexingEnabled: false,
    localEmbeddingProvider,
    providerCallCount: 0,
    checks,
  };
}

export function formatSemanticReadinessReport(
  report: SemanticReadinessReport,
): string {
  const lines = [
    "RIN semantic retrieval readiness report.",
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Deterministic baseline: ${report.deterministicBaselineStatus}`,
    `Semantic eval available: ${report.semanticEvalAvailable ? "yes" : "no"}`,
    `Fixture prototype available: ${
      report.fixturePrototypeAvailable ? "yes" : "no"
    }`,
    `Local embedding provider: ${report.localEmbeddingProvider.status}`,
    `Production semantic retrieval enabled: ${
      report.productionSemanticRetrievalEnabled ? "yes" : "no"
    }`,
    `Context integration enabled: ${
      report.contextIntegrationEnabled ? "yes" : "no"
    }`,
    `Runtime integration enabled: ${
      report.runtimeIntegrationEnabled ? "yes" : "no"
    }`,
    `Server integration enabled: ${
      report.serverIntegrationEnabled ? "yes" : "no"
    }`,
    `Console integration enabled: ${
      report.consoleIntegrationEnabled ? "yes" : "no"
    }`,
    `Vector DB configured: ${report.vectorDbConfigured ? "yes" : "no"}`,
    `Real .rin-data indexing enabled: ${
      report.realDataIndexingEnabled ? "yes" : "no"
    }`,
    `providerCallCount: ${report.providerCallCount}`,
    "Checks:",
  ];

  for (const check of report.checks) {
    lines.push(`[${check.status}] ${check.id}`);
    lines.push(`  ${check.message}`);
  }

  return lines.join("\n");
}
