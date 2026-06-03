import { describe, expect, it } from "vitest";
import {
  createFixturePlan,
  formatPlannerSmokeReport,
  runBuiltInPlannerSmoke,
  runPlannerSelfCheck,
} from "./planner";

describe("runPlannerSelfCheck", () => {
  it("runs a finite dry-run self-check loop", () => {
    const report = runBuiltInPlannerSmoke();

    expect(report.mode).toBe("planner-smoke");
    expect(report.checkedStepCount).toBe(3);
    expect(report.completedStepCount).toBe(1);
    expect(report.blockedStepCount).toBe(2);
    expect(report.providerCallCount).toBe(0);
    expect(report.executedActionCount).toBe(0);
    expect(report.backgroundLoopStarted).toBe(false);
    expect(report.fullTextIncluded).toBe(false);
  });

  it("honors max step bounds", () => {
    const report = runPlannerSelfCheck(createFixturePlan(), { maxSteps: 1 });

    expect(report.checkedStepCount).toBe(1);
    expect(report.selfChecks.map((check) => check.stepId)).toEqual([
      "inspect-memory-maintenance",
    ]);
  });

  it("formats reports without private content", () => {
    const summary = formatPlannerSmokeReport(runBuiltInPlannerSmoke());

    expect(summary).toContain("RIN planner smoke report.");
    expect(summary).toContain("Background loop started: no");
    expect(summary).toContain("Executed actions: 0");
    expect(summary).not.toContain("Private memory text");
  });
});
