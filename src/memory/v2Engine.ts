import type { RinDatabase } from "../database";

export type MemoryV2SignalType =
  | "recency"
  | "preference"
  | "project"
  | "salience"
  | "reinforcement"
  | "decay"
  | "conflict"
  | "low_signal";

export type MemoryV2TraceDecision =
  | "promoted"
  | "reinforced"
  | "weakened"
  | "ignored";

export type MemoryV2TraceReason =
  | "preference_signal"
  | "project_signal"
  | "daily_signal"
  | "contradiction_signal"
  | "low_signal"
  | "reinforcement_signal"
  | "decay_signal";

export type MemoryV2SourceMessage = {
  messageId: string;
  conversationId: string;
  role: "owner" | "rin" | "system";
  content: string;
  createdAt: string;
};

export type MemoryV2Signal = {
  signalType: MemoryV2SignalType;
  signalKey: string;
  signalWeight: number;
  evidence: {
    rawTextIncluded: false;
    contentCharacterCount: number;
    matchedPattern: string;
  };
};

export type MemoryV2TraceAnalysis = {
  sourceMessageId: string;
  sourceCreatedAt: string;
  conversationId: string;
  role: MemoryV2SourceMessage["role"];
  contentCharacterCount: number;
  ageHours: number;
  baseScore: number;
  stabilityHours: number;
  retentionScore: number;
  decision: MemoryV2TraceDecision;
  reasons: MemoryV2TraceReason[];
  signals: MemoryV2Signal[];
};

export type MemoryV2ShadowReportItem = Omit<
  MemoryV2TraceAnalysis,
  "signals"
> & {
  signalTypes: MemoryV2SignalType[];
};

export type MemoryV2ShadowReport = {
  mode: "memory-v2-shadow-report";
  status: "ready";
  shadowOnly: true;
  sourceMessageCount: number;
  promotedCount: number;
  reinforcedCount: number;
  weakenedCount: number;
  ignoredCount: number;
  shadowTraceWriteCount: number;
  shadowSignalWriteCount: number;
  retentionFormula: "baseScore * exp(-ageHours / stabilityHours)";
  productionRetrievalChanged: false;
  rawHistoryMutationCount: 0;
  acceptedMemoryMutationCount: 0;
  profileMutationCount: 0;
  providerCallCount: 0;
  fullTextIncluded: false;
  items: MemoryV2ShadowReportItem[];
};

export type MemoryV2ShadowEngineOptions = {
  now?: Date;
  limit?: number;
};

export type MemoryV2EvaluationCase = {
  caseId: string;
  categories: string[];
  message: MemoryV2SourceMessage;
  now: Date;
  expectedDecision: MemoryV2TraceDecision;
  expectedReasons: MemoryV2TraceReason[];
};

export type MemoryV2EvaluationCaseResult = {
  caseId: string;
  categories: string[];
  passed: boolean;
  failures: string[];
  decision: MemoryV2TraceDecision;
  reasons: MemoryV2TraceReason[];
};

export type MemoryV2EvaluationRunResult = {
  mode: "memory-v2-eval";
  total: number;
  passed: number;
  failed: number;
  failedCaseIds: string[];
  providerCallCount: 0;
  fullTextIncluded: false;
  caseResults: MemoryV2EvaluationCaseResult[];
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: "owner" | "rin" | "system";
  content: string;
  created_at: string;
};

const DEFAULT_SHADOW_LIMIT = 100;
const PROMOTION_THRESHOLD = 0.45;
const LOW_SIGNAL_MAX_CHARACTERS = 18;
const DEFAULT_NOW = new Date("2026-06-05T12:00:00.000Z");

