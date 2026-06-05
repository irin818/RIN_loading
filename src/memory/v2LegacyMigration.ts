import { appendAuditEvent, type RinDatabase } from "../database";
import {
  getMemoryItem,
  listMemoryItems,
  type MemoryRecord,
  type MemoryType,
} from "./manager";
import {
  retrieveAcceptedMemoriesWithExplanation,
  type AcceptedMemoryRetrievalResult,
  type MemoryRetrievalOptions,
} from "./retrieval";

export type MemoryV2LegacyMigrationMode = "dry-run" | "apply" | "status";

export type MemoryV2ProductionRetrievalSource =
  | "memory-v2-legacy-traces"
  | "legacy-fallback-until-migration-complete";

export type MemoryV2LegacyMigrationStatus = {
  legacyAcceptedMemoryCount: number;
  migratedLegacyMemoryCount: number;
  pendingLegacyMemoryCount: number;
  pendingLegacyMemoryIds: string[];
  migratedLegacyMemoryIds: string[];
  rawMessageCount: number;
  memoryItemCount: number;
  canUseMemoryV2ProductionRetrieval: boolean;
  productionRetrievalSource: MemoryV2ProductionRetrievalSource;
};

export type MemoryV2LegacyMigrationReport = {
  mode: `memory-v2-legacy-migration-${MemoryV2LegacyMigrationMode}`;
  status: "ready" | "needs_apply";
  dryRunOnly: boolean;
  applied: boolean;
  legacyAcceptedMemoryCount: number;
  migratedLegacyMemoryCount: number;
  pendingLegacyMemoryCount: number;
  pendingLegacyMemoryIds: string[];
  newlyMigratedLegacyMemoryCount: number;
  traceWriteCount: number;
  signalWriteCount: number;
  preservedLegacyRecordCount: number;
  rawMessageCount: number;
  rawHistoryMutationCount: 0;
  acceptedMemoryMutationCount: 0;
  profileMutationCount: 0;
  providerCallCount: 0;
  fullTextIncluded: false;
  idempotent: true;
  reversibleByKeepingLegacyRecords: true;
  rememberCommandStatus: "legacy_proposal_only";
  productionRetrievalSource: MemoryV2ProductionRetrievalSource;
};

export type MemoryV2ProductionCandidateSet = {
  memories: MemoryRecord[];
  retrievalSource: MemoryV2ProductionRetrievalSource;
  legacyAcceptedMemoryCount: number;
  migratedLegacyMemoryCount: number;
  pendingLegacyMemoryCount: number;
};

type AcceptedMemoryIdRow = {
  id: string;
};

type CountRow = {
  count: number;
};

const MAX_REPORTED_IDS = 25;
const DEFAULT_PRODUCTION_CANDIDATE_LIMIT = 50;

export function buildMemoryV2LegacyMigrationDryRunReport(
  database: RinDatabase,
): MemoryV2LegacyMigrationReport {
  return buildMigrationReport("dry-run", getMemoryV2LegacyMigrationStatus(database));
}

export function buildMemoryV2LegacyMigrationStatusReport(
  database: RinDatabase,
): MemoryV2LegacyMigrationReport {
  return buildMigrationReport("status", getMemoryV2LegacyMigrationStatus(database));
}

export function applyMemoryV2LegacyMigration(
  database: RinDatabase,
  now: Date = new Date(),
): MemoryV2LegacyMigrationReport {
  const before = getMemoryV2LegacyMigrationStatus(database);
  const acceptedMemories = listAcceptedMemoryIds(database).map((id) =>
    getMemoryItem(database, id),
  );
  const timestamp = now.toISOString();

  database.exec("BEGIN;");
  try {
    for (const memory of acceptedMemories) {
      persistLegacyMemoryTrace(database, memory, timestamp);
    }

    appendAuditEvent(database, {
      eventType: "memory_v2.legacy_migration_applied",
      payload: {
        legacyAcceptedMemoryCount: before.legacyAcceptedMemoryCount,
        previouslyMigratedLegacyMemoryCount: before.migratedLegacyMemoryCount,
        newlyMigratedLegacyMemoryCount: before.pendingLegacyMemoryCount,
        rawHistoryMutationCount: 0,
        acceptedMemoryMutationCount: 0,
        profileMutationCount: 0,
        fullTextIncluded: false,
      },
      now,
    });
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }

  const after = getMemoryV2LegacyMigrationStatus(database);

  return {
    ...buildMigrationReport("apply", after),
    applied: true,
    newlyMigratedLegacyMemoryCount: before.pendingLegacyMemoryCount,
    traceWriteCount: acceptedMemories.length,
    signalWriteCount: acceptedMemories.length,
  };
}

