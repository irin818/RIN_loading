import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { inspectRinDatabase, openRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";
import {
  createMemoryProposal,
  getMemoryCounts,
  listMemoryItems,
  reviewMemoryProposal,
  updateMemoryMetadata,
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
      expect(reviewed.metadata).toMatchObject({
        tags: [],
        importance: "normal",
        confidence: "medium",
        source: null,
        reviewedAt: "2026-05-31T00:01:00.000Z",
        acceptedAt: "2026-05-31T00:01:00.000Z",
      });
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

  it("saves and reloads owner-reviewed metadata without storing full memory text", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);

    try {
      const proposal = createMemoryProposal(database, {
        memoryType: "project",
        content: { text: "Owner private metadata fixture must stay out of metadata." },
        now: new Date("2026-05-31T00:00:00.000Z"),
      });
      const reviewed = reviewMemoryProposal(database, {
        memoryItemId: proposal.id,
        decision: "accept",
        metadata: {
          tags: [" Project Work ", "project work", "RIN!"],
          importance: "high",
          confidence: "medium",
          source: " owner review ",
        },
        now: new Date("2026-05-31T00:01:00.000Z"),
      });
      const reloaded = listMemoryItems(database, { status: "accepted" })[0];
      const metadataRow = database
        .prepare("SELECT metadata_json FROM memory_metadata WHERE memory_id = ?")
        .get(proposal.id) as { metadata_json: string } | undefined;

      expect(reviewed.metadata).toEqual({
        tags: ["project-work", "rin"],
        importance: "high",
        confidence: "medium",
        source: "owner review",
        reviewedAt: "2026-05-31T00:01:00.000Z",
        acceptedAt: "2026-05-31T00:01:00.000Z",
      });
      expect(reloaded?.metadata).toEqual(reviewed.metadata);
      expect(metadataRow?.metadata_json).not.toContain(
        "Owner private metadata fixture",
      );
      expect(inspectRinDatabase(storage.layout).counts.memoryMetadata).toBe(1);
    } finally {
      database.close();
    }
  });

  it("updates metadata for an already reviewed memory", async () => {
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

      const updated = updateMemoryMetadata(database, {
        memoryItemId: proposal.id,
        metadata: {
          tags: ["preference", "local"],
          importance: "low",
          confidence: "high",
          source: null,
        },
        reason: "owner refined metadata",
        now: new Date("2026-05-31T00:02:00.000Z"),
      });

      expect(updated.metadata).toEqual({
        tags: ["preference", "local"],
        importance: "low",
        confidence: "high",
        source: null,
        reviewedAt: "2026-05-31T00:02:00.000Z",
        acceptedAt: "2026-05-31T00:01:00.000Z",
      });
      expect(listMemoryItems(database, { status: "accepted" })[0]?.metadata).toEqual(
        updated.metadata,
      );
    } finally {
      database.close();
    }
  });

  it("rejects invalid metadata values", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);

    try {
      const proposal = createMemoryProposal(database, {
        memoryType: "semantic",
        content: { text: "A controlled memory proposal." },
        now: new Date("2026-05-31T00:00:00.000Z"),
      });

      expect(() =>
        reviewMemoryProposal(database, {
          memoryItemId: proposal.id,
          decision: "accept",
          metadata: {
            importance: "urgent" as never,
          },
          now: new Date("2026-05-31T00:01:00.000Z"),
        }),
      ).toThrow("Invalid memory importance");
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
