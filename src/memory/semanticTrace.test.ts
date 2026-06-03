import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { openRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";
import type { MemoryRecord } from "./manager";
import { runHybridRetrievalReport } from "./hybridRetrievalReport";
import { runSemanticAcceptedMemoryIndexReport } from "./semanticAcceptedMemoryIndex";
import {
  formatSemanticTraceList,
  formatSemanticTraceRecord,
  getSemanticTraceRecord,
  listSemanticTraceRecords,
  recordSemanticTrace,
  semanticTraceFromAcceptedMemoryIndexReport,
  semanticTraceFromHybridRetrievalReport,
} from "./semanticTrace";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("semantic trace persistence", () => {
  it("sanitizes accepted-memory index reports for audit storage", async () => {
    const report = await runSemanticAcceptedMemoryIndexReport({
      optIn: true,
      queryText: "private semantic query",
      memories: [
        memory(
          "accepted-private",
          "Private accepted memory text must not be persisted.",
        ),
      ],
    });
    const trace = semanticTraceFromAcceptedMemoryIndexReport(report);
    const serialized = JSON.stringify(trace);

    expect(trace.traceKind).toBe("accepted-memory-index-report");
    expect(trace.semanticCandidateIds).toEqual(["accepted-private"]);
    expect(trace.fullTextIncluded).toBe(false);
    expect(trace.vectorIncluded).toBe(false);
    expect(serialized).not.toContain("Private accepted memory text");
    expect(serialized).not.toContain("private semantic query");
    expect(serialized).not.toContain('"vector":[');
  });

  it("persists and reloads sanitized hybrid traces through audit events", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const report = await runHybridRetrievalReport({
      optIn: true,
      queryText: "local adapter setup",
      memories: [
        memory("deterministic", "local adapter setup"),
        memory("semantic-only", "private semantic only text"),
        memory("pending", "local adapter setup", { status: "proposal" }),
      ],
      semanticCandidateIds: ["semantic-only", "pending"],
    });
    const database = openRinDatabase(storage.layout);

    try {
      const traceId = recordSemanticTrace(database, {
        trace: semanticTraceFromHybridRetrievalReport(report),
        now: new Date("2026-05-22T00:00:00.000Z"),
      });
      const listed = listSemanticTraceRecords(database);
      const reloaded = getSemanticTraceRecord(database, traceId);
      const listedSummary = formatSemanticTraceList(listed);
      const recordSummary = formatSemanticTraceRecord(reloaded);

      expect(listed.map((record) => record.id)).toContain(traceId);
      expect(reloaded?.trace.traceKind).toBe("hybrid-retrieval-report");
      expect(reloaded?.trace.candidateIds).toEqual([
        "deterministic",
        "semantic-only",
      ]);
      expect(reloaded?.trace.acceptedOnlyViolationIds).toEqual(["pending"]);
      expect(recordSummary).toContain("Vector included: no");
      expect(listedSummary).not.toContain("private semantic only text");
      expect(recordSummary).not.toContain("private semantic only text");
      expect(recordSummary).not.toContain("local adapter setup");
    } finally {
      database.close();
    }
  });

  it("returns null for missing trace records", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);

    try {
      expect(getSemanticTraceRecord(database, "missing-trace")).toBeNull();
      expect(formatSemanticTraceRecord(null)).toContain("Status: not_found");
    } finally {
      database.close();
    }
  });
});

function memory(
  id: string,
  text: string,
  overrides: Partial<MemoryRecord> = {},
): MemoryRecord {
  return {
    id,
    memoryType: "semantic",
    content: overrides.content ?? { text },
    metadata: {
      tags: [],
      importance: "normal",
      confidence: "medium",
      source: null,
      reviewedAt: null,
      acceptedAt: null,
    },
    sourceMessageId: null,
    status: overrides.status ?? "accepted",
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z",
    ...overrides,
  };
}

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-semantic-trace-"));
  tempRoots.push(root);
  return root;
}