const BUILT_IN_MEMORY_V2_EVALUATION_CASES: MemoryV2EvaluationCase[] = [
  {
    caseId: "preference-promoted",
    categories: ["preference"],
    message: fixtureMessage(
      "preference-promoted",
      "I prefer concise RIN progress reports.",
      "2026-06-05T10:00:00.000Z",
    ),
    now: DEFAULT_NOW,
    expectedDecision: "promoted",
    expectedReasons: ["preference_signal"],
  },
  {
    caseId: "project-promoted",
    categories: ["project"],
    message: fixtureMessage(
      "project-promoted",
      "For the RIN_loading project, continue Package 5 memory work.",
      "2026-06-05T09:30:00.000Z",
    ),
    now: DEFAULT_NOW,
    expectedDecision: "promoted",
    expectedReasons: ["project_signal"],
  },
  {
    caseId: "contradiction-promoted",
    categories: ["contradiction"],
    message: fixtureMessage(
      "contradiction-promoted",
      "Actually, I no longer want that old notification behavior.",
      "2026-06-05T08:00:00.000Z",
    ),
    now: DEFAULT_NOW,
    expectedDecision: "promoted",
    expectedReasons: ["contradiction_signal"],
  },
  {
    caseId: "daily-weakened",
    categories: ["daily", "decay"],
    message: fixtureMessage(
      "daily-weakened",
      "Today I cooked noodles and checked the weather.",
      "2026-05-30T12:00:00.000Z",
    ),
    now: DEFAULT_NOW,
    expectedDecision: "weakened",
    expectedReasons: ["daily_signal", "decay_signal"],
  },
  {
    caseId: "low-signal-ignored",
    categories: ["low-signal"],
    message: fixtureMessage(
      "low-signal-ignored",
      "ok thanks",
      "2026-06-05T11:55:00.000Z",
    ),
    now: DEFAULT_NOW,
    expectedDecision: "ignored",
    expectedReasons: ["low_signal"],
  },
];

export function runMemoryV2ShadowEngine(
  database: RinDatabase,
  options: MemoryV2ShadowEngineOptions = {},
): MemoryV2ShadowReport {
  const now = options.now ?? new Date();
  const messages = listSourceMessages(database, {
    now,
    limit: options.limit ?? DEFAULT_SHADOW_LIMIT,
  });
  const analyses = messages.map((message) =>
    analyzeMemoryV2Source(
      message,
      now,
      traceExists(database, traceRefId(message.messageId)),
    ),
  );

  database.exec("BEGIN;");
  try {
    for (const analysis of analyses) {
      persistMemoryV2Analysis(database, analysis, now);
    }
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }

  return buildShadowReport(analyses);
}

export function analyzeMemoryV2Source(
  message: MemoryV2SourceMessage,
  now: Date,
  existingTrace: boolean = false,
): MemoryV2TraceAnalysis {
  const contentCharacterCount = message.content.length;
  const ageHours = ageInHours(message.createdAt, now);
  const extracted = extractSignals(message.content, contentCharacterCount);
  const baseScore = scoreBaseSignals(extracted.reasons);
  const stabilityHours = stabilityForReasons(extracted.reasons);
  const retentionScore = roundScore(
    baseScore * Math.exp(-ageHours / stabilityHours),
  );
  const reasons = [...extracted.reasons];

  if (retentionScore < baseScore && baseScore >= PROMOTION_THRESHOLD) {
    reasons.push("decay_signal");
    extracted.signals.push(signal("decay", "age_decay", -0.2, {
      contentCharacterCount,
      matchedPattern: "exp(-age/stability)",
    }));
  }

  if (existingTrace && retentionScore >= PROMOTION_THRESHOLD) {
    reasons.push("reinforcement_signal");
    extracted.signals.push(signal("reinforcement", "existing_trace", 0.25, {
      contentCharacterCount,
      matchedPattern: "existing-shadow-trace",
    }));
  }

  const decision = decideTrace(baseScore, retentionScore, existingTrace);

  return {
    sourceMessageId: message.messageId,
    sourceCreatedAt: message.createdAt,
    conversationId: message.conversationId,
    role: message.role,
    contentCharacterCount,
    ageHours,
    baseScore,
    stabilityHours,
    retentionScore,
    decision,
    reasons: uniqueReasons(reasons),
    signals: extracted.signals,
  };
}

export function runBuiltInMemoryV2Evaluation(): MemoryV2EvaluationRunResult {
  return runMemoryV2EvaluationCases(BUILT_IN_MEMORY_V2_EVALUATION_CASES);
}

export function runMemoryV2EvaluationCases(
  cases: readonly MemoryV2EvaluationCase[],
): MemoryV2EvaluationRunResult {
  const caseResults = cases.map(evaluateMemoryV2Case);
  const failedCaseIds = caseResults
    .filter((result) => !result.passed)
    .map((result) => result.caseId);

  return {
    mode: "memory-v2-eval",
    total: caseResults.length,
    passed: caseResults.length - failedCaseIds.length,
    failed: failedCaseIds.length,
    failedCaseIds,
    providerCallCount: 0,
    fullTextIncluded: false,
    caseResults,
  };
}

