import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultEnvironment } from "../config/environment";
import { openRinDatabase } from "../database";
import {
  formatPlannerExecutionReport,
  PLANNER_EXECUTION_CONFIRMATION_TOKEN,
  runBuiltInPlannerExecutionSmoke,
} from "../planner";
import { initializeRinStorage } from "../storage";

const root = join(tmpdir(), `rin-planner-execution-smoke-${Date.now()}`);
const workspaceRoot = join(root, "workspace");

try {
  await mkdir(join(workspaceRoot, "docs"), { recursive: true });
  await writeFile(
    join(workspaceRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "rin-planner-execution-smoke",
        version: "0.0.0",
        private: true,
        scripts: { check: "echo check" },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(join(workspaceRoot, "README.md"), "# Planner smoke\n", "utf8");
  await writeFile(join(workspaceRoot, "docs/guide.md"), "# Guide\n", "utf8");
  await writeFile(join(workspaceRoot, ".env.local"), "SECRET=value\n", "utf8");

  const storage = await initializeRinStorage(defaultEnvironment, { cwd: root });
  const database = openRinDatabase(storage.layout);

  try {
    const report = await runBuiltInPlannerExecutionSmoke({
      context: {
        database,
        allowedWorkspaceRoot: workspaceRoot,
        now: new Date("2026-01-01T00:00:00.000Z"),
      },
      confirmationToken: PLANNER_EXECUTION_CONFIRMATION_TOKEN,
    });

    console.log(formatPlannerExecutionReport(report));
  } finally {
    database.close();
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
