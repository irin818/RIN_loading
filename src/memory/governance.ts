import { memorySnippetText } from "./retrieval";
import type { MemoryRecord, MemoryStatus, MemoryType } from "./manager";

export type MemoryGovernanceReason =
  | "stale_candidate"
  | "duplicate_merge_candidate"
  | "possible_conflict"
  | "archive_review_candidate"
  | "low_confidence_review"
  | "long_pending_review";

export type MemoryMergeSuggestion = {
  canonicalMemoryId: string;
  duplicateMemoryIds: string[];
  memoryType: MemoryType;
  status: MemoryStatus;
  reasons: MemoryGovernanceReason[];
  destructiveMutationRequired: false;
};

export type MemoryConflictSuggestion = {
  memoryIds: string[];
  memoryType: MemoryType;
  statuses: MemoryStatus[];
  reasons: MemoryGovernanceReason[];
  destructiveMutationRequired: false;
};

export type MemoryArchiveSuggestion = {
  memoryId: string;
  memoryType: MemoryType;
  status: MemoryStatus;
  reasons: MemoryGovernanceReason[];
  destructiveMutationRequired: false;
};

export type MemoryHealthReport = {
  mode: "memory-health-report";
  status: "ready";
  checkedMemoryCount: number;
  acceptedCount: number;
  proposalCount: number;
  rejectedCount: number;
  archivedCount: number;
  mergeSuggestionCount: number;
  conflictSuggestionCount: number;
  archiveSuggestionCount: number;
  mutatedMemoryCount: 0;
  providerCallCount: 0;
  fullTextIncluded: false;
  mergeSuggestions: MemoryMergeSuggestion[];
  conflictSuggestions: MemoryConflictSuggestion[];
  archiveSuggestions: MemoryArchiveSuggestion[];
};

export type MemoryConflictReport = {
  mode: "memory-conflict-report";
  status: "ready";
  checkedMemoryCount: number;
  conflictSuggestionCount: number;
  mergeSuggestionCount: number;
  mutatedMemoryCount: 0;
  providerCallCount: 0;
  fullTextIncluded: false;
  conflictSuggestions: MemoryConflictSuggestion[];
  mergeSuggestions: MemoryMergeSuggestion[];
};

export type MemoryGovernanceSmokeReport = {
  mode: "memory-governance-smoke";
  status: "ready";
  checkedMemoryCount: number;
  suggestionOnly: true;
  mutatedMemoryCount: 0;
  providerCallCount: 0;
  fullTextIncluded: false;
  health: {
    mergeSuggestionCount: number;
    conflictSuggestionCount: number;
    archiveSuggestionCount: number;
  };
};

export type MemoryGovernanceOptions = {
  now?: Date;
  staleAcceptedAfterDays?: number;
  longPendingAfterDays?: number;
};

const DEFAULT_STALE_ACCEPTED_AFTER_DAYS = 180;
const DEFAULT_LONG_PENDING_AFTER_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function buildMemoryHealthReport(
  memories: readonly MemoryRecord[],
  options: MemoryGovernanceOptions = {},
): MemoryHealthReport {
  const mergeSuggestions = findMergeSuggestions(memories);
  const conflictSuggestions = findConflictSuggestions(memories);
  const archiveSuggestions = findArchiveSuggestions(memories, options);

  return {
    mode: "memory-health-report",
    status: "ready",
    checkedMemoryCount: memories.length,
    acceptedCount: countStatus(memories, "accepted"),
    proposalCount: countStatus(memories, "proposal"),
    rejectedCount: countStatus(memories, "rejected"),
    archivedCount: countStatus(memories, "archived"),
    mergeSuggestionCount: mergeSuggestions.length,
    conflictSuggestionCount: conflictSuggestions.length,
    archiveSuggestionCount: archiveSuggestions.length,
    mutatedMemoryCount: 0,
    providerCallCount: 0,
    fullTextIncluded: false,
    mergeSuggestions,
    conflictSuggestions,
    archiveSuggestions,
  };
}

export function buildMemoryConflictReport(
  memories: readonly MemoryRecord[],
): MemoryConflictReport {
  const conflictSuggestions = findConflictSuggestions(memories);
  const mergeSuggestions = findMergeSuggestions(memories);

  return {
    mode: "memory-conflict-report",
    status: "ready",
    checkedMemoryCount: memories.length,
    conflictSuggestionCount: conflictSuggestions.length,
    mergeSuggestionCount: mergeSuggestions.length,
    mutatedMemoryCount: 0,
    providerCallCount: 0,
    fullTextIncluded: false,
    conflictSuggestions,
    mergeSuggestions,
  };
}