export function formatMemoryV2EvaluationSummary(
  result: MemoryV2EvaluationRunResult,
): string {
  return [
    "RIN Memory V2 evaluation.",
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
        `- ${item.caseId} passed=${item.passed ? "yes" : "no"} decision=${item.decision} reasons=${item.reasons.join(",")}`,
    ),
  ].join("\n");
}

export function formatMemoryV2ShadowReport(
  report: MemoryV2ShadowReport,
): string {
  return [
    "RIN Memory V2 shadow report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Shadow only: ${report.shadowOnly ? "yes" : "no"}`,
    `Source messages: ${report.sourceMessageCount}`,
    `Promoted: ${report.promotedCount}`,
    `Reinforced: ${report.reinforcedCount}`,
    `Weakened: ${report.weakenedCount}`,
    `Ignored: ${report.ignoredCount}`,
    `Shadow trace writes: ${report.shadowTraceWriteCount}`,
    `Shadow signal writes: ${report.shadowSignalWriteCount}`,
    `Retention formula: ${report.retentionFormula}`,
    `Production retrieval changed: ${
      report.productionRetrievalChanged ? "yes" : "no"
    }`,
    `Raw history mutations: ${report.rawHistoryMutationCount}`,
    `Accepted memory mutations: ${report.acceptedMemoryMutationCount}`,
    `Profile mutations: ${report.profileMutationCount}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Items:",
    ...formatShadowItems(report.items),
  ].join("\n");
}

function evaluateMemoryV2Case(
  item: MemoryV2EvaluationCase,
): MemoryV2EvaluationCaseResult {
  const analysis = analyzeMemoryV2Source(item.message, item.now);
  const failures: string[] = [];

  if (analysis.decision !== item.expectedDecision) {
    failures.push(
      `Expected decision ${item.expectedDecision}; actual=${analysis.decision}`,
    );
  }

  for (const reason of item.expectedReasons) {
    if (!analysis.reasons.includes(reason)) {
      failures.push(
        `Expected reason ${reason}; actual=${analysis.reasons.join(",")}`,
      );
    }
  }

  return {
    caseId: item.caseId,
    categories: [...item.categories],
    passed: failures.length === 0,
    failures,
    decision: analysis.decision,
    reasons: analysis.reasons,
  };
}

function listSourceMessages(
  database: RinDatabase,
  input: { now: Date; limit: number },
): MemoryV2SourceMessage[] {
  const limit = Math.max(1, Math.min(input.limit, 500));

  return database
    .prepare(
      `
        SELECT id, conversation_id, role, content, created_at
        FROM messages
        WHERE created_at <= ?
        ORDER BY created_at ASC, id ASC
        LIMIT ?
      `,
    )
    .all(input.now.toISOString(), limit)
    .map((row) => mapMessageRow(row as MessageRow));
}

function persistMemoryV2Analysis(
  database: RinDatabase,
  analysis: MemoryV2TraceAnalysis,
  now: Date,
): void {
  const sourceId = sourceRefId(analysis.sourceMessageId);
  const traceId = traceRefId(analysis.sourceMessageId);
  const timestamp = now.toISOString();
  const summary = safeSignalSummary(analysis);

  database
    .prepare(
      `
        INSERT INTO memory_v2_trace_sources (
          id,
          source_type,
          source_table,
          source_id,
          source_created_at,
          created_at
        )
        VALUES (?, 'conversation_message', 'messages', ?, ?, ?)
        ON CONFLICT(source_type, source_id) DO UPDATE SET
          source_created_at = excluded.source_created_at
      `,
    )
    .run(sourceId, analysis.sourceMessageId, analysis.sourceCreatedAt, timestamp);

  database
    .prepare(
      `
        INSERT INTO memory_v2_traces (
          id,
          source_ref_id,
          trace_kind,
          status,
          signal_summary_json,
          salience_score,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          trace_kind = excluded.trace_kind,
          status = excluded.status,
          signal_summary_json = excluded.signal_summary_json,
          salience_score = excluded.salience_score,
          updated_at = excluded.updated_at
      `,
    )
    .run(
      traceId,
      sourceId,
      traceKindForDecision(analysis.decision),
      statusForDecision(analysis.decision),
      JSON.stringify(summary),
      analysis.retentionScore,
      timestamp,
      timestamp,
    );

  database
    .prepare("DELETE FROM memory_v2_trace_signals WHERE trace_id = ?")
    .run(traceId);

  for (const item of analysis.signals) {
    database
      .prepare(
        `
          INSERT INTO memory_v2_trace_signals (
            id,
            trace_id,
            signal_type,
            signal_key,
            signal_weight,
            evidence_json,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        signalRefId(analysis.sourceMessageId, item),
        traceId,
        item.signalType,
        item.signalKey,
        item.signalWeight,
        JSON.stringify(item.evidence),
        timestamp,
      );
  }
}

function extractSignals(
  content: string,
  contentCharacterCount: number,
): { reasons: MemoryV2TraceReason[]; signals: MemoryV2Signal[] } {
  const normalized = content.toLocaleLowerCase();
  const reasons: MemoryV2TraceReason[] = [];
  const signals: MemoryV2Signal[] = [];

  if (hasPreferenceSignal(normalized)) {
    reasons.push("preference_signal");
    signals.push(signal("preference", "owner_preference", 0.65, {
      contentCharacterCount,
      matchedPattern: "preference",
    }));
  }

  if (hasProjectSignal(normalized)) {
    reasons.push("project_signal");
    signals.push(signal("project", "active_project", 0.6, {
      contentCharacterCount,
      matchedPattern: "project",
    }));
  }

  if (hasContradictionSignal(normalized)) {
    reasons.push("contradiction_signal");
    signals.push(signal("conflict", "contradiction", 0.7, {
      contentCharacterCount,
      matchedPattern: "contradiction",
    }));
  }

  if (reasons.length === 0 && content.trim().length > LOW_SIGNAL_MAX_CHARACTERS) {
    reasons.push("daily_signal");
    signals.push(signal("salience", "daily_event", 0.4, {
      contentCharacterCount,
      matchedPattern: "daily",
    }));
  }

  if (reasons.length === 0) {
    reasons.push("low_signal");
    signals.push(signal("low_signal", "short_acknowledgement", 0.05, {
      contentCharacterCount,
      matchedPattern: "low-signal",
    }));
  }

  signals.push(signal("recency", "message_age", 0.1, {
    contentCharacterCount,
    matchedPattern: "created_at",
  }));

  return { reasons: uniqueReasons(reasons), signals };
}

function scoreBaseSignals(reasons: readonly MemoryV2TraceReason[]): number {
  if (reasons.includes("contradiction_signal")) {
    return 0.8;
  }
  if (reasons.includes("preference_signal")) {
    return 0.75;
  }
  if (reasons.includes("project_signal")) {
    return 0.7;
  }
  if (reasons.includes("daily_signal")) {
    return 0.5;
  }
  return 0.1;
}

function stabilityForReasons(reasons: readonly MemoryV2TraceReason[]): number {
  if (reasons.includes("preference_signal")) {
    return 720;
  }
  if (reasons.includes("project_signal")) {
    return 336;
  }
  if (reasons.includes("contradiction_signal")) {
    return 168;
  }
  if (reasons.includes("daily_signal")) {
    return 72;
  }
  return 24;
}

function decideTrace(
  baseScore: number,
  retentionScore: number,
  existingTrace: boolean,
): MemoryV2TraceDecision {
  if (retentionScore >= PROMOTION_THRESHOLD) {
    return existingTrace ? "reinforced" : "promoted";
  }

  if (baseScore >= PROMOTION_THRESHOLD) {
    return "weakened";
  }

  return "ignored";
}

function buildShadowReport(
  analyses: readonly MemoryV2TraceAnalysis[],
): MemoryV2ShadowReport {
  const items = analyses.map(toReportItem);

  return {
    mode: "memory-v2-shadow-report",
    status: "ready",
    shadowOnly: true,
    sourceMessageCount: analyses.length,
    promotedCount: countDecision(items, "promoted"),
    reinforcedCount: countDecision(items, "reinforced"),
    weakenedCount: countDecision(items, "weakened"),
    ignoredCount: countDecision(items, "ignored"),
    shadowTraceWriteCount: analyses.length,
    shadowSignalWriteCount: analyses.reduce(
      (total, item) => total + item.signals.length,
      0,
    ),
    retentionFormula: "baseScore * exp(-ageHours / stabilityHours)",
    productionRetrievalChanged: false,
    rawHistoryMutationCount: 0,
    acceptedMemoryMutationCount: 0,
    profileMutationCount: 0,
    providerCallCount: 0,
    fullTextIncluded: false,
    items,
  };
}

function toReportItem(
  analysis: MemoryV2TraceAnalysis,
): MemoryV2ShadowReportItem {
  return {
    sourceMessageId: analysis.sourceMessageId,
    sourceCreatedAt: analysis.sourceCreatedAt,
    conversationId: analysis.conversationId,
    role: analysis.role,
    contentCharacterCount: analysis.contentCharacterCount,
    ageHours: analysis.ageHours,
    baseScore: analysis.baseScore,
    stabilityHours: analysis.stabilityHours,
    retentionScore: analysis.retentionScore,
    decision: analysis.decision,
    reasons: analysis.reasons,
    signalTypes: [...new Set(analysis.signals.map((item) => item.signalType))],
  };
}

function safeSignalSummary(
  analysis: MemoryV2TraceAnalysis,
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    rawTextIncluded: false,
    sourceMessageId: analysis.sourceMessageId,
    conversationId: analysis.conversationId,
    role: analysis.role,
    contentCharacterCount: analysis.contentCharacterCount,
    ageHours: analysis.ageHours,
    baseScore: analysis.baseScore,
    stabilityHours: analysis.stabilityHours,
    retentionScore: analysis.retentionScore,
    decision: analysis.decision,
    reasons: analysis.reasons,
    signalTypes: [...new Set(analysis.signals.map((item) => item.signalType))],
  };
}

