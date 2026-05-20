import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { initializeRinStorage } from "../storage";
import { exportAgentStateBundle } from "./export";

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
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-bundle-"));
  tempRoots.push(root);
  return root;
}
