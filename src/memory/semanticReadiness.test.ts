import { describe, expect, it } from "vitest";
import {
  formatSemanticReadinessReport,
  getSemanticReadinessReport,
} from "./semanticReadiness";

describe("getSemanticReadinessReport", () => {
  it("reports semantic readiness without enabling production semantic retrieval", () => {
    const report = getSemanticReadinessReport();

    expect(report.ready).toBe(true);
    expect(report.providerCallCount).toBe(0);
    expect(report.localEmbeddingProvider.status).toBe("disabled");
    expect(report.localEmbeddingProvider.errorCode).toBe(
      "LOCAL_EMBEDDING_DISABLED",
    );
    expect(report.tempEmbeddingProvider).toBe("fixture-mock-local-embedding");
    expect(report.tempEmbeddingProviderKind).toBe("fixture-mock-local");
    expect(report.tempEmbeddingCandidateCount).toBe(2);
    expect(report.providerCallCountByProviderKind).toEqual({
      "disabled-local-scaffold": 0,
      "fixture-mock-local": 0,
    });
    expect(report.productionSemanticRetrievalEnabled).toBe(false);
    expect(report.contextIntegrationEnabled).toBe(false);
    expect(report.runtimeIntegrationEnabled).toBe(false);
    expect(report.serverIntegrationEnabled).toBe(false);
    expect(report.consoleIntegrationEnabled).toBe(false);
    expect(report.vectorDbConfigured).toBe(false);
    expect(report.realDataIndexingEnabled).toBe(false);
    expect(report.checks.every((check) => check.status !== "fail")).toBe(true);
  });

  it("formats a concise report without fixture memory text", () => {
    const summary = formatSemanticReadinessReport(getSemanticReadinessReport());

    expect(summary).toContain("RIN semantic retrieval readiness report.");
    expect(summary).toContain("Ready: yes");
    expect(summary).toContain("Local embedding provider: disabled");
    expect(summary).toContain(
      "Local embedding error code: LOCAL_EMBEDDING_DISABLED",
    );
    expect(summary).toContain(
      "Temp embedding provider: fixture-mock-local-embedding",
    );
    expect(summary).toContain("Temp embedding candidates: 2");
    expect(summary).toContain(
      "providerCallCountByProviderKind: disabled-local-scaffold=0, fixture-mock-local=0",
    );
    expect(summary).toContain("Production semantic retrieval enabled: no");
    expect(summary).toContain("providerCallCount: 0");
    expect(summary).not.toContain(
      "Synthetic confidential semantic phrase must stay out of reports",
    );
  });

  it("keeps explicitly enabled local provider configs unsupported and report-only", () => {
    const report = getSemanticReadinessReport({
      enabled: true,
      provider: "ollama-local",
      model: "embedding-model",
    });

    expect(report.ready).toBe(true);
    expect(report.localEmbeddingProvider.status).toBe("unsupported");
    expect(report.providerCallCount).toBe(0);
    expect(
      report.checks.find((check) => check.id === "local-embedding-provider")
        ?.status,
    ).toBe("warn");
  });
});
