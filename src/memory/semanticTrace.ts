import { appendAuditEvent, type RinDatabase } from "../database";
import type { HybridRetrievalReport } from "./hybridRetrievalReport";
import type { SemanticAcceptedMemoryIndexReport } from "./semanticAcceptedMemoryIndex";

export type SemanticTraceKind =
  | "accepted-memory-index-report"
  | "hybrid-retrieval-report"
  | "semantic-context-expansion";

export type SemanticTracePayload = {
  schemaVersion: 1;
  traceKind: SemanticTraceKind;
  reportMode: string;
  status: string;
  enabled: boolean;
  optInSatisfied: boolean;
  candidateIds: string[];
  deterministicCandidateIds: string[];
  semanticCandidateIds: string[];
  hybridCandidateIds: string[];
  semanticOnlyCandidateIds: string[];
  deterministicOnlyCandidateIds: string[];
  overlapCandidateIds: string[];
  acceptedOnlyViolationIds: string[];
  falsePositiveIds: string[];
  falseNegativeIds: string[];
  skippedNonAcceptedIds: string[];
  providerId: string | null;
  providerMode: string | null;
  providerKind: string | null;
  modelId: string | null;
  topK: number | null;
  candidateCap: number | null;
  indexedAcceptedMemoryCount: number;
  skippedNonAcceptedCount: number;
  embeddingRequestCount: number;
  providerCallCount: number;
  errorCode: string | null;
  productionIntegrationEnabled: boolean;
  contextInjectionEnabled: boolean;
  fullTextIncluded: false;
  vectorIncluded: false;
};

export type SemanticTraceRecord = {
  id: string;
  eventType: typeof SEMANTIC_TRACE_AUDIT_EVENT_TYPE;
  createdAt: string;
  trace: SemanticTracePayload;
};

export type SemanticTraceListOptions = {
  limit?: number;
};

export const SEMANTIC_TRACE_AUDIT_EVENT_TYPE = "semantic.trace_recorded";

type SemanticTraceAuditRow = {
  id: string;
  event_type: string;
  payload_json: string;
  created_at: string;
};

const DEFAULT_TRACE_LIST_LIMIT = 20;

export function semanticTraceFromAcceptedMemoryIndexReport(
  report: SemanticAcceptedMemoryIndexReport,
): SemanticTracePayload {
  return sanitizeSemanticTracePayload({
    schemaVersion: 1,
    traceKind: "accepted-memory-index-report",
    reportMode: report.mode,
    status: report.status,
    enabled: report.enabled,
    optInSatisfied: report.optInSatisfied,
    candidateIds: report.candidateIds,
    deterministicCandidateIds: [],
    semanticCandidateIds: report.candidateIds,
    hybridCandidateIds: [],
    semanticOnlyCandidateIds: [],
    deterministicOnlyCandidateIds: [],
    overlapCandidateIds: [],
    acceptedOnlyViolationIds: [],
    falsePositiveIds: [],
    falseNegativeIds: [],
    skippedNonAcceptedIds: report.skippedNonAcceptedIds,
    providerId: report.providerId,
    providerMode: report.providerMode,
    providerKind: report.providerKind,
    modelId: report.modelId,
    topK: report.topK,
    candidateCap: report.candidateCap,
    indexedAcceptedMemoryCount: report.indexedAcceptedMemoryCount,
    skippedNonAcceptedCount: report.skippedNonAcceptedCount,
    embeddingRequestCount: report.embeddingRequestCount,
    providerCallCount: report.providerCallCount,
    errorCode: report.errorCode,
    productionIntegrationEnabled: report.productionIntegrationEnabled,
    contextInjectionEnabled: report.contextInjectionEnabled,
    fullTextIncluded: false,
    vectorIncluded: false,
  });
}

