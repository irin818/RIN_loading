import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildActionAuditReport } from "../actions";
import { defaultEnvironment } from "../config/environment";
import { openRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";
import {
  buildPlannerAuditReport,
  PLANNER_EXECUTION_CONFIRMATION_TOKEN,
  runBuiltInPlannerExecutionSmoke,
  runOwnerConfirmedPlannerExecution,
} from "./execution";
import type { PlanState } from "./planner";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("runBuiltInPlannerExecutionSmoke", () => {
  it("requires explicit confirmation before executing allowed local actions", async () => {
    const { database, workspaceRoot } = await createPlannerFixture();

    try {
      const report = await runBuiltInPlannerExecutionSmoke({
        context: { database, allowedWorkspaceRoot: workspaceRoot },
      });

      expect(report).toMatchObject({
        status: "confirmation_required",
        executedActionCount: 0,
        dryRunBeforeExecution: true,
        confirmationTokenSupplied: false,
        providerCallCount: 0,
        backgroundLoopStarted: false,
        fullTextIncluded: false,
      });
      await expect(stat(join(workspaceRoot, "reports/planner-execution-report.md")))
        .rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      database.close();
    }
  });

  it("executes confirmed low-risk actions and blocks destructive actions", async () => {
    const { database, workspaceRoot } = await createPlannerFixture();

    try {
      const report = await runBuiltInPlannerExecutionSmoke({
        context: {
          database,
          allowedWorkspaceRoot: workspaceRoot,
          now: new Date("2026-01-01T00:00:00.000Z"),
        },
        confirmationToken: PLANNER_EXECUTION_CONFIRMATION_TOKEN,
      });
      const actionAudit = buildActionAuditReport(database);
      const plannerAudit = buildPlannerAuditReport(database);
      const reportText = await readFile(
        join(workspaceRoot, "reports/planner-execution-report.md"),
        "utf8",
      );

      expect(report).toMatchObject({
        status: "blocked",
        checkedStepCount: 3,
        completedStepCount: 2,
        blockedStepCount: 1,
        executedActionCount: 2,
        dryRunBeforeExecution: true,
        confirmationTokenSupplied: true,
        backgroundLoopStarted: false,
      });
      expect(report.stepResults.map((step) => step.dryRunStatus)).toEqual([
        "allowed",
        "allowed",
        "blocked",
      ]);
      expect(actionAudit).toMatchObject({
        totalActionAuditEvents: 3,
        completedEvents: 2,
        blockedEvents: 1,
      });
      expect(plannerAudit).toMatchObject({
        totalPlannerAuditEvents: 1,
        blockedEvents: 1,
      });
      expect(reportText).toContain("Planner execution report");
    } finally {
      database.close();
    }
  });

  it("honors finite max step bounds", async () => {
    const { database, workspaceRoot } = await createPlannerFixture();

    try {
      const report = await runBuiltInPlannerExecutionSmoke({
        context: { database, allowedWorkspaceRoot: workspaceRoot },
        confirmationToken: PLANNER_EXECUTION_CONFIRMATION_TOKEN,
        maxSteps: 1,
      });

      expect(report).toMatchObject({
        status: "completed",
        checkedStepCount: 1,
        executedActionCount: 1,
        maxSteps: 1,
        backgroundLoopStarted: false,
      });
      await expect(stat(join(workspaceRoot, "reports/planner-execution-report.md")))
        .rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      database.close();
    }
  });

  it("blocks unsafe action input during dry-run preview before execution", async () => {
    const { database, workspaceRoot } = await createPlannerFixture();
    const plan: PlanState = {
      id: "unsafe-input-plan",
      status: "ready",
      steps: [
        {
          id: "unsafe-write",
          title: "Attempt unsafe report write",
          actionId: "rin.local.report.write",
          actionInput: {
            outputDirectory: "../outside",
            fileName: "unsafe.md",
            title: "Unsafe",
            body: "Should not be written.",
          },
          status: "pending",
        },
      ],
    };

    try {
      const report = await runOwnerConfirmedPlannerExecution(plan, {
        context: { database, allowedWorkspaceRoot: workspaceRoot },
        confirmationToken: PLANNER_EXECUTION_CONFIRMATION_TOKEN,
      });
      const actionAudit = buildActionAuditReport(database);

      expect(report).toMatchObject({
        status: "blocked",
        checkedStepCount: 1,
        blockedStepCount: 1,
        executedActionCount: 0,
        dryRunBeforeExecution: true,
      });
      expect(report.stepResults[0]).toMatchObject({
        dryRunStatus: "blocked",
        executionStatus: "blocked",
        reasons: ["outside_allowed_workspace"],
      });
      expect(actionAudit).toMatchObject({
        totalActionAuditEvents: 1,
        blockedEvents: 1,
      });
      await expect(stat(join(workspaceRoot, "../outside/unsafe.md"))).rejects
        .toMatchObject({ code: "ENOENT" });
    } finally {
      database.close();
    }
  });
});

async function createPlannerFixture(): Promise<{
  database: ReturnType<typeof openRinDatabase>;
  workspaceRoot: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "rin-planner-execution-"));
  tempRoots.push(root);
  const workspaceRoot = join(root, "workspace");

  await mkdir(join(workspaceRoot, "docs"), { recursive: true });
  await writeFile(
    join(workspaceRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "rin-planner-execution-fixture",
        version: "0.0.0",
        private: true,
        scripts: { check: "echo check" },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(join(workspaceRoot, "README.md"), "# Fixture\n", "utf8");
  await writeFile(join(workspaceRoot, "docs/guide.md"), "# Guide\n", "utf8");
  await writeFile(join(workspaceRoot, ".env.local"), "SECRET=value\n", "utf8");

  const storage = await initializeRinStorage(defaultEnvironment, { cwd: root });
  const database = openRinDatabase(storage.layout);

  return { database, workspaceRoot };
}