function signal(
  signalType: MemoryV2SignalType,
  signalKey: string,
  signalWeight: number,
  evidence: Omit<MemoryV2Signal["evidence"], "rawTextIncluded">,
): MemoryV2Signal {
  return {
    signalType,
    signalKey,
    signalWeight,
    evidence: {
      rawTextIncluded: false,
      ...evidence,
    },
  };
}

function hasPreferenceSignal(content: string): boolean {
  return /\b(prefer|preference|like|want|希望|偏好|喜欢)\b/u.test(content);
}

function hasProjectSignal(content: string): boolean {
  return /\b(project|package|rin_loading|memory v2|计划|项目)\b/u.test(content);
}

function hasContradictionSignal(content: string): boolean {
  return /\b(actually|no longer|not anymore|instead|不要|不再|改为)\b/u.test(
    content,
  );
}

function uniqueReasons(
  reasons: readonly MemoryV2TraceReason[],
): MemoryV2TraceReason[] {
  return [...new Set(reasons)];
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function ageInHours(isoTimestamp: string, now: Date): number {
  const timestamp = Date.parse(isoTimestamp);

  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.round(((now.getTime() - timestamp) / 3600000) * 10) / 10);
}

function countDecision(
  items: readonly MemoryV2ShadowReportItem[],
  decision: MemoryV2TraceDecision,
): number {
  return items.filter((item) => item.decision === decision).length;
}

