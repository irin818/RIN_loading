import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultEnvironment } from "../config/environment";
import { openRinDatabase } from "../database";
import { formatLocalActionsSmokeReport, runLocalActionsSmoke } from "../actions";
import { initializeRinStorage } from "../storage";

const root = join(tmpdir(), `rin-actions-smoke-${Date.now()}`);
const workspaceRoot = join(root, "workspace");

try {
  await mkdir(join(workspaceRoot, "docs"), { recursive: true });
  await writeFile(
    join(workspaceRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "rin-actions-smoke",
        version: "0.0.0",
        private: true,
        scripts: { check: "echo check" },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(join(workspaceRoot, "README.md"), "# Smoke workspace\n", "utf8");
  await writeFile(join(workspaceRoot, "docs/guide.md"), "# Guide\n", "utf8");
  await writeFile(join(workspaceRoot, ".env.local"), "SECRET=value\n", "utf8");
  await mkdir(join(workspaceRoot, "node_modules"), { recursive: true });
  await writeFile(join(workspaceRoot, "node_modules/ignored.txt"), "ignored", "utf8");

  const storage = await initializeRinStorage(defaultEnvironment, { cwd: root });
  const database = openRinDatabase(storage.layout);

  try {
    const report = await runLocalActionsSmoke({
      context: {
        database,
        allowedWorkspaceRoot: workspaceRoot,
        now: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    console.log(formatLocalActionsSmokeReport(report));
    if (report.status !== "ready") {
      process.exitCode = 1;
    }
  } finally {
    database.close();
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
