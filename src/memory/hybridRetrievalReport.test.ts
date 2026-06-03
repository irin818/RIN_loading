import { describe, expect, it } from "vitest";
import type { MemoryRecord } from "./manager";
import {
  formatHybridRetrievalReport,
  runHybridRetrievalReport,
} from "./hybridRetrievalReport";

describe("runHybridRetrievalReport", () => {
  it("stays disabled by default without reading memories", async () => {
    let loadCount = 0;
    const report = await runHybridRetrievalReport({
      optIn: false,
      queryText: "semantic report",
      loadMemories: () => {
        loadCount += 1;
        return [memory("not-read", "semantic report")];
      },
    });

    expect(loadCount).toBe(0);
    expect(report).toMatchObject({
      status: "disabled",
      enabled: false,
      optInSatisfied: false,
      providerCallCount: 0,
      contextInjectionEnabled: false,
      productionIntegrationEnabled: false,
      fullTextIncluded: false,
      errorCode: "HYBRID_RETRIEVAL_DISABLED",
    });
  });

  it("reports deterministic, semantic-only, deterministic-only, and overlap IDs", async () => {
    const report = await runHybridRetrievalReport({
      optIn: true,
      queryText: "local adapter setup",
      memories: [
        memory("deterministic-overlap", "local adapter setup"),
        memory("deterministic-only", "local adapter"),
        memory("semantic-only", "morning routine"),
      ],
      semanticCandidateIds: ["deterministic-overlap", "semantic-only"],
      expectedCandidateIds: [
        "deterministic-overlap",
        "deterministic-only",
        "semantic-only",
      ],
    });

    expect(report.status).toBe("ready");
    expect(report.deterministicCandidateIds).toEqual([
      "deterministic-overlap",
      "deterministic-only",
    ]);
    expect(report.semanticCandidateIds).toEqual([
      "deterministic-overlap",
      "semantic-only",
    ]);
    expect(report.hybridCandidateIds).toEqual([
      "deterministic-overlap",
      "deterministic-only",
      "semantic-only",
    ]);
    expect(report.semanticOnlyCandidateIds).toEqual(["semantic-only"]);
    expect(report.deterministicOnlyCandidateIds).toEqual(["deterministic-only"]);
    expect(report.overlapCandidateIds).toEqual(["deterministic-overlap"]);
    expect(report.falsePositiveIds).toEqual([]);
    expect(report.falseNegativeIds).toEqual([]);
  });

  it("excludes and flags non-accepted semantic candidates", async () => {
    const report = await runHybridRetrievalReport({
      optIn: true,
      queryText: "accepted boundary",
      memories: [
        memory("accepted-boundary", "accepted boundary"),
        memory("pending-boundary", "accepted boundary", { status: "proposal" }),
      ],
      semanticCandidateIds: ["accepted-boundary", "pending-boundary"],
    });

    expect(report.semanticCandidateIds).toEqual(["accepted-boundary"]);
    expect(report.hybridCandidateIds).toEqual(["accepted-boundary"]);
    expect(report.acceptedOnlyViolationIds).toEqual(["pending-boundary"]);
  });

  it("can compute semantic candidates through the accepted-memory index report", async () => {
    const report = await runHybridRetrievalReport({
      optIn: true,
      queryText: "stable",
      memories: [
        memory("b", "stable"),
        memory("a", "stable"),
        memory("c", "other"),
      ],
      topK: 2,
      candidateCap: 2,
    });

    expect(report.semanticIndexReport?.providerId).toBe(
      "fixture-mock-local-embedding",
    );
    expect(report.semanticCandidateIds).toEqual(["a", "b"]);
    expect(report.providerCallCount).toBe(0);
  });

  it("formats reports without full memory text or raw query text", async () => {
    const report = await runHybridRetrievalReport({
      optIn: true,
      queryText: "private hybrid query",
      memories: [
        memory(
          "private-hybrid-id",
          "Private hybrid memory text must not appear in reports.",
        ),
      ],
      semanticCandidateIds: ["private-hybrid-id"],
    });
    const summary = formatHybridRetrievalReport(report);

    expect(summary).toContain("private-hybrid-id");
    expect(summary).not.toContain(
      "Private hybrid memory text must not appear in reports",
    );
    expect(summary).not.toContain("private hybrid query");
    expect(summary).toContain("Full text included: no");
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
