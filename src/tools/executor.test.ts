import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { inspectRinDatabase, openRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";
import { executeRegisteredTool } from "./executor";
import { registerBuiltinTools } from "./builtin";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("executeRegisteredTool", () => {
  it("executes only registered low-risk tools and audits the call", async () => {
    registerBuiltinTools();
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);

    try {
      const result = await executeRegisteredTool(
        database,
        "rin.local.status",
        {},
        new Date("2026-05-19T00:00:00.000Z"),
      );

      expect(result.status).toBe("completed");
    } finally {
      database.close();
    }

    const status = inspectRinDatabase(storage.layout);
    expect(status.counts.toolInvocations).toBe(1);
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-tool-"));
  tempRoots.push(root);
  return root;
}
