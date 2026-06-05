import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import {
  appendConversationMessage,
  createConversation,
} from "../conversation/repository";
import { openRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";
import {
  applyMemoryV2LegacyMigration,
  buildMemoryV2LegacyMigrationDryRunReport,
  buildMemoryV2LegacyMigrationStatusReport,
  createMemoryProposal,
  formatMemoryV2LegacyMigrationReport,
  getMemoryV2ProductionCandidateMemories,
  listMemoryItems,
  retrieveAcceptedMemoriesViaMemoryV2,
  retrieveAcceptedMemoriesWithExplanation,
  reviewMemoryProposal,
  updateMemoryMetadata,
} from ".";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("Memory V2 legacy migration", () => {
  it("builds a dry-run report without mutating Memory V2 tables or printing text", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);
    const now = new Date("2026-06-05T12:00:00.000Z");
    const privateText = "Owner prefers private local Qwen memory handoff.";

    try {
      const memoryId = seedAcceptedMemory(database, privateText, now);
      const beforeSources = countRows(database, "memory_v2_trace_sources");
      const beforeTraces = countRows(database, "memory_v2_traces");

      const report = buildMemoryV2LegacyMigrationDryRunReport(database);
      const summary = formatMemoryV2LegacyMigrationReport(report);

      expect(report.status).toBe("needs_apply");
      expect(report.dryRunOnly).toBe(true);
      expect(report.applied).toBe(false);
      expect(report.legacyAcceptedMemoryCount).toBe(1);
      expect(report.pendingLegacyMemoryIds).toEqual([memoryId]);
      expect(report.rawHistoryMutationCount).toBe(0);
      expect(report.acceptedMemoryMutationCount).toBe(0);
      expect(report.profileMutationCount).toBe(0);
      expect(report.providerCallCount).toBe(0);
      expect(report.fullTextIncluded).toBe(false);
      expect(summary).not.toContain(privateText);
      expect(JSON.stringify(report)).not.toContain(privateText);
      expect(countRows(database, "memory_v2_trace_sources")).toBe(beforeSources);
      expect(countRows(database, "memory_v2_traces")).toBe(beforeTraces);
    } finally {
      database.close();
    }
  });

  it("applies idempotent retrieval traces while preserving legacy and raw rows", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);
    const now = new Date("2026-06-05T12:00:00.000Z");
    const privateText = "Owner prefers local Ollama package testing.";

    try {
      seedAcceptedMemory(database, privateText, now);
      seedRejectedMemory(database, privateText, now);
      const conversation = createConversation(database, "raw history", now);
      appendConversationMessage(database, {
        conversationId: conversation.id,
        role: "owner",
        content: "Raw message text must remain untouched.",
        now,
      });
      const memoryItemsBefore = countRows(database, "memory_items");
      const messagesBefore = countRows(database, "messages");

      const first = applyMemoryV2LegacyMigration(database, now);
      const second = applyMemoryV2LegacyMigration(database, now);
      const status = buildMemoryV2LegacyMigrationStatusReport(database);
      const storedSummary = database
        .prepare(
          `
            SELECT signal_summary_json
            FROM memory_v2_traces
            WHERE trace_kind = 'retrieval_candidate'
            LIMIT 1
          `,
        )
        .get() as { signal_summary_json: string };

      expect(first.applied).toBe(true);
      expect(first.newlyMigratedLegacyMemoryCount).toBe(1);
      expect(second.newlyMigratedLegacyMemoryCount).toBe(0);
      expect(status.status).toBe("ready");
      expect(status.productionRetrievalSource).toBe("memory-v2-legacy-traces");
      expect(countRows(database, "memory_items")).toBe(memoryItemsBefore);
      expect(countRows(database, "messages")).toBe(messagesBefore);
      expect(countRows(database, "memory_v2_trace_sources")).toBe(1);
      expect(countRows(database, "memory_v2_traces")).toBe(1);
      expect(countRows(database, "memory_v2_trace_signals")).toBe(1);
      expect(storedSummary.signal_summary_json).not.toContain(privateText);
      expect(formatMemoryV2LegacyMigrationReport(status)).not.toContain(privateText);
    } finally {
      database.close();
    }
  });

  it("returns Memory V2 production candidates with legacy retrieval parity", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);
    const now = new Date("2026-06-05T12:00:00.000Z");

    try {
      const memoryId = seedAcceptedMemory(
        database,
        "Owner prefers local Qwen package progress reports.",
        now,
      );
      seedAcceptedMemory(database, "Owner enjoys unrelated weekend hiking.", now);
      seedRejectedMemory(database, "Owner prefers local Qwen package reports.", now);

      const fallback = getMemoryV2ProductionCandidateMemories(database);
      expect(fallback.retrievalSource).toBe(
        "legacy-fallback-until-migration-complete",
      );

      applyMemoryV2LegacyMigration(database, now);

      const candidates = getMemoryV2ProductionCandidateMemories(database);
      const legacy = retrieveAcceptedMemoriesWithExplanation(
        listMemoryItems(database, { status: "accepted", limit: 50 }),
        "Which local Qwen package reports should RIN remember?",
      );
      const viaV2 = retrieveAcceptedMemoriesViaMemoryV2(
        database,
        "Which local Qwen package reports should RIN remember?",
      );

      expect(candidates.retrievalSource).toBe("memory-v2-legacy-traces");
      expect(candidates.memories.map((item) => item.id)).toContain(memoryId);
      expect(viaV2.retrievalSource).toBe("memory-v2-legacy-traces");
      expect(viaV2.snippets.map((item) => item.id)).toEqual(
        legacy.snippets.map((item) => item.id),
      );
      expect(viaV2.snippets.map((item) => item.id)).toContain(memoryId);
      expect(viaV2.pendingLegacyMemoryCount).toBe(0);
    } finally {
      database.close();
    }
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-memory-v2-legacy-"));
  tempRoots.push(root);
  return root;
}

function seedAcceptedMemory(
  database: ReturnType<typeof openRinDatabase>,
  text: string,
  now: Date,
): string {
  const proposal = createMemoryProposal(database, {
    memoryType: "preference",
    content: { text },
    now,
  });
  const accepted = reviewMemoryProposal(database, {
    memoryItemId: proposal.id,
    decision: "accept",
    now,
  });

  updateMemoryMetadata(database, {
    memoryItemId: accepted.id,
    metadata: {
      tags: ["local", "qwen"],
      importance: "high",
      confidence: "high",
      source: "test",
    },
    now,
  });

  return proposal.id;
}

function seedRejectedMemory(
  database: ReturnType<typeof openRinDatabase>,
  text: string,
  now: Date,
): string {
  const proposal = createMemoryProposal(database, {
    memoryType: "preference",
    content: { text },
    now,
  });
  reviewMemoryProposal(database, {
    memoryItemId: proposal.id,
    decision: "reject",
    now,
  });

  return proposal.id;
}

function countRows(
  database: ReturnType<typeof openRinDatabase>,
  table: string,
): number {
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
  return Number((row as { count: number }).count);
}
