import { describe, expect, it } from "vitest";
import type { MemoryRecord } from "./manager";
import {
  analyzeMemoryMaintenance,
  formatMemoryMaintenanceReport,
} from "./maintenance";

describe("analyzeMemoryMaintenance", () => {
  it("reports safe suggestion reasons without mutating memory", () => {
    const report = analyzeMemoryMaintenance(
      [
        memory("accepted-stale", "Old accepted memory", {
          updatedAt: "2025-01-01T00:00:00.000Z",
        }),
        memory("accepted-low-confidence", "Low confidence memory", {
          metadata: metadata({ confidence: "low" }),
        }),
        memory("pending-old", "Pending proposal", {
          status: "proposal",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
        memory("duplicate-a", "Duplicate private text"),
        memory("duplicate-b", "Duplicate private text"),
        memory("rejected", "Rejected private text", { status: "rejected" }),
      ],
      { now: new Date("2026-06-01T00:00:00.000Z") },
    );

    expect(report.checkedMemoryCount).toBe(6);
    expect(report.mutatedMemoryCount).toBe(0);
    expect(report.providerCallCount).toBe(0);
    expect(report.fullTextIncluded).toBe(false);
    expect(reasonsFor(report, "accepted-stale")).toContain(
      "stale_accepted_memory",
    );
    expect(reasonsFor(report, "accepted-low-confidence")).toContain(
      "low_confidence_accepted_memory",
    );
    expect(reasonsFor(report, "pending-old")).toContain("long_pending_proposal");
    expect(reasonsFor(report, "duplicate-a")).toContain(
      "duplicate_content_candidate",
    );
    expect(reasonsFor(report, "duplicate-b")).toContain(
      "duplicate_content_candidate",
    );
    expect(reasonsFor(report, "rejected")).toContain(
      "rejected_memory_retention_review",
    );
  });

  it("formats reports without full memory text", () => {
    const report = analyzeMemoryMaintenance(
      [
        memory("private-memory-id", "Private memory text must not appear.", {
          status: "archived",
        }),
      ],
      { now: new Date("2026-06-01T00:00:00.000Z") },
    );
    const summary = formatMemoryMaintenanceReport(report);

    expect(summary).toContain("private-memory-id");
    expect(summary).toContain("archived_memory_retention_review");
    expect(summary).not.toContain("Private memory text must not appear");
    expect(summary).toContain("Full text included: no");
  });
});

function reasonsFor(
  report: ReturnType<typeof analyzeMemoryMaintenance>,
  memoryId: string,
) {
  return report.suggestions.find((suggestion) => suggestion.memoryId === memoryId)
    ?.reasons ?? [];
}

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
