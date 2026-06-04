import { describe, expect, it } from "vitest";
import type { MemoryRecord } from "./manager";
import {
  buildMemoryConflictReport,
  buildMemoryGovernanceSmokeReport,
  buildMemoryHealthReport,
  formatMemoryConflictReport,
  formatMemoryHealthReport,
} from "./governance";

describe("memory governance reports", () => {
  it("reports merge, conflict, and archive suggestions without mutation", () => {
    const memories = [
      memory("duplicate-a", "Owner prefers local-first RIN architecture.", {
        updatedAt: "2025-01-01T00:00:00.000Z",
      }),
      memory("duplicate-b", "Owner prefers local-first RIN architecture."),
      memory("conflict-a", "Owner wants project reports.", {
        metadata: metadata({ tags: ["project"] }),
      }),
      memory("conflict-b", "Owner does not want project reports.", {
        metadata: metadata({ tags: ["project"] }),
      }),
      memory("low-confidence", "Low confidence memory.", {
        metadata: metadata({ confidence: "low" }),
      }),
      memory("old-proposal", "Old pending memory.", {
        status: "proposal",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      memory("rejected", "Rejected private memory.", { status: "rejected" }),
    ];

    const report = buildMemoryHealthReport(memories, {
      now: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(report.checkedMemoryCount).toBe(7);
    expect(report.mergeSuggestionCount).toBe(1);
    expect(report.conflictSuggestionCount).toBe(1);
    expect(report.archiveSuggestionCount).toBeGreaterThanOrEqual(3);
    expect(report.mutatedMemoryCount).toBe(0);
    expect(report.providerCallCount).toBe(0);
    expect(report.fullTextIncluded).toBe(false);
    expect(report.mergeSuggestions[0]).toMatchObject({
      canonicalMemoryId: "duplicate-a",
      duplicateMemoryIds: ["duplicate-b"],
      destructiveMutationRequired: false,
    });
    expect(report.conflictSuggestions[0].memoryIds).toEqual([
      "conflict-a",
      "conflict-b",
    ]);
  });

  it("formats broad reports without full memory text", () => {
    const memories = [
      memory("secret-a", "Private memory text must not appear.", {
        status: "rejected",
      }),
      memory("secret-b", "Owner does not want private project reports.", {
        metadata: metadata({ tags: ["project"] }),
      }),
      memory("secret-c", "Owner wants private project reports.", {
        metadata: metadata({ tags: ["project"] }),
      }),
    ];
    const healthSummary = formatMemoryHealthReport(buildMemoryHealthReport(memories));
    const conflictSummary = formatMemoryConflictReport(
      buildMemoryConflictReport(memories),
    );
    const smoke = buildMemoryGovernanceSmokeReport(memories);

    expect(healthSummary).toContain("secret-a");
    expect(healthSummary).not.toContain("Private memory text");
    expect(conflictSummary).toContain("secret-b");
    expect(conflictSummary).not.toContain("private project reports");
    expect(smoke).toMatchObject({
      suggestionOnly: true,
      mutatedMemoryCount: 0,
      providerCallCount: 0,
      fullTextIncluded: false,
    });
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
    metadata: overrides.metadata ?? metadata(),
    sourceMessageId: null,
    status: overrides.status ?? "accepted",
    createdAt: overrides.createdAt ?? "2026-05-22T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-05-22T00:00:00.000Z",
    ...overrides,
  };
}

function metadata(
  overrides: Partial<MemoryRecord["metadata"]> = {},
): MemoryRecord["metadata"] {
  return {
    tags: [],
    importance: "normal",
    confidence: "medium",
    source: null,
    reviewedAt: null,
    acceptedAt: null,
    ...overrides,
  };
}
