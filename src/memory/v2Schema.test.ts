import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import {
  appendConversationMessage,
  createConversation,
} from "../conversation/repository";
import {
  initializeRinDatabase,
  inspectRinDatabase,
  openRinDatabase,
} from "../database";
import { initializeRinStorage } from "../storage";
import {
  buildMemoryV2SchemaReport,
  buildShortTermMemoryReport,
  formatMemoryV2SchemaReport,
  formatShortTermMemoryReport,
} from ".";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("Memory V2 shadow schema", () => {
  it("creates additive shadow tables and remains idempotent", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });

    await initializeRinDatabase(storage.layout);
    await initializeRinDatabase(storage.layout);
    const status = inspectRinDatabase(storage.layout);

    expect(status.schemaVersion).toBe(6);
    expect(status.appliedMigrations).toEqual([1, 2, 3, 4, 5, 6]);
    expect(
      status.tables
        .filter((table) => table.name.startsWith("memory_v2_"))
        .map((table) => [table.name, table.exists, table.rowCount]),
    ).toEqual([
      ["memory_v2_trace_sources", true, 0],
      ["memory_v2_traces", true, 0],
      ["memory_v2_trace_signals", true, 0],
      ["memory_v2_retrieval_events", true, 0],
    ]);
  });

  it("reports schema status with legacy cutover support", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);

    try {
      const report = buildMemoryV2SchemaReport(database);
      const summary = formatMemoryV2SchemaReport(report);

      expect(report.status).toBe("ready");
      expect(report.shadowOnly).toBe(false);
      expect(report.productionRetrievalChanged).toBe(true);
      expect(report.legacyMigrationSupported).toBe(true);
      expect(report.productionRetrievalPath).toBe(
        "memory-v2-legacy-traces-after-migration",
      );
      expect(report.providerCallCount).toBe(0);
      expect(report.fullTextIncluded).toBe(false);
      expect(summary).toContain("memory_v2_trace_sources");
      expect(summary).toContain("Production retrieval changed: yes");
      expect(summary).toContain("Legacy migration supported: yes");
    } finally {
      database.close();
    }
  });
});

describe("short-term memory report", () => {
  it("builds a five-hour message-reference window without raw text", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);
    const now = new Date("2026-06-05T12:00:00.000Z");
    const oldPrivateText =
      "Private old short-term memory text must not appear.";
    const boundaryPrivateText =
      "Private boundary short-term memory text must not appear.";
    const recentPrivateText =
      "Private recent RIN reply text must not appear.";

    try {
      const conversation = createConversation(
        database,
        "private short term report",
        new Date("2026-06-05T06:59:00.000Z"),
      );
      appendConversationMessage(database, {
        conversationId: conversation.id,
        role: "owner",
        content: oldPrivateText,
        now: new Date("2026-06-05T06:59:00.000Z"),
      });
      const boundaryMessage = appendConversationMessage(database, {
        conversationId: conversation.id,
        role: "owner",
        content: boundaryPrivateText,
        now: new Date("2026-06-05T07:00:00.000Z"),
      });
      const recentMessage = appendConversationMessage(database, {
        conversationId: conversation.id,
        role: "rin",
        content: recentPrivateText,
        modelAdapter: "rin-mock-local",
        now: new Date("2026-06-05T10:30:00.000Z"),
      });

      const report = buildShortTermMemoryReport(database, { now });
      const summary = formatShortTermMemoryReport(report);

      expect(report.windowHours).toBe(5);
      expect(report.windowStartedAt).toBe("2026-06-05T07:00:00.000Z");
      expect(report.sourceMessageCount).toBe(2);
      expect(report.includedMessageCount).toBe(2);
      expect(report.conversationCount).toBe(1);
      expect(report.roleCounts).toEqual({ owner: 1, rin: 1, system: 0 });
      expect(report.messages.map((message) => message.messageId)).toEqual([
        boundaryMessage.id,
        recentMessage.id,
      ]);
      expect(report.messages[0]?.contentCharacterCount).toBe(
        boundaryPrivateText.length,
      );
      expect(report.messages[1]?.modelAdapterPresent).toBe(true);
      expect(report.traceSignalCount).toBe(0);
      expect(report.fullTextIncluded).toBe(false);
      expect(report.providerCallCount).toBe(0);
      expect(report.productionRetrievalChanged).toBe(false);
      expect(report.mutatedMemoryCount).toBe(0);
      expect(JSON.stringify(report)).not.toContain("Private");
      expect(summary).not.toContain(oldPrivateText);
      expect(summary).not.toContain(boundaryPrivateText);
      expect(summary).not.toContain(recentPrivateText);
      expect(summary).toContain("Full text included: no");
    } finally {
      database.close();
    }
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-memory-v2-"));
  tempRoots.push(root);
  return root;
}
