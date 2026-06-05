import type { RinDatabase } from "../database";
import { loadProfileContext, type OwnerProfile, type RinProfile } from "../profile";
import type { RinDataLayout } from "../storage";
import { buildRinSystemPrompt } from "./rinSystemPrompt";

export type ContextV2SegmentType =
  | "system"
  | "rin_profile"
  | "owner_profile"
  | "current_owner_message"
  | "short_term_window"
  | "memory_v2_trace"
  | "older_reference";

export type ContextV2SkipReason =
  | "included"
  | "duplicate_source"
  | "budget_exceeded"
  | "missing_source";

export type ContextV2InputSegment = {
  id: string;
  type: ContextV2SegmentType;
  content: string;
  sourceId: string;
  provenance: string;
  protected: boolean;
};

export type ContextV2ReportSegment = {
  id: string;
  type: ContextV2SegmentType;
  sourceId: string;
  provenance: string;
  included: boolean;
  protected: boolean;
  characterCount: number;
  skipReason: ContextV2SkipReason;
};

export type ContextV2Report = {
  mode: "context-v2-report";
  status: "ready";
  shadowOnly: true;
  productionContextChanged: false;
  providerCallCount: 0;
  fullTextIncluded: false;
  maxCharacters: number;
  totalInputSegments: number;
  includedSegments: number;
  skippedSegments: number;
  characterCount: number;
  budgetExceeded: boolean;
  latestOwnerMessagePreserved: boolean;
  order: ContextV2SegmentType[];
  segments: ContextV2ReportSegment[];
};

export type ContextV2ReportOptions = {
  maxCharacters?: number;
};

export type ContextV2EvaluationCase = {
  caseId: string;
  input: ContextV2InputSegment[];
  options?: ContextV2ReportOptions;
  expectedOrder: ContextV2SegmentType[];
  expectedIncludedIds: string[];
  expectedSkippedIds?: string[];
  latestOwnerMessageId?: string;
};

export type ContextV2EvaluationCaseResult = {
  caseId: string;
  passed: boolean;
  failures: string[];
  includedIds: string[];
  skippedIds: string[];
  order: ContextV2SegmentType[];
};

export type ContextV2EvaluationRunResult = {
  mode: "context-v2-eval";
  total: number;
  passed: number;
  failed: number;
  failedCaseIds: string[];
  providerCallCount: 0;
  fullTextIncluded: false;
  caseResults: ContextV2EvaluationCaseResult[];
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: "owner" | "rin" | "system";
  content: string;
  created_at: string;
};

type TraceRow = {
  id: string;
  source_id: string;
  signal_summary_json: string;
  salience_score: number;
  updated_at: string;
};

const DEFAULT_CONTEXT_V2_MAX_CHARACTERS = 2400;
const SHORT_TERM_WINDOW_HOURS = 5;

const BUILT_IN_CONTEXT_V2_EVALUATION_CASES: ContextV2EvaluationCase[] = [
  {
    caseId: "orders-core-segments",
    input: fixtureSegments(),
    expectedOrder: [
      "system",
      "rin_profile",
      "owner_profile",
      "current_owner_message",
      "short_term_window",
      "memory_v2_trace",
      "older_reference",
    ],
    expectedIncludedIds: [
      "system",
      "rin-profile",
      "owner-profile",
      "owner-latest",
      "short-1",
      "trace-1",
      "older-1",
    ],
    latestOwnerMessageId: "owner-latest",
  },
  {
    caseId: "preserves-owner-under-budget-pressure",
    input: [
      segment("system", "system", "system", "sys".repeat(100), true),
      segment(
        "current_owner_message",
        "owner-latest",
        "message:latest",
        "latest owner must stay",
        true,
      ),
      segment("memory_v2_trace", "trace-large", "trace:large", "x".repeat(600), false),
    ],
    options: { maxCharacters: 180 },
    expectedOrder: ["system", "current_owner_message"],
    expectedIncludedIds: ["system", "owner-latest"],
    expectedSkippedIds: ["trace-large"],
    latestOwnerMessageId: "owner-latest",
  },
  {
    caseId: "deduplicates-shared-source",
    input: [
      segment("system", "system", "system", "system", true),
      segment(
        "current_owner_message",
        "owner-latest",
        "message:latest",
        "latest",
        true,
      ),
      segment("short_term_window", "short-dup", "message:dup", "short", false),
      segment("memory_v2_trace", "trace-dup", "message:dup", "trace", false),
    ],
    expectedOrder: ["system", "current_owner_message", "short_term_window"],
    expectedIncludedIds: ["system", "owner-latest", "short-dup"],
    expectedSkippedIds: ["trace-dup"],
    latestOwnerMessageId: "owner-latest",
  },
];

