import { memorySnippetText } from "./retrieval";
import type { MemoryRecord, MemoryStatus, MemoryType } from "./manager";

export type MemoryMaintenanceReason =
  | "stale_accepted_memory"
  | "long_pending_proposal"
  | "duplicate_content_candidate"
  | "low_confidence_accepted_memory"
  | "rejected_memory_retention_review"
  | "archived_memory_retention_review";

export type MemoryMaintenanceSuggestion = {
  memoryId: string;
  memoryType: MemoryType;
  status: MemoryStatus;
  reasons: MemoryMaintenanceReason[];
  updatedAt: string;
  destructiveMutationRequired: false;
};

export type MemoryMaintenanceReport = {
  mode: "memory-maintenance-report";
  status: "ready";
  checkedMemoryCount: number;
  suggestionCount: number;
  suggestions: MemoryMaintenanceSuggestion[];
  mutatedMemoryCount: 0;
  providerCallCount: 0;
  fullTextIncluded: false;
};

export type MemoryMaintenanceOptions = {
  now?: Date;
  staleAcceptedAfterDays?: number;
  longPendingAfterDays?: number;
};

const DEFAULT_STALE_ACCEPTED_AFTER_DAYS = 180;
const DEFAULT_LONG_PENDING_AFTER_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function analyzeMemoryMaintenance(
  memories: readonly MemoryRecord[],
  options: MemoryMaintenanceOptions = {},
): MemoryMaintenanceReport {
  const now = options.now ?? new Date();
  const staleAcceptedAfterDays = Math.max(
    1,
    options.staleAcceptedAfterDays ?? DEFAULT_STALE_ACCEPTED_AFTER_DAYS,
  );
  const longPendingAfterDays = Math.max(
    1,
    options.longPendingAfterDays ?? DEFAULT_LONG_PENDING_AFTER_DAYS,
  );
  const duplicateIds = duplicateContentIds(memories);
  const suggestions = memories
    .map((memory) =>
      maintenanceSuggestionForMemory(memory, {
        now,
        staleAcceptedAfterDays,
        longPendingAfterDays,
        duplicateIds,
      }),
    )
    .filter(
      (suggestion): suggestion is MemoryMaintenanceSuggestion =>
        suggestion !== null,
    )
    .sort(compareMemoryMaintenanceSuggestions);

  return {
    mode: "memory-maintenance-report",
    status: "ready",
    checkedMemoryCount: memories.length,
    suggestionCount: suggestions.length,
    suggestions,
    mutatedMemoryCount: 0,
    providerCallCount: 0,
    fullTextIncluded: false,
  };
}

export function formatMemoryMaintenanceReport(
  report: MemoryMaintenanceReport,
): string {
  return [
    "RIN memory maintenance report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Checked memories: ${report.checkedMemoryCount}`,
    `Suggestions: ${report.suggestionCount}`,
    `Mutated memories: ${report.mutatedMemoryCount}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Suggestion IDs:",
    ...formatSuggestions(report.suggestions),
  ].join("\n");
}

function maintenanceSuggestionForMemory(
  memory: MemoryRecord,
  context: {
    now: Date;
    staleAcceptedAfterDays: number;
    longPendingAfterDays: number;
    duplicateIds: Set<string>;
  },
): MemoryMaintenanceSuggestion | null {
  const reasons: MemoryMaintenanceReason[] = [];
  const ageDays = ageInDays(memory.updatedAt, context.now);

  if (memory.status === "accepted") {
    if (ageDays >= context.staleAcceptedAfterDays) {
      reasons.push("stale_accepted_memory");
    }
    if (memory.metadata.confidence === "low") {
      reasons.push("low_confidence_accepted_memory");
    }
  }

  if (memory.status === "proposal" && ageDays >= context.longPendingAfterDays) {
    reasons.push("long_pending_proposal");
  }

  if (memory.status === "rejected") {
    reasons.push("rejected_memory_retention_review");
  }

  if (memory.status === "archived") {
    reasons.push("archived_memory_retention_review");
  }

  if (context.duplicateIds.has(memory.id)) {
    reasons.push("duplicate_content_candidate");
  }

  if (reasons.length === 0) {
    return null;
  }

  return {
    memoryId: memory.id,
    memoryType: memory.memoryType,
    status: memory.status,
    reasons,
    updatedAt: memory.updatedAt,
    destructiveMutationRequired: false,
  };
}

function duplicateContentIds(memories: readonly MemoryRecord[]): Set<string> {
  const idsBySnippet = new Map<string, string[]>();

  for (const memory of memories) {
    const snippetKey = memorySnippetText(memory.content).toLocaleLowerCase();
    if (!snippetKey) {
      continue;
    }

    idsBySnippet.set(snippetKey, [...(idsBySnippet.get(snippetKey) ?? []), memory.id]);
  }

  return new Set(
    [...idsBySnippet.values()]
      .filter((ids) => ids.length > 1)
      .flatMap((ids) => ids),
  );
}

function ageInDays(isoTimestamp: string, now: Date): number {
  const timestamp = Date.parse(isoTimestamp);

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  return Math.floor((now.getTime() - timestamp) / MS_PER_DAY);
}

function compareMemoryMaintenanceSuggestions(
  left: MemoryMaintenanceSuggestion,
  right: MemoryMaintenanceSuggestion,
): number {
  if (left.status !== right.status) {
    return left.status.localeCompare(right.status);
  }

  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt.localeCompare(right.updatedAt);
  }

  return left.memoryId.localeCompare(right.memoryId);
}

function formatSuggestions(
  suggestions: readonly MemoryMaintenanceSuggestion[],
): string[] {
  if (suggestions.length === 0) {
    return ["none"];
  }

  return suggestions.map(
    (suggestion) =>
      `- ${suggestion.memoryId} status=${suggestion.status} type=${suggestion.memoryType} reasons=${suggestion.reasons.join(",")}`,
  );
}