export function getMemoryV2LegacyMigrationStatus(
  database: RinDatabase,
): MemoryV2LegacyMigrationStatus {
  const acceptedIds = listAcceptedMemoryIds(database);
  const migratedIds = listMigratedAcceptedMemoryIds(database);
  const migrated = new Set(migratedIds);
  const pendingIds = acceptedIds.filter((id) => !migrated.has(id));
  const canUseMemoryV2ProductionRetrieval = pendingIds.length === 0;

  return {
    legacyAcceptedMemoryCount: acceptedIds.length,
    migratedLegacyMemoryCount: migratedIds.length,
    pendingLegacyMemoryCount: pendingIds.length,
    pendingLegacyMemoryIds: pendingIds.slice(0, MAX_REPORTED_IDS),
    migratedLegacyMemoryIds: migratedIds.slice(0, MAX_REPORTED_IDS),
    rawMessageCount: countRows(database, "messages"),
    memoryItemCount: countRows(database, "memory_items"),
    canUseMemoryV2ProductionRetrieval,
    productionRetrievalSource: canUseMemoryV2ProductionRetrieval
      ? "memory-v2-legacy-traces"
      : "legacy-fallback-until-migration-complete",
  };
}

export function getMemoryV2ProductionCandidateMemories(
  database: RinDatabase,
  options: { limit?: number } = {},
): MemoryV2ProductionCandidateSet {
  const limit = Math.max(
    1,
    Math.min(options.limit ?? DEFAULT_PRODUCTION_CANDIDATE_LIMIT, 100),
  );
  const status = getMemoryV2LegacyMigrationStatus(database);

  if (!status.canUseMemoryV2ProductionRetrieval) {
    return {
      memories: listMemoryItems(database, { status: "accepted", limit }),
      retrievalSource: "legacy-fallback-until-migration-complete",
      legacyAcceptedMemoryCount: status.legacyAcceptedMemoryCount,
      migratedLegacyMemoryCount: status.migratedLegacyMemoryCount,
      pendingLegacyMemoryCount: status.pendingLegacyMemoryCount,
    };
  }

  return {
    memories: listProductionMemoryIdsViaMemoryV2(database, limit).map((id) =>
      getMemoryItem(database, id),
    ),
    retrievalSource: "memory-v2-legacy-traces",
    legacyAcceptedMemoryCount: status.legacyAcceptedMemoryCount,
    migratedLegacyMemoryCount: status.migratedLegacyMemoryCount,
    pendingLegacyMemoryCount: status.pendingLegacyMemoryCount,
  };
}

export function retrieveAcceptedMemoriesViaMemoryV2(
  database: RinDatabase,
  ownerMessage: string,
  options: MemoryRetrievalOptions & { limit?: number } = {},
): AcceptedMemoryRetrievalResult {
  const candidateSet = getMemoryV2ProductionCandidateMemories(database, {
    limit: options.limit,
  });
  const result = retrieveAcceptedMemoriesWithExplanation(
    candidateSet.memories,
    ownerMessage,
    options,
  );

  return {
    ...result,
    retrievalSource: candidateSet.retrievalSource,
    legacyAcceptedMemoryCount: candidateSet.legacyAcceptedMemoryCount,
    migratedLegacyMemoryCount: candidateSet.migratedLegacyMemoryCount,
    pendingLegacyMemoryCount: candidateSet.pendingLegacyMemoryCount,
  };
}