export function buildContextV2Report(
  input: readonly ContextV2InputSegment[],
  options: ContextV2ReportOptions = {},
): ContextV2Report {
  const maxCharacters = Math.max(
    1,
    options.maxCharacters ?? DEFAULT_CONTEXT_V2_MAX_CHARACTERS,
  );
  const ordered = orderSegments(input);
  const seenSources = new Set<string>();
  const reportSegments: ContextV2ReportSegment[] = [];
  let characterCount = 0;

  for (const item of ordered) {
    const base = toReportSegment(item);
    const duplicate = seenSources.has(item.sourceId) && !item.protected;
    const wouldFit = characterCount + item.content.length <= maxCharacters;
    const included = item.protected || (!duplicate && wouldFit);
    const skipReason: ContextV2SkipReason = included
      ? "included"
      : duplicate
        ? "duplicate_source"
        : "budget_exceeded";

    if (included) {
      characterCount += item.content.length;
      seenSources.add(item.sourceId);
    }

    reportSegments.push({
      ...base,
      included,
      skipReason,
    });
  }

  const includedSegments = reportSegments.filter((item) => item.included);
  const latestOwner = reportSegments.find(
    (item) => item.type === "current_owner_message",
  );

  return {
    mode: "context-v2-report",
    status: "ready",
    shadowOnly: true,
    productionContextChanged: false,
    providerCallCount: 0,
    fullTextIncluded: false,
    maxCharacters,
    totalInputSegments: reportSegments.length,
    includedSegments: includedSegments.length,
    skippedSegments: reportSegments.length - includedSegments.length,
    characterCount,
    budgetExceeded: characterCount > maxCharacters,
    latestOwnerMessagePreserved: latestOwner?.included ?? false,
    order: includedSegments.map((item) => item.type),
    segments: reportSegments,
  };
}

export async function buildContextV2ReportFromStorage(
  database: RinDatabase,
  layout: RinDataLayout,
  options: ContextV2ReportOptions = {},
): Promise<ContextV2Report> {
  const segments: ContextV2InputSegment[] = [
    segment(
      "system",
      "system",
      "system",
      buildRinSystemPrompt().content,
      true,
    ),
  ];
  const profileContext = await loadProfileContext(layout);

  if (profileContext.issues.length === 0) {
    segments.push(
      segment(
        "rin_profile",
        "rin-profile",
        "config:rin_profile.json",
        formatRinProfileSegment(profileContext.rinProfile),
        true,
      ),
      segment(
        "owner_profile",
        "owner-profile",
        "config:owner_profile.json",
        formatOwnerProfileSegment(profileContext.ownerProfile),
        true,
      ),
    );
  }

  const latestOwner = latestOwnerMessage(database);

  if (latestOwner) {
    segments.push(
      segment(
        "current_owner_message",
        latestOwner.id,
        `message:${latestOwner.id}`,
        latestOwner.content,
        true,
      ),
    );

    for (const item of recentMessages(database, latestOwner.created_at)) {
      if (item.id !== latestOwner.id) {
        segments.push(
          segment(
            "short_term_window",
            item.id,
            `message:${item.id}`,
            item.content,
            false,
          ),
        );
      }
    }
  }

  for (const trace of memoryV2Traces(database)) {
    segments.push(
      segment(
        "memory_v2_trace",
        trace.id,
        `message:${trace.source_id}`,
        trace.signal_summary_json,
        false,
      ),
    );
  }

  return buildContextV2Report(segments, options);
}

