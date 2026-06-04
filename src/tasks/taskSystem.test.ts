import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { appendAuditEvent, openRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";
import {
  buildTaskAuditReport,
  createFixtureTask,
  formatTaskAuditReport,
  formatTaskSmokeReport,
  runBoundedTaskSmoke,
} from "./taskSystem";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("bounded task system", () => {
  it("runs a finite dry-run task loop with checkpoint and permission gates", () => {
    const report = runBoundedTaskSmoke({ task: createFixtureTask(), maxSteps: 3 });
    const summary = formatTaskSmokeReport(report);

    expect(report.checkedStepCount).toBe(3);
    expect(report.completedStepCount).toBe(1);
    expect(report.blockedStepCount).toBe(1);
    expect(report.ownerCheckpointCount).toBe(1);
    expect(report.plannerExecutorCheckerSeparated).toBe(true);
    expect(report.backgroundLoopStarted).toBe(false);
    expect(report.executedActionCount).toBe(0);
    expect(report.mutatedMemoryCount).toBe(0);
    expect(report.providerCallCount).toBe(0);
    expect(report.fullTextIncluded).toBe(false);
    expect(summary).toContain("owner-checkpoint");
    expect(summary).not.toContain("RIN task external provider response");
  });

  it("respects max step bounds", () => {
    const report = runBoundedTaskSmoke({ maxSteps: 1 });

    expect(report.checkedStepCount).toBe(1);
    expect(report.maxSteps).toBe(1);
    expect(report.backgroundLoopStarted).toBe(false);
    expect(report.executedActionCount).toBe(0);
  });

  it("summarizes task audit events without payload text", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);

    try {
      appendAuditEvent(database, {
        eventType: "task.blocked",
        payload: { detail: "private task detail", path: "/private/path" },
      });
      appendAuditEvent(database, {
        eventType: "task.owner_checkpoint_required",
        payload: { prompt: "do-not-print" },
      });

      const report = buildTaskAuditReport(database);
      const summary = formatTaskAuditReport(report);

      expect(report.totalTaskAuditEvents).toBe(2);
      expect(report.blockedEvents).toBe(1);
      expect(report.checkpointEvents).toBe(1);
      expect(report.providerCallCount).toBe(0);
      expect(report.fullTextIncluded).toBe(false);
      expect(summary).not.toContain("private task detail");
      expect(summary).not.toContain("/private/path");
      expect(summary).not.toContain("do-not-print");
    } finally {
      database.close();
    }
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-task-system-"));
  tempRoots.push(root);
  return root;
}
