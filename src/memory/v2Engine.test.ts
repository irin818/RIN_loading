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
import { createMemoryProposal, reviewMemoryProposal } from "./manager";
import { initializeRinStorage } from "../storage";
import {
  formatMemoryV2EvaluationSummary,
  formatMemoryV2ShadowReport,
  runBuiltInMemoryV2Evaluation,
  runMemoryV2ShadowEngine,
} from ".";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("Memory V2 deterministic evaluation", () => {
  it("passes built-in fixtures without provider calls or full text", () => {
    const result = runBuiltInMemoryV2Evaluation();
    const summary = formatMemoryV2EvaluationSummary(result);

    expect(result.failed).toBe(0);
    expect(result.providerCallCount).toBe(0);
    expect(result.fullTextIncluded).toBe(false);
    expect(
      result.caseResults.map((item) => [item.caseId, item.decision]),
    ).toEqual([
      ["preference-promoted", "promoted"],
      ["project-promoted", "promoted"],
      ["contradiction-promoted", "promoted"],
      ["daily-weakened", "weakened"],
      ["low-signal-ignored", "ignored"],
    ]);
    expect(summary).not.toContain("concise RIN progress reports");
    expect(summary).not.toContain("cooked noodles");
  });
});

describe("Memory V2 shadow engine", () => {
  it("writes idempotent shadow traces without raw text", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);
    const now = new Date("2026-06-05T12:00:00.000Z");
    const preferenceText = "I prefer brief private project updates.";
    const lowSignalText = "ok";

    try {
      const conversation = createConversation(
        database,
        "memory v2 shadow test",
        now,
      );
      appendConversationMessage(database, {
        conversationId: conversation.id,
        role: "owner",
        content: preferenceText,
        now: new Date("2026-06-05T11:00:00.000Z"),
      });
      appendConversationMessage(database, {
        conversationId: conversation.id,
        role: "owner",
        content: lowSignalText,
        now: new Date("2026-06-05T11:30:00.000Z"),
      });

      const first = runMemoryV2ShadowEngine(database, { now });
      const firstSummary = formatMemoryV2ShadowReport(first);
      const second = runMemoryV2ShadowEngine(database, { now });

      expect(first.sourceMessageCount).toBe(2);
      expect(first.promotedCount).toBe(1);
      expect(first.ignoredCount).toBe(1);
      expect(second.reinforcedCount).toBe(1);
      expect(second.ignoredCount).toBe(1);
      expect(countRows(database, "memory_v2_trace_sources")).toBe(2);
      expect(countRows(database, "memory_v2_traces")).toBe(2);
      expect(countRows(database, "messages")).toBe(2);
      expect(JSON.stringify(first)).not.toContain(preferenceText);
      expect(firstSummary).not.toContain(preferenceText);
      expect(first.fullTextIncluded).toBe(false);
      expect(first.productionRetrievalChanged).toBe(false);
      expect(first.rawHistoryMutationCount).toBe(0);
      expect(first.acceptedMemoryMutationCount).toBe(0);
      expect(first.profileMutationCount).toBe(0);
      expect(first.providerCallCount).toBe(0);
    } finally {
      database.close();
    }
  });

  it("does not mutate accepted memory records while writing shadow traces", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);
    const now = new Date("2026-06-05T12:00:00.000Z");

    try {
      const conversation = createConversation(database, "memory v2 safety", now);
      const message = appendConversationMessage(database, {
        conversationId: conversation.id,
        role: "owner",
        content: "For RIN_loading, I prefer local-first memory work.",
        now,
      });
      const proposal = createMemoryProposal(database, {
        memoryType: "preference",
        content: { text: "Private accepted memory must not be rewritten." },
        sourceMessageId: message.id,
        now,
      });
      reviewMemoryProposal(database, {
        memoryItemId: proposal.id,
        decision: "accept",
        now,
      });
      const acceptedBefore = countRows(database, "memory_items");

      const report = runMemoryV2ShadowEngine(database, { now });

      expect(countRows(database, "memory_items")).toBe(acceptedBefore);
      expect(report.acceptedMemoryMutationCount).toBe(0);
      expect(report.rawHistoryMutationCount).toBe(0);
      expect(report.profileMutationCount).toBe(0);
      expect(formatMemoryV2ShadowReport(report)).not.toContain(
        "Private accepted memory",
      );
    } finally {
      database.close();
    }
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-memory-v2-engine-"));
  tempRoots.push(root);
  return root;
}

function countRows(database: ReturnType<typeof openRinDatabase>, table: string): number {
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
  return Number((row as { count: number }).count);
}
