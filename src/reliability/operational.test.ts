import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";
import {
  buildIntegrityCheckReport,
  buildOpsHealthReport,
  buildRecoverySmokeReport,
  formatIntegrityCheckReport,
  formatOpsHealthReport,
  formatRecoverySmokeReport,
} from "./operational";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("reliability operational reports", () => {
  it("reports storage and database integrity without automatic repair", async () => {
    const layout = await createInitializedLayout();
    const report = await buildIntegrityCheckReport(layout);
    const summary = formatIntegrityCheckReport(report);

    expect(report.status).toBe("ready");
    expect(report.manifestPresent).toBe(true);
    expect(report.manifestValid).toBe(true);
    expect(report.databasePresent).toBe(true);
    expect(report.databaseInspectable).toBe(true);
    expect(report.missingTables).toEqual([]);
    expect(report.automaticRepairApplied).toBe(false);
    expect(report.dataMutated).toBe(false);
    expect(report.providerCallCount).toBe(0);
    expect(report.fullTextIncluded).toBe(false);
    expect(summary).not.toContain(layout.rootDir);
  });

  it("runs backup and restore smoke checks without destructive actions", async () => {
    const layout = await createInitializedLayout();
    const report = await buildRecoverySmokeReport(layout);
    const summary = formatRecoverySmokeReport(report);

    expect(report.status).toBe("ready");
    expect(report.backupDryRunStatus).toBe("ready");
    expect(report.restoreDryRunStatus).toBe("missing_manifest");
    expect(report.restoreWouldOverwrite).toBe(false);
    expect(report.automaticRepairApplied).toBe(false);
    expect(report.dataMutated).toBe(false);
    expect(report.destructiveActionAttempted).toBe(false);
    expect(report.providerCallCount).toBe(0);
    expect(report.fullTextIncluded).toBe(false);
    expect(summary).not.toContain(layout.rootDir);
  });

  it("summarizes ops health without hiding errors or calling providers", async () => {
    const cwd = await createTempRoot();
    const envSource = {
      RIN_DATA_DIR: ".rin-test-data",
      RIN_OWNER_ID: "owner-a",
      RIN_DEVICE_ID: "device-a",
    };
    const storage = await initializeRinStorage(
      {
        ownerId: "owner-a",
        deviceId: "device-a",
        dataDir: ".rin-test-data",
      },
      { cwd, now: () => new Date("2026-06-05T00:00:00.000Z") },
    );
    await initializeRinDatabase(
      storage.layout,
      new Date("2026-06-05T00:00:00.000Z"),
    );

    const report = await buildOpsHealthReport(cwd, envSource);
    const summary = formatOpsHealthReport(report);

    expect(report.status).toBe("ready");
    expect(report.readinessOk).toBe(true);
    expect(report.integrityStatus).toBe("ready");
    expect(report.recoveryStatus).toBe("ready");
    expect(report.hiddenErrorsSuppressed).toBe(false);
    expect(report.automaticRepairApplied).toBe(false);
    expect(report.dataMutated).toBe(false);
    expect(report.providerCallCount).toBe(0);
    expect(report.fullTextIncluded).toBe(false);
    expect(summary).not.toContain(cwd);
  });
});

async function createInitializedLayout() {
  const cwd = await createTempRoot();
  const storage = await initializeRinStorage(
    {
      ownerId: "owner-a",
      deviceId: "device-a",
      dataDir: ".rin-test-data",
    },
    { cwd, now: () => new Date("2026-06-05T00:00:00.000Z") },
  );
  await initializeRinDatabase(
    storage.layout,
    new Date("2026-06-05T00:00:00.000Z"),
  );
  return storage.layout;
}

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-reliability-"));
  tempRoots.push(root);
  return root;
}
