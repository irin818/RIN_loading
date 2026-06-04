import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { inspectRinDatabase, openRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";
import {
  buildActionAuditReport,
  executeLocalAction,
  registerBuiltinLocalActions,
  runLocalActionsSmoke,
} from "./localActions";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("executeLocalAction", () => {
  it("executes low-risk local read and draft-write actions with audits", async () => {
    registerBuiltinLocalActions();
    const { database, storage, workspaceRoot } = await createActionFixture();

    try {
      const status = await executeLocalAction({
        actionId: "rin.project.status.read",
        context: { database, allowedWorkspaceRoot: workspaceRoot },
      });
      const files = await executeLocalAction({
        actionId: "rin.workspace.safe-files.list",
        actionInput: { maxFiles: 20 },
        context: { database, allowedWorkspaceRoot: workspaceRoot },
      });
      const report = await executeLocalAction({
        actionId: "rin.local.report.write",
        actionInput: {
          outputDirectory: "reports",
          fileName: "daily-report.md",
          title: "Daily Report",
          body: "Safe local draft report.",
        },
        context: { database, allowedWorkspaceRoot: workspaceRoot },
      });

      expect(status).toMatchObject({
        status: "completed",
        executed: true,
        fullTextIncluded: false,
      });
      expect(files.output?.files).toContain("docs/guide.md");
      expect(files.output?.files).not.toContain(".env.local");
      expect(files.output?.files).not.toContain("node_modules/ignored.txt");
      expect(report).toMatchObject({
        status: "completed",
        executed: true,
        output: {
          relativePath: "reports/daily-report.md",
          fullTextIncluded: false,
        },
      });
      await expect(stat(join(workspaceRoot, "reports/daily-report.md"))).resolves
        .toMatchObject({ size: expect.any(Number) });
    } finally {
      database.close();
    }

    const status = inspectRinDatabase(storage.layout);
    expect(status.counts.auditEvents).toBeGreaterThanOrEqual(4);
  });

  it("blocks unknown, destructive, secret, outside, and overwrite actions", async () => {
    registerBuiltinLocalActions();
    const { database, workspaceRoot } = await createActionFixture();

    try {
      await writeFile(join(workspaceRoot, "reports/existing.md"), "exists", "utf8");

      const unknown = await executeLocalAction({
        actionId: "rin.unknown.action",
        context: { database, allowedWorkspaceRoot: workspaceRoot },
      });
      const destructive = await executeLocalAction({
        actionId: "rin.files.delete",
        actionInput: { relativePath: "README.md" },
        context: { database, allowedWorkspaceRoot: workspaceRoot },
      });
      const secret = await executeLocalAction({
        actionId: "rin.docs.file.read",
        actionInput: { relativePath: ".env.local" },
        context: { database, allowedWorkspaceRoot: workspaceRoot },
      });
      const outside = await executeLocalAction({
        actionId: "rin.local.note.write",
        actionInput: {
          outputDirectory: "../outside",
          fileName: "note.md",
          title: "Note",
          body: "Should not write.",
        },
        context: { database, allowedWorkspaceRoot: workspaceRoot },
      });
      const overwrite = await executeLocalAction({
        actionId: "rin.local.note.write",
        actionInput: {
          outputDirectory: "reports",
          fileName: "existing.md",
          title: "Note",
          body: "Should not overwrite.",
        },
        context: { database, allowedWorkspaceRoot: workspaceRoot },
      });

      expect(unknown.decision.reasons).toEqual(["unknown_action"]);
      expect(destructive.decision.reasons).toEqual(["destructive_action"]);
      expect(secret.decision.reasons).toEqual(["secret_path"]);
      expect(outside.decision.reasons).toEqual(["outside_allowed_workspace"]);
      expect(overwrite.decision.reasons).toEqual(["target_exists"]);
      for (const result of [unknown, destructive, secret, outside, overwrite]) {
        expect(result.status).toBe("blocked");
        expect(result.executed).toBe(false);
      }
      await expect(stat(join(workspaceRoot, "../outside/note.md"))).rejects
        .toMatchObject({ code: "ENOENT" });
      await expect(readFile(join(workspaceRoot, "reports/existing.md"), "utf8"))
        .resolves.toBe("exists");
    } finally {
      database.close();
    }
  });
});

describe("runLocalActionsSmoke", () => {
  it("runs a bounded smoke flow and reports safe audit counts", async () => {
    const { database, workspaceRoot } = await createActionFixture();

    try {
      const report = await runLocalActionsSmoke({
        context: { database, allowedWorkspaceRoot: workspaceRoot },
      });
      const auditReport = buildActionAuditReport(database);

      expect(report).toMatchObject({
        status: "ready",
        executedActions: 4,
        blockedActions: 2,
        requiresConfirmationActions: 0,
        externalNetworkUsed: false,
        fullTextIncluded: false,
      });
      expect(auditReport).toMatchObject({
        totalActionAuditEvents: 6,
        completedEvents: 4,
        blockedEvents: 2,
        fullTextIncluded: false,
      });
    } finally {
      database.close();
    }
  });
});

async function createActionFixture(): Promise<{
  storage: Awaited<ReturnType<typeof initializeRinStorage>>;
  database: ReturnType<typeof openRinDatabase>;
  workspaceRoot: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "rin-local-actions-"));
  tempRoots.push(root);
  const workspaceRoot = join(root, "workspace");

  await mkdir(join(workspaceRoot, "docs"), { recursive: true });
  await mkdir(join(workspaceRoot, "reports"), { recursive: true });
  await mkdir(join(workspaceRoot, "node_modules"), { recursive: true });
  await writeFile(
    join(workspaceRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "rin-local-actions-fixture",
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
  await writeFile(join(workspaceRoot, "node_modules/ignored.txt"), "ignored", "utf8");

  const storage = await initializeRinStorage(defaultEnvironment, { cwd: root });
  const database = openRinDatabase(storage.layout);

  return { storage, database, workspaceRoot };
}
