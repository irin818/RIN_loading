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
import { runMemoryV2ShadowEngine } from "../memory";
import { initializeRinStorage } from "../storage";
import {
  buildContextV2Report,
  buildContextV2ReportFromStorage,
  formatContextV2EvaluationSummary,
  formatContextV2Report,
  runBuiltInContextV2Evaluation,
  type ContextV2InputSegment,
} from "./contextV2";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("Context V2 evaluation", () => {
  it("passes built-in ordering, budget, and dedup fixtures", () => {
    const result = runBuiltInContextV2Evaluation();
    const summary = formatContextV2EvaluationSummary(result);

    expect(result.failed).toBe(0);
    expect(result.providerCallCount).toBe(0);
    expect(result.fullTextIncluded).toBe(false);
    expect(summary).toContain("Failed case IDs: none");
  });
});

describe("Context V2 report", () => {
  it("preserves latest owner message while dropping optional budget overflow", () => {
    const report = buildContextV2Report(
      [
        segment("system", "system", "system", "system".repeat(20), true),
        segment(
          "current_owner_message",
          "owner-latest",
          "message:latest",
          "latest owner private text",
          true,
        ),
        segment(
          "memory_v2_trace",
          "trace-large",
          "trace:large",
          "optional".repeat(100),
          false,
        ),
      ],
      { maxCharacters: 160 },
    );

    expect(report.latestOwnerMessagePreserved).toBe(true);
    expect(includedIds(report)).toEqual(["system", "owner-latest"]);
    expect(skippedIds(report)).toEqual(["trace-large"]);
    expect(report.segments.find((item) => item.id === "trace-large")?.skipReason)
      .toBe("budget_exceeded");
  });

  it("deduplicates shared provenance sources before formatting", () => {
    const report = buildContextV2Report([
      segment("system", "system", "system", "system", true),
      segment(
        "current_owner_message",
        "owner-latest",
        "message:latest",
        "latest",
        true,
      ),
      segment("short_term_window", "short", "message:dup", "short", false),
      segment("memory_v2_trace", "trace", "message:dup", "trace", false),
    ]);

    expect(includedIds(report)).toEqual(["system", "owner-latest", "short"]);
    expect(skippedIds(report)).toEqual(["trace"]);
    expect(report.segments.find((item) => item.id === "trace")?.skipReason).toBe(
      "duplicate_source",
    );
  });

  it("builds storage-backed reports without full message text", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);
    const now = new Date("2026-06-05T12:00:00.000Z");
    const privateOwnerText = "Private latest owner message must not print.";
    const privateEarlierText = "Private earlier short-term text must not print.";

    try {
      const conversation = createConversation(database, "context v2", now);
      appendConversationMessage(database, {
        conversationId: conversation.id,
        role: "owner",
        content: privateEarlierText,
        now: new Date("2026-06-05T10:00:00.000Z"),
      });
      appendConversationMessage(database, {
        conversationId: conversation.id,
        role: "owner",
        content: privateOwnerText,
        now,
      });
      runMemoryV2ShadowEngine(database, { now });

      const report = await buildContextV2ReportFromStorage(
        database,
        storage.layout,
      );
      const summary = formatContextV2Report(report);

      expect(report.shadowOnly).toBe(true);
      expect(report.productionContextChanged).toBe(false);
      expect(report.latestOwnerMessagePreserved).toBe(true);
      expect(report.providerCallCount).toBe(0);
      expect(report.fullTextIncluded).toBe(false);
      expect(summary).toContain("Production context changed: no");
      expect(summary).not.toContain(privateOwnerText);
      expect(summary).not.toContain(privateEarlierText);
      expect(JSON.stringify(report)).not.toContain(privateOwnerText);
    } finally {
      database.close();
    }
  });
});

function segment(
  type: ContextV2InputSegment["type"],
  id: string,
  sourceId: string,
  content: string,
  isProtected: boolean,
): ContextV2InputSegment {
  return {
    id,
    type,
    sourceId,
    content,
    protected: isProtected,
    provenance: `${type}:${sourceId}`,
  };
}

function includedIds(report: ReturnType<typeof buildContextV2Report>): string[] {
  return report.segments
    .filter((item) => item.included)
    .map((item) => item.id);
}

function skippedIds(report: ReturnType<typeof buildContextV2Report>): string[] {
  return report.segments
    .filter((item) => !item.included)
    .map((item) => item.id);
}

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-context-v2-"));
  tempRoots.push(root);
  return root;
}
