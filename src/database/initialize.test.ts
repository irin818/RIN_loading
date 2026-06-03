import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { initializeRinStorage } from "../storage";
import {
  initializeRinDatabase,
  inspectRinDatabase,
  RIN_DATABASE_SCHEMA_VERSION,
  RIN_DATABASE_TABLES,
} from ".";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("initializeRinDatabase", () => {
  it("creates the SQLite foundation tables and migration record", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const status = await initializeRinDatabase(
      storage.layout,
      new Date("2026-05-19T00:00:00.000Z"),
    );

    expect(status.schemaVersion).toBe(RIN_DATABASE_SCHEMA_VERSION);
    expect(status.appliedMigrations).toEqual([1, 2, 3, 4]);
    expect(status.tables.map((table) => table.name)).toEqual(
      Array.from(RIN_DATABASE_TABLES),
    );
    expect(status.tables.every((table) => table.exists)).toBe(true);
    expect(status.counts.conversations).toBe(0);
    expect(status.counts.messages).toBe(0);
    expect(status.counts.messageMemoryContexts).toBe(0);
    expect(status.counts.memoryItems).toBe(0);
    expect(status.counts.memoryMetadata).toBe(0);
    expect(status.counts.auditEvents).toBeGreaterThan(0);
  });

  it("is idempotent for migrations", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });

    await initializeRinDatabase(storage.layout);
    await initializeRinDatabase(storage.layout);
    const status = inspectRinDatabase(storage.layout);

    expect(status.appliedMigrations).toEqual([1, 2, 3, 4]);
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-database-"));
  tempRoots.push(root);
  return root;
}
