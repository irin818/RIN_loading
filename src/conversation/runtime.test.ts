import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { inspectRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";
import { processOwnerMessage } from "./runtime";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("processOwnerMessage", () => {
  it("creates a local conversation turn through the mock model adapter", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const turn = await processOwnerMessage(storage.layout, {
      ownerId: defaultEnvironment.ownerId,
      content: "RIN, confirm local conversation template.",
      now: new Date("2026-05-19T00:00:00.000Z"),
    });
    const database = inspectRinDatabase(storage.layout);

    expect(turn.conversation.title).toContain("RIN, confirm");
    expect(turn.ownerMessage.role).toBe("owner");
    expect(turn.rinMessage.role).toBe("rin");
    expect(turn.rinMessage.modelAdapter).toBe("rin-mock-local");
    expect(turn.rinMessage.content).toContain("without calling an external model");
    expect(database.counts.conversations).toBe(1);
    expect(database.counts.messages).toBe(2);
    expect(database.counts.memoryItems).toBe(0);
  });

  it("rejects empty owner messages", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });

    await expect(
      processOwnerMessage(storage.layout, {
        ownerId: defaultEnvironment.ownerId,
        content: "   ",
      }),
    ).rejects.toThrow("Owner message cannot be empty.");
  });

  it("creates memory proposals without accepting long-term memory", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });

    await processOwnerMessage(storage.layout, {
      ownerId: defaultEnvironment.ownerId,
      content: "/remember RIN should keep local identity separate from models.",
      now: new Date("2026-05-19T00:00:00.000Z"),
    });

    const database = inspectRinDatabase(storage.layout);

    expect(database.counts.memoryItems).toBe(1);
    expect(database.counts.rawEvents).toBeGreaterThanOrEqual(2);
    expect(database.counts.stateHistory).toBe(1);
    expect(database.counts.slowVariableVersions).toBeGreaterThan(0);
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-conversation-"));
  tempRoots.push(root);
  return root;
}
