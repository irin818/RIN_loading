import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { inspectRinDatabase } from "../database";
import { initializeRinStorage, inspectCoreStateFiles } from "../storage";
import { exportAgentStateBundle } from "./export";
import { importAgentStateBundle } from "./import";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("exportAgentStateBundle", () => {
  it("exports config and database state into a local bundle directory", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const bundle = await exportAgentStateBundle(
      storage.layout,
      new Date("2026-05-19T00:00:00.000Z"),
    );

    await expect(stat(bundle.manifestPath)).resolves.toBeTruthy();
    await expect(stat(join(bundle.bundlePath, "config"))).resolves.toBeTruthy();
    await expect(stat(join(bundle.bundlePath, "databases"))).resolves.toBeTruthy();
  });

  it("imports a bundle into a new local data directory without overwriting source data", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const bundle = await exportAgentStateBundle(
      storage.layout,
      new Date("2026-05-19T00:00:00.000Z"),
    );
    const imported = await importAgentStateBundle({
      bundlePath: bundle.bundlePath,
      environment: {
        ...defaultEnvironment,
        deviceId: "new-device",
        dataDir: ".rin-imported-data",
      },
      cwd,
      now: new Date("2026-05-20T00:00:00.000Z"),
    });
    const importedManifest = JSON.parse(
      await readFile(imported.manifestPath, "utf8"),
    ) as { ownerId: string; deviceId: string };
    const importedDatabase = inspectRinDatabase({
      ...storage.layout,
      rootDir: imported.targetDataDir,
      manifestPath: imported.manifestPath,
      directories: {
        ...storage.layout.directories,
        config: join(imported.targetDataDir, "config"),
        databases: join(imported.targetDataDir, "databases"),
        logs: join(imported.targetDataDir, "logs"),
      },
    });
    const coreFiles = await inspectCoreStateFiles({
      ...storage.layout,
      rootDir: imported.targetDataDir,
      manifestPath: imported.manifestPath,
      directories: {
        ...storage.layout.directories,
        config: join(imported.targetDataDir, "config"),
        databases: join(imported.targetDataDir, "databases"),
        logs: join(imported.targetDataDir, "logs"),
      },
    });

    expect(importedManifest.ownerId).toBe(defaultEnvironment.ownerId);
    expect(importedManifest.deviceId).toBe("new-device");
    expect(importedDatabase.schemaVersion).toBe(storage.database.schemaVersion);
    expect(importedDatabase.counts.auditEvents).toBeGreaterThan(
      storage.database.counts.auditEvents,
    );
    expect(coreFiles.every((file) => file.exists)).toBe(true);
  });

  it("refuses to import into a non-empty data directory", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const bundle = await exportAgentStateBundle(storage.layout);

    await expect(
      importAgentStateBundle({
        bundlePath: bundle.bundlePath,
        environment: defaultEnvironment,
        cwd,
      }),
    ).rejects.toThrow("Import target must be a new empty data directory");
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-bundle-"));
  tempRoots.push(root);
  return root;
}