export function buildMemoryGovernanceSmokeReport(
  memories: readonly MemoryRecord[],
): MemoryGovernanceSmokeReport {
  const health = buildMemoryHealthReport(memories);

  return {
    mode: "memory-governance-smoke",
    status: "ready",
    checkedMemoryCount: health.checkedMemoryCount,
    suggestionOnly: true,
    mutatedMemoryCount: 0,
    providerCallCount: 0,
    fullTextIncluded: false,
    health: {
      mergeSuggestionCount: health.mergeSuggestionCount,
      conflictSuggestionCount: health.conflictSuggestionCount,
      archiveSuggestionCount: health.archiveSuggestionCount,
    },
  };
}

export function formatMemoryHealthReport(report: MemoryHealthReport): string {
  return [
    "RIN memory health report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Checked memories: ${report.checkedMemoryCount}`,
    `Accepted: ${report.acceptedCount}`,
    `Proposals: ${report.proposalCount}`,
    `Rejected: ${report.rejectedCount}`,
    `Archived: ${report.archivedCount}`,
    `Merge suggestions: ${report.mergeSuggestionCount}`,
    `Conflict suggestions: ${report.conflictSuggestionCount}`,
    `Archive suggestions: ${report.archiveSuggestionCount}`,
    `Mutated memories: ${report.mutatedMemoryCount}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Merge suggestion IDs:",
    ...formatMergeSuggestions(report.mergeSuggestions),
    "Conflict suggestion IDs:",
    ...formatConflictSuggestions(report.conflictSuggestions),
    "Archive suggestion IDs:",
    ...formatArchiveSuggestions(report.archiveSuggestions),
  ].join("\n");
}

export function formatMemoryConflictReport(
  report: MemoryConflictReport,
): string {
  return [
    "RIN memory conflict report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Checked memories: ${report.checkedMemoryCount}`,
    `Conflict suggestions: ${report.conflictSuggestionCount}`,
    `Merge suggestions: ${report.mergeSuggestionCount}`,
    `Mutated memories: ${report.mutatedMemoryCount}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Conflict suggestion IDs:",
    ...formatConflictSuggestions(report.conflictSuggestions),
    "Merge suggestion IDs:",
    ...formatMergeSuggestions(report.mergeSuggestions),
  ].join("\n");
}

export function formatMemoryGovernanceSmokeReport(
  report: MemoryGovernanceSmokeReport,
): string {
  return [
    "RIN memory governance smoke report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Checked memories: ${report.checkedMemoryCount}`,
    `Suggestion only: ${report.suggestionOnly ? "yes" : "no"}`,
    `Mutated memories: ${report.mutatedMemoryCount}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    `Merge suggestions: ${report.health.mergeSuggestionCount}`,
    `Conflict suggestions: ${report.health.conflictSuggestionCount}`,
    `Archive suggestions: ${report.health.archiveSuggestionCount}`,
  ].join("\n");
}

function findMergeSuggestions(
  memories: readonly MemoryRecord[],
): MemoryMergeSuggestion[] {
  const groups = new Map<string, MemoryRecord[]>();

  for (const memory of memories.filter((item) => item.status !== "rejected")) {
    const key = normalizedSnippet(memory);

    if (!key) {
      continue;
    }

    groups.set(key, [...(groups.get(key) ?? []), memory]);
  }

  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const sorted = [...group].sort(compareMemoryRecords);
      const canonical = sorted[0];

      return {
        canonicalMemoryId: canonical.id,
        duplicateMemoryIds: sorted.slice(1).map((memory) => memory.id),
        memoryType: canonical.memoryType,
        status: canonical.status,
        reasons: ["duplicate_merge_candidate"] satisfies MemoryGovernanceReason[],
        destructiveMutationRequired: false,
      } satisfies MemoryMergeSuggestion;
    })
    .sort((left, right) =>
      left.canonicalMemoryId.localeCompare(right.canonicalMemoryId),
    );
}

function findConflictSuggestions(
  memories: readonly MemoryRecord[],
): MemoryConflictSuggestion[] {
  const activeMemories = memories.filter(
    (memory) => memory.status === "accepted" || memory.status === "proposal",
  );
  const suggestions: MemoryConflictSuggestion[] = [];

  for (let i = 0; i < activeMemories.length; i += 1) {
    for (let j = i + 1; j < activeMemories.length; j += 1) {
      const left = activeMemories[i];
      const right = activeMemories[j];

      if (left.memoryType !== right.memoryType) {
        continue;
      }

      if (hasPossibleConflict(left, right)) {
        suggestions.push({
          memoryIds: [left.id, right.id].sort(),
          memoryType: left.memoryType,
          statuses: [left.status, right.status].sort(),
          reasons: ["possible_conflict"],
          destructiveMutationRequired: false,
        });
      }
    }
  }

  return suggestions.sort((left, right) =>
    left.memoryIds.join(",").localeCompare(right.memoryIds.join(",")),
  );
}

function findArchiveSuggestions(
  memories: readonly MemoryRecord[],
  options: MemoryGovernanceOptions,
): MemoryArchiveSuggestion[] {
  const now = options.now ?? new Date();
  const staleAcceptedAfterDays = Math.max(
    1,
    options.staleAcceptedAfterDays ?? DEFAULT_STALE_ACCEPTED_AFTER_DAYS,
  );
  const longPendingAfterDays = Math.max(
    1,
    options.longPendingAfterDays ?? DEFAULT_LONG_PENDING_AFTER_DAYS,
  );

  return memories
    .map((memory) => {
      const reasons: MemoryGovernanceReason[] = [];
      const ageDays = ageInDays(memory.updatedAt, now);

      if (memory.status === "accepted" && ageDays >= staleAcceptedAfterDays) {
        reasons.push("stale_candidate");
      }

      if (memory.status === "accepted" && memory.metadata.confidence === "low") {
        reasons.push("low_confidence_review");
      }

      if (memory.status === "proposal" && ageDays >= longPendingAfterDays) {
        reasons.push("long_pending_review");
      }

      if (memory.status === "rejected" || memory.status === "archived") {
        reasons.push("archive_review_candidate");
      }

      if (reasons.length === 0) {
        return null;
      }

      return {
        memoryId: memory.id,
        memoryType: memory.memoryType,
        status: memory.status,
        reasons,
        destructiveMutationRequired: false,
      };
    })
    .filter(
      (suggestion): suggestion is MemoryArchiveSuggestion => suggestion !== null,
    )
    .sort((left, right) => left.memoryId.localeCompare(right.memoryId));
}

function hasPossibleConflict(
  left: MemoryRecord,
  right: MemoryRecord,
): boolean {
  const leftText = normalizedSnippet(left);
  const rightText = normalizedSnippet(right);

  if (!shareGovernanceTopic(left, right, leftText, rightText)) {
    return false;
  }

  return hasNegation(leftText) !== hasNegation(rightText);
}

function shareGovernanceTopic(
  left: MemoryRecord,
  right: MemoryRecord,
  leftText: string,
  rightText: string,
): boolean {
  if (left.metadata.tags.some((tag) => right.metadata.tags.includes(tag))) {
    return true;
  }

  const leftTokens = new Set(leftText.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(rightText.split(/\s+/).filter(Boolean));
  let overlap = 0;

  for (const token of leftTokens) {
    if (token.length >= 4 && rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap >= 2;
}

function hasNegation(value: string): boolean {
  return /\b(no|not|never|without|avoid|forbid|forbidden)\b|不|不要|不是|禁止/.test(
    value,
  );
}

function normalizedSnippet(memory: MemoryRecord): string {
  return memorySnippetText(memory.content).trim().toLocaleLowerCase();
}

function ageInDays(isoTimestamp: string, now: Date): number {
  const timestamp = Date.parse(isoTimestamp);

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  return Math.floor((now.getTime() - timestamp) / MS_PER_DAY);
}

function countStatus(
  memories: readonly MemoryRecord[],
  status: MemoryStatus,
): number {
  return memories.filter((memory) => memory.status === status).length;
}

function compareMemoryRecords(left: MemoryRecord, right: MemoryRecord): number {
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt.localeCompare(right.updatedAt);
  }

  return left.id.localeCompare(right.id);
}

function formatMergeSuggestions(
  suggestions: readonly MemoryMergeSuggestion[],
): string[] {
  if (suggestions.length === 0) {
    return ["none"];
  }

  return suggestions.map(
    (suggestion) =>
      `- canonical=${suggestion.canonicalMemoryId} duplicates=${suggestion.duplicateMemoryIds.join(",")} type=${suggestion.memoryType} status=${suggestion.status} reasons=${suggestion.reasons.join(",")}`,
  );
}

function formatConflictSuggestions(
  suggestions: readonly MemoryConflictSuggestion[],
): string[] {
  if (suggestions.length === 0) {
    return ["none"];
  }

  return suggestions.map(
    (suggestion) =>
      `- ids=${suggestion.memoryIds.join(",")} type=${suggestion.memoryType} statuses=${suggestion.statuses.join(",")} reasons=${suggestion.reasons.join(",")}`,
  );
}

function formatArchiveSuggestions(
  suggestions: readonly MemoryArchiveSuggestion[],
): string[] {
  if (suggestions.length === 0) {
    return ["none"];
  }

  return suggestions.map(
    (suggestion) =>
      `- ${suggestion.memoryId} status=${suggestion.status} type=${suggestion.memoryType} reasons=${suggestion.reasons.join(",")}`,
  );
}