export function formatMemoryV2LegacyMigrationReport(
  report: MemoryV2LegacyMigrationReport,
): string {
  return [
    "RIN Memory V2 legacy migration report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Dry run only: ${report.dryRunOnly ? "yes" : "no"}`,
    `Applied: ${report.applied ? "yes" : "no"}`,
    `Legacy accepted memories: ${report.legacyAcceptedMemoryCount}`,
    `Migrated legacy memories: ${report.migratedLegacyMemoryCount}`,
    `Pending legacy memories: ${report.pendingLegacyMemoryCount}`,
    `Pending legacy memory IDs: ${
      report.pendingLegacyMemoryIds.length > 0
        ? report.pendingLegacyMemoryIds.join(", ")
        : "none"
    }`,
    `Newly migrated legacy memories: ${report.newlyMigratedLegacyMemoryCount}`,
    `Trace writes: ${report.traceWriteCount}`,
    `Signal writes: ${report.signalWriteCount}`,
    `Preserved legacy records: ${report.preservedLegacyRecordCount}`,
    `Raw message count: ${report.rawMessageCount}`,
    `Raw history mutations: ${report.rawHistoryMutationCount}`,
    `Accepted memory mutations: ${report.acceptedMemoryMutationCount}`,
    `Profile mutations: ${report.profileMutationCount}`,
    `Production retrieval source: ${report.productionRetrievalSource}`,
    `Remember command status: ${report.rememberCommandStatus}`,
    `Idempotent: ${report.idempotent ? "yes" : "no"}`,
    `Reversible by keeping legacy records: ${
      report.reversibleByKeepingLegacyRecords ? "yes" : "no"
    }`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
  ].join("\n");
}

function buildMigrationReport(
  mode: MemoryV2LegacyMigrationMode,
  status: MemoryV2LegacyMigrationStatus,
): MemoryV2LegacyMigrationReport {
  return {
    mode: `memory-v2-legacy-migration-${mode}`,
    status:
      status.pendingLegacyMemoryCount === 0 || mode === "apply"
        ? "ready"
        : "needs_apply",
    dryRunOnly: mode === "dry-run",
    applied: false,
    legacyAcceptedMemoryCount: status.legacyAcceptedMemoryCount,
    migratedLegacyMemoryCount: status.migratedLegacyMemoryCount,
    pendingLegacyMemoryCount: status.pendingLegacyMemoryCount,
    pendingLegacyMemoryIds: [...status.pendingLegacyMemoryIds],
    newlyMigratedLegacyMemoryCount: 0,
    traceWriteCount: 0,
    signalWriteCount: 0,
    preservedLegacyRecordCount: status.memoryItemCount,
    rawMessageCount: status.rawMessageCount,
    rawHistoryMutationCount: 0,
    acceptedMemoryMutationCount: 0,
    profileMutationCount: 0,
    providerCallCount: 0,
    fullTextIncluded: false,
    idempotent: true,
    reversibleByKeepingLegacyRecords: true,
    rememberCommandStatus: "legacy_proposal_only",
    productionRetrievalSource: status.productionRetrievalSource,
  };
}

function persistLegacyMemoryTrace(
  database: RinDatabase,
  memory: MemoryRecord,
  timestamp: string,
): void {
  const sourceId = legacySourceRefId(memory.id);
  const traceId = legacyTraceRefId(memory.id);
  const signalId = legacySignalRefId(memory.id);
  const contentCharacterCount = JSON.stringify(memory.content).length;
  const salienceScore = salienceForLegacyMemory(memory);

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
        VALUES (?, 'legacy_memory_item', 'memory_items', ?, ?, ?)
        ON CONFLICT(source_type, source_id) DO UPDATE SET
          source_created_at = excluded.source_created_at
      `,
    )
    .run(sourceId, memory.id, memory.createdAt, timestamp);

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
        VALUES (?, ?, 'retrieval_candidate', 'promoted', ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          source_ref_id = excluded.source_ref_id,
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
      JSON.stringify({
        schemaVersion: 1,
        rawTextIncluded: false,
        sourceType: "legacy_memory_item",
        memoryItemId: memory.id,
        memoryType: memory.memoryType,
        sourceMessageId: memory.sourceMessageId,
        contentCharacterCount,
        metadata: {
          tagCount: memory.metadata.tags.length,
          importance: memory.metadata.importance,
          confidence: memory.metadata.confidence,
          reviewedAtPresent: memory.metadata.reviewedAt !== null,
          acceptedAtPresent: memory.metadata.acceptedAt !== null,
        },
        status: memory.status,
      }),
      salienceScore,
      timestamp,
      timestamp,
    );

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
        VALUES (?, ?, 'reinforcement', 'legacy_accepted_memory', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          signal_weight = excluded.signal_weight,
          evidence_json = excluded.evidence_json
      `,
    )
    .run(
      signalId,
      traceId,
      salienceScore,
      JSON.stringify({
        rawTextIncluded: false,
        memoryItemId: memory.id,
        memoryType: memory.memoryType,
        status: memory.status,
        contentCharacterCount,
        matchedPattern: "legacy-accepted-memory",
      }),
      timestamp,
    );
}