export function runBuiltInContextV2Evaluation(): ContextV2EvaluationRunResult {
  const caseResults = BUILT_IN_CONTEXT_V2_EVALUATION_CASES.map(evaluateCase);
  const failedCaseIds = caseResults
    .filter((item) => !item.passed)
    .map((item) => item.caseId);

  return {
    mode: "context-v2-eval",
    total: caseResults.length,
    passed: caseResults.length - failedCaseIds.length,
    failed: failedCaseIds.length,
    failedCaseIds,
    providerCallCount: 0,
    fullTextIncluded: false,
    caseResults,
  };
}

export function formatContextV2Report(report: ContextV2Report): string {
  return [
    "RIN Context V2 report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Shadow only: ${report.shadowOnly ? "yes" : "no"}`,
    `Production context changed: ${report.productionContextChanged ? "yes" : "no"}`,
    `Max characters: ${report.maxCharacters}`,
    `Character count: ${report.characterCount}`,
    `Budget exceeded: ${report.budgetExceeded ? "yes" : "no"}`,
    `Latest owner message preserved: ${
      report.latestOwnerMessagePreserved ? "yes" : "no"
    }`,
    `Included segments: ${report.includedSegments}`,
    `Skipped segments: ${report.skippedSegments}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    `Order: ${report.order.join(" > ") || "none"}`,
    "Segments:",
    ...report.segments.map(
      (item) =>
        `- ${item.id} type=${item.type} included=${item.included ? "yes" : "no"} protected=${item.protected ? "yes" : "no"} chars=${item.characterCount} source=${item.sourceId} skip=${item.skipReason}`,
    ),
  ].join("\n");
}

export function formatContextV2EvaluationSummary(
  result: ContextV2EvaluationRunResult,
): string {
  return [
    "RIN Context V2 evaluation.",
    `Mode: ${result.mode}`,
    `Total: ${result.total}`,
    `Passed: ${result.passed}`,
    `Failed: ${result.failed}`,
    `providerCallCount: ${result.providerCallCount}`,
    `Full text included: ${result.fullTextIncluded ? "yes" : "no"}`,
    `Failed case IDs: ${
      result.failedCaseIds.length > 0 ? result.failedCaseIds.join(", ") : "none"
    }`,
    "Cases:",
    ...result.caseResults.map(
      (item) =>
        `- ${item.caseId} passed=${item.passed ? "yes" : "no"} order=${item.order.join(">")}`,
    ),
  ].join("\n");
}

function evaluateCase(
  item: ContextV2EvaluationCase,
): ContextV2EvaluationCaseResult {
  const report = buildContextV2Report(item.input, item.options);
  const includedIds = report.segments
    .filter((segmentItem) => segmentItem.included)
    .map((segmentItem) => segmentItem.id);
  const skippedIds = report.segments
    .filter((segmentItem) => !segmentItem.included)
    .map((segmentItem) => segmentItem.id);
  const failures: string[] = [];

  compareArrays(failures, "order", item.expectedOrder, report.order);
  compareArrays(failures, "included ids", item.expectedIncludedIds, includedIds);

  if (item.expectedSkippedIds) {
    compareArrays(failures, "skipped ids", item.expectedSkippedIds, skippedIds);
  }

  if (item.latestOwnerMessageId && !includedIds.includes(item.latestOwnerMessageId)) {
    failures.push(`Latest owner message missing: ${item.latestOwnerMessageId}`);
  }

  return {
    caseId: item.caseId,
    passed: failures.length === 0,
    failures,
    includedIds,
    skippedIds,
    order: report.order,
  };
}

function orderSegments(
  input: readonly ContextV2InputSegment[],
): ContextV2InputSegment[] {
  return [...input].sort((left, right) => {
    const priority = priorityFor(left.type) - priorityFor(right.type);
    return priority !== 0 ? priority : left.id.localeCompare(right.id);
  });
}

function priorityFor(type: ContextV2SegmentType): number {
  switch (type) {
    case "system":
      return 0;
    case "rin_profile":
      return 1;
    case "owner_profile":
      return 2;
    case "current_owner_message":
      return 3;
    case "short_term_window":
      return 4;
    case "memory_v2_trace":
      return 5;
    case "older_reference":
      return 6;
  }
}

function toReportSegment(item: ContextV2InputSegment): ContextV2ReportSegment {
  return {
    id: item.id,
    type: item.type,
    sourceId: item.sourceId,
    provenance: item.provenance,
    included: false,
    protected: item.protected,
    characterCount: item.content.length,
    skipReason: "missing_source",
  };
}

function segment(
  type: ContextV2SegmentType,
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

function latestOwnerMessage(database: RinDatabase): MessageRow | null {
  const row = database
    .prepare(
      `
        SELECT id, conversation_id, role, content, created_at
        FROM messages
        WHERE role = 'owner'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
    )
    .get() as MessageRow | undefined;

  return row ?? null;
}