export function semanticTraceFromHybridRetrievalReport(
  report: HybridRetrievalReport,
): SemanticTracePayload {
  return sanitizeSemanticTracePayload({
    schemaVersion: 1,
    traceKind: "hybrid-retrieval-report",
    reportMode: report.mode,
    status: report.status,
    enabled: report.enabled,
    optInSatisfied: report.optInSatisfied,
    candidateIds: report.hybridCandidateIds,
    deterministicCandidateIds: report.deterministicCandidateIds,
    semanticCandidateIds: report.semanticCandidateIds,
    hybridCandidateIds: report.hybridCandidateIds,
    semanticOnlyCandidateIds: report.semanticOnlyCandidateIds,
    deterministicOnlyCandidateIds: report.deterministicOnlyCandidateIds,
    overlapCandidateIds: report.overlapCandidateIds,
    acceptedOnlyViolationIds: report.acceptedOnlyViolationIds,
    falsePositiveIds: report.falsePositiveIds,
    falseNegativeIds: report.falseNegativeIds,
    skippedNonAcceptedIds:
      report.semanticIndexReport?.skippedNonAcceptedIds ?? [],
    providerId: report.semanticIndexReport?.providerId ?? null,
    providerMode: report.semanticIndexReport?.providerMode ?? null,
    providerKind: report.semanticIndexReport?.providerKind ?? null,
    modelId: report.semanticIndexReport?.modelId ?? null,
    topK: report.semanticIndexReport?.topK ?? null,
    candidateCap: report.semanticIndexReport?.candidateCap ?? null,
    indexedAcceptedMemoryCount:
      report.semanticIndexReport?.indexedAcceptedMemoryCount ?? 0,
    skippedNonAcceptedCount:
      report.semanticIndexReport?.skippedNonAcceptedCount ?? 0,
    embeddingRequestCount: report.semanticIndexReport?.embeddingRequestCount ?? 0,
    providerCallCount: report.providerCallCount,
    errorCode: report.errorCode ?? report.semanticIndexReport?.errorCode ?? null,
    productionIntegrationEnabled: report.productionIntegrationEnabled,
    contextInjectionEnabled: report.contextInjectionEnabled,
    fullTextIncluded: false,
    vectorIncluded: false,
  });
}

export function sanitizeSemanticTracePayload(
  payload: SemanticTracePayload,
): SemanticTracePayload {
  return {
    schemaVersion: 1,
    traceKind: readTraceKind(payload.traceKind),
    reportMode: readSafeString(payload.reportMode),
    status: readSafeString(payload.status),
    enabled: Boolean(payload.enabled),
    optInSatisfied: Boolean(payload.optInSatisfied),
    candidateIds: safeIds(payload.candidateIds),
    deterministicCandidateIds: safeIds(payload.deterministicCandidateIds),
    semanticCandidateIds: safeIds(payload.semanticCandidateIds),
    hybridCandidateIds: safeIds(payload.hybridCandidateIds),
    semanticOnlyCandidateIds: safeIds(payload.semanticOnlyCandidateIds),
    deterministicOnlyCandidateIds: safeIds(payload.deterministicOnlyCandidateIds),
    overlapCandidateIds: safeIds(payload.overlapCandidateIds),
    acceptedOnlyViolationIds: safeIds(payload.acceptedOnlyViolationIds),
    falsePositiveIds: safeIds(payload.falsePositiveIds),
    falseNegativeIds: safeIds(payload.falseNegativeIds),
    skippedNonAcceptedIds: safeIds(payload.skippedNonAcceptedIds),
    providerId: safeNullableString(payload.providerId),
    providerMode: safeNullableString(payload.providerMode),
    providerKind: safeNullableString(payload.providerKind),
    modelId: safeNullableString(payload.modelId),
    topK: safeNullableNumber(payload.topK),
    candidateCap: safeNullableNumber(payload.candidateCap),
    indexedAcceptedMemoryCount: safeCount(payload.indexedAcceptedMemoryCount),
    skippedNonAcceptedCount: safeCount(payload.skippedNonAcceptedCount),
    embeddingRequestCount: safeCount(payload.embeddingRequestCount),
    providerCallCount: safeCount(payload.providerCallCount),
    errorCode: safeNullableString(payload.errorCode),
    productionIntegrationEnabled: Boolean(payload.productionIntegrationEnabled),
    contextInjectionEnabled: Boolean(payload.contextInjectionEnabled),
    fullTextIncluded: false,
    vectorIncluded: false,
  };
}

export function recordSemanticTrace(
  database: RinDatabase,
  input: { trace: SemanticTracePayload; now?: Date },
): string {
  return appendAuditEvent(database, {
    eventType: SEMANTIC_TRACE_AUDIT_EVENT_TYPE,
    payload: sanitizeSemanticTracePayload(input.trace),
    now: input.now,
  });
}