function listAcceptedMemoryIds(database: RinDatabase): string[] {
  return database
    .prepare(
      `
        SELECT id
        FROM memory_items
        WHERE status = 'accepted'
        ORDER BY updated_at DESC, id ASC
      `,
    )
    .all()
    .map((row) => (row as AcceptedMemoryIdRow).id);
}

function listMigratedAcceptedMemoryIds(database: RinDatabase): string[] {
  return database
    .prepare(
      `
        SELECT memory_items.id AS id
        FROM memory_items
        INNER JOIN memory_v2_trace_sources
          ON memory_v2_trace_sources.source_id = memory_items.id
         AND memory_v2_trace_sources.source_type = 'legacy_memory_item'
         AND memory_v2_trace_sources.source_table = 'memory_items'
        INNER JOIN memory_v2_traces
          ON memory_v2_traces.source_ref_id = memory_v2_trace_sources.id
         AND memory_v2_traces.trace_kind = 'retrieval_candidate'
         AND memory_v2_traces.status IN ('promoted', 'shadow')
        WHERE memory_items.status = 'accepted'
        ORDER BY memory_items.updated_at DESC, memory_items.id ASC
      `,
    )
    .all()
    .map((row) => (row as AcceptedMemoryIdRow).id);
}

function listProductionMemoryIdsViaMemoryV2(
  database: RinDatabase,
  limit: number,
): string[] {
  return database
    .prepare(
      `
        SELECT memory_items.id AS id
        FROM memory_items
        INNER JOIN memory_v2_trace_sources
          ON memory_v2_trace_sources.source_id = memory_items.id
         AND memory_v2_trace_sources.source_type = 'legacy_memory_item'
         AND memory_v2_trace_sources.source_table = 'memory_items'
        INNER JOIN memory_v2_traces
          ON memory_v2_traces.source_ref_id = memory_v2_trace_sources.id
         AND memory_v2_traces.trace_kind = 'retrieval_candidate'
         AND memory_v2_traces.status IN ('promoted', 'shadow')
        WHERE memory_items.status = 'accepted'
        ORDER BY memory_v2_traces.salience_score DESC,
                 memory_items.updated_at DESC,
                 memory_items.id ASC
        LIMIT ?
      `,
    )
    .all(limit)
    .map((row) => (row as AcceptedMemoryIdRow).id);
}

function salienceForLegacyMemory(memory: MemoryRecord): number {
  const importance =
    memory.metadata.importance === "high"
      ? 0.2
      : memory.metadata.importance === "low"
        ? -0.1
        : 0;
  const confidence =
    memory.metadata.confidence === "high"
      ? 0.1
      : memory.metadata.confidence === "low"
        ? -0.1
        : 0;
  const type = salienceForMemoryType(memory.memoryType);

  return Math.max(
    0.1,
    Math.min(1, roundScore(0.65 + importance + confidence + type)),
  );
}

function salienceForMemoryType(memoryType: MemoryType): number {
  switch (memoryType) {
    case "preference":
    case "identity":
      return 0.1;
    case "goal":
    case "project":
    case "procedural":
      return 0.05;
    default:
      return 0;
  }
}

function countRows(database: RinDatabase, tableName: string): number {
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get();
  return Number((row as CountRow).count);
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function legacySourceRefId(memoryItemId: string): string {
  return `memory-v2-source:legacy-memory:${memoryItemId}`;
}

function legacyTraceRefId(memoryItemId: string): string {
  return `memory-v2-trace:legacy-memory:${memoryItemId}`;
}

function legacySignalRefId(memoryItemId: string): string {
  return `memory-v2-signal:legacy-memory:${memoryItemId}:accepted`;
}