function recentMessages(database: RinDatabase, latestOwnerCreatedAt: string): MessageRow[] {
  const latestTimestamp = Date.parse(latestOwnerCreatedAt);
  const windowStartedAt = new Date(
    latestTimestamp - SHORT_TERM_WINDOW_HOURS * 60 * 60 * 1000,
  ).toISOString();

  return database
    .prepare(
      `
        SELECT id, conversation_id, role, content, created_at
        FROM messages
        WHERE created_at >= ? AND created_at <= ?
        ORDER BY created_at ASC, id ASC
        LIMIT 20
      `,
    )
    .all(windowStartedAt, latestOwnerCreatedAt)
    .map((row) => row as MessageRow);
}

function memoryV2Traces(database: RinDatabase): TraceRow[] {
  return database
    .prepare(
      `
        SELECT
          memory_v2_traces.id,
          memory_v2_trace_sources.source_id,
          memory_v2_traces.signal_summary_json,
          memory_v2_traces.salience_score,
          memory_v2_traces.updated_at
        FROM memory_v2_traces
        JOIN memory_v2_trace_sources
          ON memory_v2_trace_sources.id = memory_v2_traces.source_ref_id
        WHERE memory_v2_traces.status = 'shadow'
        ORDER BY memory_v2_traces.salience_score DESC,
          memory_v2_traces.updated_at DESC
        LIMIT 8
      `,
    )
    .all()
    .map((row) => row as TraceRow);
}

function fixtureSegments(): ContextV2InputSegment[] {
  return [
    segment("memory_v2_trace", "trace-1", "trace:1", "trace", false),
    segment("current_owner_message", "owner-latest", "message:latest", "owner", true),
    segment("rin_profile", "rin-profile", "config:rin", "rin profile", true),
    segment("older_reference", "older-1", "older:1", "older", false),
    segment("system", "system", "system", "system", true),
    segment("short_term_window", "short-1", "message:short", "short", false),
    segment("owner_profile", "owner-profile", "config:owner", "owner profile", true),
  ];
}

function formatRinProfileSegment(profile: RinProfile): string {
  return [
    "RIN profile context:",
    `displayName=${profile.displayName}`,
    `role=${profile.role}`,
    `styleCount=${profile.communicationStyle.length}`,
    `boundaryCount=${profile.behaviorBoundaries.length}`,
    `noteCount=${profile.contextNotes.length}`,
  ].join("\n");
}

function formatOwnerProfileSegment(profile: OwnerProfile): string {
  return [
    "Owner profile context:",
    `ownerId=${profile.ownerId}`,
    `displayName=${profile.displayName}`,
    `communicationCount=${profile.communicationPreferences.length}`,
    `preferenceCount=${profile.stablePreferences.length}`,
    `projectCount=${profile.activeProjects.length}`,
    `noteCount=${profile.contextNotes.length}`,
  ].join("\n");
}

function compareArrays<T>(
  failures: string[],
  label: string,
  expected: readonly T[],
  actual: readonly T[],
): void {
  if (
    expected.length !== actual.length ||
    expected.some((item, index) => item !== actual[index])
  ) {
    failures.push(
      `Expected ${label} ${expected.join(",")}; actual=${actual.join(",")}`,
    );
  }
}
