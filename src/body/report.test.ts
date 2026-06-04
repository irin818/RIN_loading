import { describe, expect, it } from "vitest";
import { placeholderBodyAdapter } from "./placeholderAdapter";
import {
  buildBodySmokeReport,
  buildBodyStateReport,
  formatBodySmokeReport,
  formatBodyStateReport,
} from "./report";

describe("body boundary reports", () => {
  it("reports replaceable body adapters without slow-variable storage", () => {
    const report = buildBodySmokeReport();
    const summary = formatBodySmokeReport(report);

    expect(report.adapterCount).toBeGreaterThanOrEqual(3);
    expect(report.bodyReplaceable).toBe(true);
    expect(report.identityStoredInBody).toBe(false);
    expect(report.memoryStoredInBody).toBe(false);
    expect(report.policyStoredInBody).toBe(false);
    expect(report.live2dHardDependencyInCore).toBe(false);
    expect(report.providerCallCount).toBe(0);
    expect(report.fullTextIncluded).toBe(false);
    expect(summary).toContain("rin-placeholder-body");
    expect(summary).not.toContain("identity model");
  });

  it("maps body state through a replaceable adapter", () => {
    const report = buildBodyStateReport(placeholderBodyAdapter, {
      mood: "focused",
      expression: "attentive",
      attention: "active",
      voiceStyle: "soft",
      idle_state: "calm-idle",
    });
    const summary = formatBodyStateReport(report);

    expect(report.adapterId).toBe("rin-placeholder-body");
    expect(report.bodyState).toMatchObject({
      emotion: "focused",
      expression: "attentive",
      motion: "soft-attention",
      voiceStyle: "soft",
      mouthSync: "idle",
      idleBehavior: "calm-idle",
      attention: "active",
    });
    expect(report.bodyReplaceable).toBe(true);
    expect(report.identityStoredInBody).toBe(false);
    expect(report.memoryStoredInBody).toBe(false);
    expect(report.policyStoredInBody).toBe(false);
    expect(report.providerCallCount).toBe(0);
    expect(summary).not.toContain("memory text");
  });
});
