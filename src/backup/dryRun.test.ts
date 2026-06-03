import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { initializeRinStorage } from "../storage";
import {
  buildBackupDryRunManifest,
  formatBackupDryRunManifest,
  formatRestoreDryRunReport,
  validateRestoreDryRun,
} from "./dryRun";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("buildBackupDryRunManifest", () => {
  it("reports safe relative files without creating an archive", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    await writeFile(join(storage.layout.rootDir, ".env.local"), "SECRET=value");
    await writeFile(join(storage.layout.directories.logs, "private.log"), "secret log");

    const manifest = await buildBackupDryRunManifest(storage.layout);
    const summary = formatBackupDryRunManifest(manifest);

    expect(manifest.mode).toBe("backup-dry-run");
    expect(manifest.fileCount).toBeGreaterThan(0);
    expect(manifest.archiveCreated).toBe(false);
    expect(manifest.cloudSyncEnabled).toBe(false);
    expect(manifest.secretsIncluded).toBe(false);
    expect(manifest.fullTextIncluded).toBe(false);
    expect(manifest.files.map((file) => file.relativePath)).toContain(
      "manifest.json",
    );
    expect(manifest.files.some((file) => file.relativePath.includes(".env"))).toBe(
      false,
    );
    expect(manifest.files.some((file) => file.relativePath.startsWith("logs/"))).toBe(
      false,
    );
    expect(summary).not.toContain(storage.layout.rootDir);
    expect(summary).not.toContain("SECRET=value");
  });
});

describe("validateRestoreDryRun", () => {
  it("validates a backup manifest without mutating data", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const manifest = await buildBackupDryRunManifest(storage.layout);
    const manifestPath = join(cwd, "backup-manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const report = await validateRestoreDryRun({ manifestPath });
    const summary = formatRestoreDryRunReport(report);

    expect(report.status).toBe("valid");
    expect(report.dataMutated).toBe(false);
    expect(report.cloudSyncEnabled).toBe(false);
    expect(report.secretsIncluded).toBe(false);
    expect(summary).toContain("Data mutated: no");
  });

  it("reports missing, invalid, and overwrite-risk states safely", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const manifest = await buildBackupDryRunManifest(storage.layout);
    const manifestPath = join(cwd, "backup-manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    const invalidPath = join(cwd, "invalid.json");
    await writeFile(invalidPath, "{}");

    await expect(validateRestoreDryRun({})).resolves.toMatchObject({
      status: "missing_manifest",
      dataMutated: false,
    });
    await expect(validateRestoreDryRun({ manifestPath: invalidPath })).resolves
      .toMatchObject({
        status: "invalid_manifest",
        dataMutated: false,
      });
    await expect(
      validateRestoreDryRun({ manifestPath, targetLayout: storage.layout }),
    ).resolves.toMatchObject({
      status: "overwrite_risk",
      overwriteWouldOccur: true,
      dataMutated: false,
    });
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-backup-"));
  tempRoots.push(root);
  return root;
}