function formatShadowItems(
  items: readonly MemoryV2ShadowReportItem[],
): string[] {
  if (items.length === 0) {
    return ["none"];
  }

  return items.map(
    (item) =>
      `- message=${item.sourceMessageId} role=${item.role} decision=${item.decision} retention=${item.retentionScore} reasons=${item.reasons.join(",")} signals=${item.signalTypes.join(",")}`,
  );
}

function mapMessageRow(row: MessageRow): MemoryV2SourceMessage {
  return {
    messageId: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

function fixtureMessage(
  messageId: string,
  content: string,
  createdAt: string,
): MemoryV2SourceMessage {
  return {
    messageId,
    conversationId: "fixture-conversation",
    role: "owner",
    content,
    createdAt,
  };
}

function sourceRefId(messageId: string): string {
  return `memory-v2-source:${messageId}`;
}

function traceRefId(messageId: string): string {
  return `memory-v2-trace:${messageId}`;
}

function signalRefId(messageId: string, item: MemoryV2Signal): string {
  return `memory-v2-signal:${messageId}:${item.signalType}:${item.signalKey}`;
}

function traceExists(database: RinDatabase, traceId: string): boolean {
  const row = database
    .prepare("SELECT id FROM memory_v2_traces WHERE id = ?")
    .get(traceId);
  return row !== undefined;
}

function traceKindForDecision(decision: MemoryV2TraceDecision): string {
  switch (decision) {
    case "promoted":
      return "long_term_candidate";
    case "reinforced":
      return "reinforcement";
    case "weakened":
      return "decay";
    case "ignored":
      return "short_term_window";
  }
}

function statusForDecision(decision: MemoryV2TraceDecision): string {
  return decision === "ignored" ? "ignored" : "shadow";
}
