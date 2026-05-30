import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { openRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";
import {
  createMemoryProposal,
  getMemoryCounts,
  listMemoryItems,
  reviewMemoryProposal,
} from "./manager";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("memory proposal review", () => {
  it("accepts a memory proposal without allowing a direct overwrite path", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);

    try {
      const proposal = createMemoryProposal(database, {
        memoryType: "preference",
        content: { text: "Owner prefers controlled memory review." },
        now: new Date("2026-05-31T00:00:00.000Z"),
      });
      const reviewed = reviewMemoryProposal(database, {
        memoryItemId: proposal.id,
        decision: "accept",
        reason: "owner reviewed",
        now: new Date("2026-05-31T00:01:00.000Z"),
      });
      const counts = getMemoryCounts(database);

      expect(reviewed.status).toBe("accepted");
      expect(reviewed.updatedAt).toBe("2026-05-31T00:01:00.000Z");
      expect(counts.proposals).toBe(0);
      expect(counts.accepted).toBe(1);
      expect(listMemoryItems(database, { status: "accepted" })[0]?.id).toBe(
        proposal.id,
      );
    } finally {
      database.close();
    }
  });

  it("does not accept a memory item twice", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);

    try {
      const proposal = createMemoryProposal(database, {
        memoryType: "semantic",
        content: { text: "A controlled memory proposal." },
        now: new Date("2026-05-31T00:00:00.000Z"),
      });

      reviewMemoryProposal(database, {
        memoryItemId: proposal.id,
        decision: "accept",
        now: new Date("2026-05-31T00:01:00.000Z"),
      });

      expect(() =>
        reviewMemoryProposal(database, {
          memoryItemId: proposal.id,
          decision: "accept",
          now: new Date("2026-05-31T00:02:00.000Z"),
        }),
      ).toThrow("Only memory proposals can be accepted");
    } finally {
      database.close();
    }
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-memory-"));
  tempRoots.push(root);
  return root;
}