export function listSemanticTraceRecords(
  database: RinDatabase,
  options: SemanticTraceListOptions = {},
): SemanticTraceRecord[] {
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_TRACE_LIST_LIMIT, 100));

  return database
    .prepare(
      `
        SELECT id, event_type, payload_json, created_at
        FROM audit_events
        WHERE event_type = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
    )
    .all(SEMANTIC_TRACE_AUDIT_EVENT_TYPE, limit)
    .map((row) => mapSemanticTraceRow(row as SemanticTraceAuditRow))
    .filter((record): record is SemanticTraceRecord => record !== null);
}

export function getSemanticTraceRecord(
  database: RinDatabase,
  traceId: string,
): SemanticTraceRecord | null {
  const row = database
    .prepare(
      `
        SELECT id, event_type, payload_json, created_at
        FROM audit_events
        WHERE event_type = ? AND id = ?
      `,
    )
    .get(SEMANTIC_TRACE_AUDIT_EVENT_TYPE, traceId) as
    | SemanticTraceAuditRow
    | undefined;

  return row ? mapSemanticTraceRow(row) : null;
}

export function formatSemanticTraceList(
  records: readonly SemanticTraceRecord[],
): string {
  return [
    "RIN semantic trace list.",
    `Total listed: ${records.length}`,
    ...records.map(
      (record) =>
        `- ${record.id} ${record.trace.traceKind} status=${record.trace.status} candidates=${record.trace.candidateIds.length} providerCallCount=${record.trace.providerCallCount}`,
    ),
  ].join("\n");
}

export function formatSemanticTraceRecord(
  record: SemanticTraceRecord | null,
): string {
  if (!record) {
    return [
      "RIN semantic trace record.",
      "Status: not_found",
      "Full text included: no",
      "Vector included: no",
    ].join("\n");
  }

  const trace = record.trace;
  return [
    "RIN semantic trace record.",
    `Trace ID: ${record.id}`,
    `Created at: ${record.createdAt}`,
    `Trace kind: ${trace.traceKind}`,
    `Report mode: ${trace.reportMode}`,
    `Status: ${trace.status}`,
    `Enabled: ${trace.enabled ? "yes" : "no"}`,
    `Opt-in satisfied: ${trace.optInSatisfied ? "yes" : "no"}`,
    `Candidate IDs: ${formatIds(trace.candidateIds)}`,
    `Deterministic candidate IDs: ${formatIds(trace.deterministicCandidateIds)}`,
    `Semantic candidate IDs: ${formatIds(trace.semanticCandidateIds)}`,
    `Hybrid candidate IDs: ${formatIds(trace.hybridCandidateIds)}`,
    `Semantic-only candidate IDs: ${formatIds(trace.semanticOnlyCandidateIds)}`,
    `Deterministic-only candidate IDs: ${formatIds(
      trace.deterministicOnlyCandidateIds,
    )}`,
    `Overlap candidate IDs: ${formatIds(trace.overlapCandidateIds)}`,
    `Accepted-only violation IDs: ${formatIds(trace.acceptedOnlyViolationIds)}`,
    `False positive IDs: ${formatIds(trace.falsePositiveIds)}`,
    `False negative IDs: ${formatIds(trace.falseNegativeIds)}`,
    `Skipped non-accepted IDs: ${formatIds(trace.skippedNonAcceptedIds)}`,
    `Provider: ${trace.providerId ?? "none"}`,
    `Provider mode: ${trace.providerMode ?? "none"}`,
    `Provider kind: ${trace.providerKind ?? "none"}`,
    `Model id: ${trace.modelId ?? "none"}`,
    `topK: ${trace.topK ?? "none"}`,
    `candidateCap: ${trace.candidateCap ?? "none"}`,
    `Indexed accepted memories: ${trace.indexedAcceptedMemoryCount}`,
    `Skipped non-accepted memories: ${trace.skippedNonAcceptedCount}`,
    `Embedding requests: ${trace.embeddingRequestCount}`,
    `providerCallCount: ${trace.providerCallCount}`,
    `Error code: ${trace.errorCode ?? "none"}`,
    `Production integration enabled: ${
      trace.productionIntegrationEnabled ? "yes" : "no"
    }`,
    `Context injection enabled: ${trace.contextInjectionEnabled ? "yes" : "no"}`,
    `Full text included: ${trace.fullTextIncluded ? "yes" : "no"}`,
    `Vector included: ${trace.vectorIncluded ? "yes" : "no"}`,
  ].join("\n");
}

function mapSemanticTraceRow(row: SemanticTraceAuditRow): SemanticTraceRecord | null {
  try {
    const parsed = JSON.parse(row.payload_json) as SemanticTracePayload;
    return {
      id: row.id,
      eventType: SEMANTIC_TRACE_AUDIT_EVENT_TYPE,
      createdAt: row.created_at,
      trace: sanitizeSemanticTracePayload(parsed),
    };
  } catch {
    return null;
  }
}

function readTraceKind(value: string): SemanticTraceKind {
  return value === "accepted-memory-index-report" ||
    value === "hybrid-retrieval-report" ||
    value === "semantic-context-expansion"
    ? value
    : "accepted-memory-index-report";
}

function readSafeString(value: string): string {
  return value.trim().slice(0, 96);
}

function safeNullableString(value: string | null): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().slice(0, 96)
    : null;
}

function safeNullableNumber(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : null;
}

function safeCount(value: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function safeIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => isSafeId(id)).map((id) => id.slice(0, 128)))].sort();
}

function isSafeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9._:-]+$/.test(value)
  );
}

function formatIds(ids: readonly string[]): string {
  return ids.length > 0 ? ids.join(", ") : "none";
}
