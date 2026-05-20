import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initializeRinStorage } from "./initialize";
import {
  RIN_STORAGE_DIRECTORIES,
  RIN_STORAGE_SCHEMA_VERSION,
} from "./schema";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("initializeRinStorage", () => {
  it("creates a controlled local data layout and manifest", async () => {
    const cwd = await createTempRoot();
    const result = await initializeRinStorage(
      {
        ownerId: "owner-a",
        deviceId: "device-a",
        dataDir: ".rin-test-data",
      },
      {
        cwd,
        now: () => new Date("2026-05-19T00:00:00.000Z"),
      },
    );

    expect(result.created).toBe(true);
    expect(result.manifest.schemaVersion).toBe(RIN_STORAGE_SCHEMA_VERSION);
    expect(result.manifest.ownerId).toBe("owner-a");
    expect(result.manifest.deviceId).toBe("device-a");
    expect(result.coreFiles.every((status) => status.exists)).toBe(true);

    const rootStat = await stat(result.layout.rootDir);
    expect(rootStat.isDirectory()).toBe(true);

    for (const directoryName of RIN_STORAGE_DIRECTORIES) {
      const directoryStat = await stat(result.layout.directories[directoryName]);
      expect(directoryStat.isDirectory()).toBe(true);
    }

    const manifestFile = JSON.parse(
      await readFile(result.layout.manifestPath, "utf8"),
    ) as typeof result.manifest;

    expect(manifestFile).toEqual(result.manifest);
  });

  it("preserves existing owner and device identity on reinitialization", async () => {
    const cwd = await createTempRoot();
    const first = await initializeRinStorage(
      {
        ownerId: "owner-a",
        deviceId: "device-a",
        dataDir: ".rin-test-data",
      },
      {
        cwd,
        now: () => new Date("2026-05-19T00:00:00.000Z"),
      },
    );

    const second = await initializeRinStorage(
      {
        ownerId: "owner-b",
        deviceId: "device-b",
        dataDir: ".rin-test-data",
      },
      {
        cwd,
        now: () => new Date("2026-05-20T00:00:00.000Z"),
      },
    );

    expect(second.created).toBe(false);
    expect(second.manifest.ownerId).toBe(first.manifest.ownerId);
    expect(second.manifest.deviceId).toBe(first.manifest.deviceId);
    expect(second.manifest.createdAt).toBe(first.manifest.createdAt);
    expect(second.manifest.updatedAt).toBe("2026-05-20T00:00:00.000Z");
  });

  it("does not overwrite existing core state files", async () => {
    const cwd = await createTempRoot();
    const first = await initializeRinStorage(
      {
        ownerId: "owner-a",
        deviceId: "device-a",
        dataDir: ".rin-test-data",
      },
      {
        cwd,
        now: () => new Date("2026-05-19T00:00:00.000Z"),
      },
    );
    const identityPath = first.layout.directories.config + "/ai_identity.json";
    const originalIdentity = await readFile(identityPath, "utf8");

    const second = await initializeRinStorage(
      {
        ownerId: "owner-a",
        deviceId: "device-a",
        dataDir: ".rin-test-data",
      },
      {
        cwd,
        now: () => new Date("2026-05-20T00:00:00.000Z"),
      },
    );

    expect(second.coreFiles.find((file) => file.key === "ai-identity")?.created)
      .toBe(false);
    await expect(readFile(identityPath, "utf8")).resolves.toBe(originalIdentity);
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-storage-"));
  tempRoots.push(root);
  return root;
}
