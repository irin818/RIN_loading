import { describe, expect, it } from "vitest";
import {
  formatSemanticLiveReadinessReport,
  getSemanticLiveReadinessReport,
} from "./semanticLiveReadiness";

describe("getSemanticLiveReadinessReport", () => {
  it("skips safely when live semantic provider is not explicitly configured", async () => {
    const report = await getSemanticLiveReadinessReport({});

    expect(report.skipped).toBe(true);
    expect(report.safeToSkip).toBe(true);
    expect(report.providerConfigured).toBe(false);
    expect(report.modelConfigured).toBe(false);
    expect(report.providerCallCount).toBe(0);
    expect(report.readiness.status).toBe("disabled");
    expect(report.readiness.errorCode).toBe("LOCAL_EMBEDDING_DISABLED");
  });

  it("skips safely when provider is explicit but model is missing", async () => {
    const report = await getSemanticLiveReadinessReport({
      RIN_SEMANTIC_LIVE_PROVIDER: "ollama-local",
    });

    expect(report.skipped).toBe(true);
    expect(report.providerConfigured).toBe(true);
    expect(report.modelConfigured).toBe(false);
    expect(report.providerCallCount).toBe(0);
    expect(report.readiness.status).toBe("unsupported");
    expect(report.readiness.errorCode).toBe("LOCAL_EMBEDDING_UNSUPPORTED");
  });

  it("formats safe output without env dumps or probe text", async () => {
    const summary = formatSemanticLiveReadinessReport(
      await getSemanticLiveReadinessReport({
        RIN_SEMANTIC_LIVE_PROVIDER: "ollama-local",
      }),
    );

    expect(summary).toContain(
      "RIN semantic live local embedding readiness report.",
    );
    expect(summary).toContain("Skipped: yes");
    expect(summary).toContain("providerCallCount: 0");
    expect(summary).toContain("LOCAL_EMBEDDING_UNSUPPORTED");
    expect(summary).not.toContain("rin semantic readiness probe");
    expect(summary).not.toContain("RIN_SEMANTIC_LIVE_PROVIDER");
    expect(summary).not.toContain("RIN_OLLAMA_BASE_URL");
  });
});
