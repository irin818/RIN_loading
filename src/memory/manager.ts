import { randomUUID } from "node:crypto";
import { appendAuditEvent, type RinDatabase } from "../database";
import type { ConversationMessageRecord } from "../conversation";

export type MemoryType =
  | "raw_log"
  | "episodic"
  | "semantic"
  | "preference"
  | "procedural"
  | "goal"
  | "project"
  | "reflection"
  | "identity";

export type MemoryImportance = "low" | "normal" | "high";
export type MemoryConfidence = "low" | "medium" | "high";

export type MemoryMetadata = {
  tags: string[];
  importance: MemoryImportance;
  confidence: MemoryConfidence;
  source: string | null;
  reviewedAt: string | null;
  acceptedAt: string | null;
};

export type MemoryMetadataInput = {
  tags?: readonly string[];
  importance?: MemoryImportance;
  confidence?: MemoryConfidence;
  source?: string | null;
};

export type MemoryProposal = {
  id: string;
  memoryType: MemoryType;
  content: Record<string, unknown>;
  metadata: MemoryMetadata;
  sourceMessageId: string | null;
  status: "proposal";
  createdAt: string;
  updatedAt: string;
};

export type MemoryStatus = "proposal" | "accepted" | "rejected" | "archived";

export type MemoryRecord = Omit<MemoryProposal, "status"> & {
  status: MemoryStatus;
};

export type MemoryReviewDecision = "accept" | "reject" | "archive";

type MemoryItemRow = {
  id: string;
  memory_type: MemoryType;
  content_json: string;
  source_message_id: string | null;
  status: MemoryStatus;
  created_at: string;
  updated_at: string;
  metadata_json: string | null;
  metadata_reviewed_at: string | null;
  metadata_accepted_at: string | null;
  metadata_updated_at: string | null;
};

const DEFAULT_MEMORY_IMPORTANCE: MemoryImportance = "normal";
const DEFAULT_MEMORY_CONFIDENCE: MemoryConfidence = "medium";
const MAX_METADATA_TAGS = 8;
const MAX_METADATA_TAG_LENGTH = 32;
const MAX_METADATA_SOURCE_LENGTH = 96;

export function maybeCreateOwnerMemoryProposal(
  database: RinDatabase,
  ownerMessage: ConversationMessageRecord,
  now: Date,
): MemoryProposal | null {
  const marker = "/remember ";

  if (!ownerMessage.content.startsWith(marker)) {
    return null;
  }

  return createMemoryProposal(database, {
    memoryType: "semantic",
    content: {
      english: "Owner explicitly requested a memory proposal.",
      chinese: "所有者明确请求创建一条记忆提案。",
      text: ownerMessage.content.slice(marker.length).trim(),
    },
    sourceMessageId: ownerMessage.id,
    now,
  });
}

export function createMemoryProposal(
  database: RinDatabase,
  input: {
    memoryType: MemoryType;
    content: Record<string, unknown>;
    sourceMessageId?: string | null;
    now: Date;
  },
): MemoryProposal {
  const id = randomUUID();
  const timestamp = input.now.toISOString();

  database
    .prepare(
      `
        INSERT INTO memory_items (
          id,
          memory_type,
          content_json,
          source_message_id,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, 'proposal', ?, ?)
      `,
    )
    .run(
      id,
      input.memoryType,
      JSON.stringify(input.content),
      input.sourceMessageId ?? null,
      timestamp,
      timestamp,
    );

  appendAuditEvent(database, {
    eventType: "memory.proposal_created",
    payload: {
      memoryItemId: id,
      memoryType: input.memoryType,
      sourceMessageId: input.sourceMessageId ?? null,
    },
    now: input.now,
  });

  return {
    id,
    memoryType: input.memoryType,
    content: input.content,
    metadata: defaultMemoryMetadata(),
    sourceMessageId: input.sourceMessageId ?? null,
    status: "proposal",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function listMemoryItems(
  database: RinDatabase,
  input: {
    status?: MemoryStatus;
    limit?: number;
  } = {},
): MemoryRecord[] {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 100));

  if (input.status) {
    return database
      .prepare(
        `
          ${memoryItemSelectSql()}
          WHERE memory_items.status = ?
          ORDER BY memory_items.updated_at DESC
          LIMIT ?
        `,
      )
      .all(input.status, limit)
      .map((row) => mapMemoryItem(row as MemoryItemRow));
  }

  return database
    .prepare(
      `
        ${memoryItemSelectSql()}
        ORDER BY memory_items.updated_at DESC
        LIMIT ?
      `,
    )
    .all(limit)
    .map((row) => mapMemoryItem(row as MemoryItemRow));
}

export function getMemoryItem(
  database: RinDatabase,
  memoryItemId: string,
): MemoryRecord {
  const row = database
    .prepare(
      `
        ${memoryItemSelectSql()}
        WHERE memory_items.id = ?
      `,
    )
    .get(memoryItemId) as MemoryItemRow | undefined;

  if (!row) {
    throw new Error(`Memory item not found: ${memoryItemId}`);
  }

  return mapMemoryItem(row);
}

export function reviewMemoryProposal(
  database: RinDatabase,
  input: {
    memoryItemId: string;
    decision: MemoryReviewDecision;
    reason?: string | null;
    metadata?: MemoryMetadataInput;
    now: Date;
  },
): MemoryRecord {
  const current = getMemoryItem(database, input.memoryItemId);
  const nextStatus = statusForDecision(input.decision);

  if (
    (input.decision === "accept" || input.decision === "reject") &&
    current.status !== "proposal"
  ) {
    throw new Error(
      `Only memory proposals can be ${input.decision}ed: ${input.memoryItemId}`,
    );
  }

  if (input.decision === "archive" && current.status === "archived") {
    throw new Error(`Memory item is already archived: ${input.memoryItemId}`);
  }

  const timestamp = input.now.toISOString();

  database
    .prepare(
      `
        UPDATE memory_items
        SET status = ?, updated_at = ?
        WHERE id = ?
      `,
    )
    .run(nextStatus, timestamp, input.memoryItemId);

  const metadata = normalizeMemoryMetadata(input.metadata, current.metadata, {
    reviewedAt: timestamp,
    acceptedAt:
      nextStatus === "accepted"
        ? (current.metadata.acceptedAt ?? timestamp)
        : current.metadata.acceptedAt,
  });
  upsertMemoryMetadata(database, input.memoryItemId, metadata, timestamp);

  appendAuditEvent(database, {
    eventType: "memory.proposal_reviewed",
    payload: {
      memoryItemId: input.memoryItemId,
      memoryType: current.memoryType,
      decision: input.decision,
      previousStatus: current.status,
      nextStatus,
      reason: input.reason ?? null,
      sourceMessageId: current.sourceMessageId,
      metadata: auditMemoryMetadata(metadata),
    },
    now: input.now,
  });

  return {
    ...current,
    metadata,
    status: nextStatus,
    updatedAt: timestamp,
  };
}

export function updateMemoryMetadata(
  database: RinDatabase,
  input: {
    memoryItemId: string;
    metadata: MemoryMetadataInput;
    reason?: string | null;
    now: Date;
  },
): MemoryRecord {
  const current = getMemoryItem(database, input.memoryItemId);
  const timestamp = input.now.toISOString();
  const metadata = normalizeMemoryMetadata(input.metadata, current.metadata, {
    reviewedAt: timestamp,
    acceptedAt: current.metadata.acceptedAt,
  });

  upsertMemoryMetadata(database, input.memoryItemId, metadata, timestamp);

  appendAuditEvent(database, {
    eventType: "memory.metadata_reviewed",
    payload: {
      memoryItemId: input.memoryItemId,
      memoryType: current.memoryType,
      status: current.status,
      reason: input.reason ?? null,
      metadata: auditMemoryMetadata(metadata),
    },
    now: input.now,
  });

  return {
    ...current,
    metadata,
  };
}

export function getMemoryCounts(database: RinDatabase): {
  proposals: number;
  accepted: number;
  rejected: number;
  archived: number;
} {
  return {
    proposals: countMemoryStatus(database, "proposal"),
    accepted: countMemoryStatus(database, "accepted"),
    rejected: countMemoryStatus(database, "rejected"),
    archived: countMemoryStatus(database, "archived"),
  };
}

function countMemoryStatus(database: RinDatabase, status: string): number {
  const row = database
    .prepare("SELECT COUNT(*) AS count FROM memory_items WHERE status = ?")
    .get(status);
  return Number((row as { count: number }).count);
}

function statusForDecision(decision: MemoryReviewDecision): MemoryStatus {
  switch (decision) {
    case "accept":
      return "accepted";
    case "reject":
      return "rejected";
    case "archive":
      return "archived";
  }
}

function mapMemoryItem(row: MemoryItemRow): MemoryRecord {
  return {
    id: row.id,
    memoryType: row.memory_type,
    content: parseMemoryContent(row.content_json),
    metadata: parseMemoryMetadata(row),
    sourceMessageId: row.source_message_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseMemoryContent(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as unknown;

  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function memoryItemSelectSql(): string {
  return `
    SELECT
      memory_items.*,
      memory_metadata.metadata_json AS metadata_json,
      memory_metadata.reviewed_at AS metadata_reviewed_at,
      memory_metadata.accepted_at AS metadata_accepted_at,
      memory_metadata.updated_at AS metadata_updated_at
    FROM memory_items
    LEFT JOIN memory_metadata
      ON memory_metadata.memory_id = memory_items.id
  `;
}

function defaultMemoryMetadata(): MemoryMetadata {
  return {
    tags: [],
    importance: DEFAULT_MEMORY_IMPORTANCE,
    confidence: DEFAULT_MEMORY_CONFIDENCE,
    source: null,
    reviewedAt: null,
    acceptedAt: null,
  };
}

function normalizeMemoryMetadata(
  input: MemoryMetadataInput | undefined,
  existing: MemoryMetadata = defaultMemoryMetadata(),
  timestamps: {
    reviewedAt?: string | null;
    acceptedAt?: string | null;
  } = {},
): MemoryMetadata {
  return {
    tags:
      input?.tags !== undefined ? normalizeTags(input.tags) : [...existing.tags],
    importance:
      input?.importance !== undefined
        ? normalizeImportance(input.importance)
        : existing.importance,
    confidence:
      input?.confidence !== undefined
        ? normalizeConfidence(input.confidence)
        : existing.confidence,
    source:
      input?.source !== undefined ? normalizeSource(input.source) : existing.source,
    reviewedAt:
      timestamps.reviewedAt !== undefined
        ? timestamps.reviewedAt
        : existing.reviewedAt,
    acceptedAt:
      timestamps.acceptedAt !== undefined
        ? timestamps.acceptedAt
        : existing.acceptedAt,
  };
}

function normalizeTags(tags: readonly string[]): string[] {
  const normalized = tags
    .map((tag) =>
      tag
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\u4e00-\u9fff_-]/gu, ""),
    )
    .filter((tag) => tag.length > 0)
    .map((tag) => tag.slice(0, MAX_METADATA_TAG_LENGTH));

  return [...new Set(normalized)].slice(0, MAX_METADATA_TAGS);
}

function normalizeImportance(value: MemoryImportance): MemoryImportance {
  if (value === "low" || value === "normal" || value === "high") {
    return value;
  }

  throw new Error(`Invalid memory importance: ${String(value)}`);
}

function normalizeConfidence(value: MemoryConfidence): MemoryConfidence {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  throw new Error(`Invalid memory confidence: ${String(value)}`);
}

function normalizeSource(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();

  return normalized.length > 0
    ? normalized.slice(0, MAX_METADATA_SOURCE_LENGTH)
    : null;
}

function upsertMemoryMetadata(
  database: RinDatabase,
  memoryItemId: string,
  metadata: MemoryMetadata,
  updatedAt: string,
): void {
  database
    .prepare(
      `
        INSERT INTO memory_metadata (
          memory_id,
          metadata_json,
          reviewed_at,
          accepted_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(memory_id) DO UPDATE SET
          metadata_json = excluded.metadata_json,
          reviewed_at = excluded.reviewed_at,
          accepted_at = excluded.accepted_at,
          updated_at = excluded.updated_at
      `,
    )
    .run(
      memoryItemId,
      JSON.stringify({
        tags: metadata.tags,
        importance: metadata.importance,
        confidence: metadata.confidence,
        source: metadata.source,
      }),
      metadata.reviewedAt,
      metadata.acceptedAt,
      updatedAt,
    );
}

function parseMemoryMetadata(row: MemoryItemRow): MemoryMetadata {
  const fallback = defaultMemoryMetadata();

  if (!row.metadata_json) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(row.metadata_json) as unknown;
    const record =
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};

    return {
      tags: Array.isArray(record.tags)
        ? normalizeTags(
            record.tags.filter((tag): tag is string => typeof tag === "string"),
          )
        : [],
      importance:
        record.importance === "low" ||
        record.importance === "normal" ||
        record.importance === "high"
          ? record.importance
          : DEFAULT_MEMORY_IMPORTANCE,
      confidence:
        record.confidence === "low" ||
        record.confidence === "medium" ||
        record.confidence === "high"
          ? record.confidence
          : DEFAULT_MEMORY_CONFIDENCE,
      source: typeof record.source === "string" ? normalizeSource(record.source) : null,
      reviewedAt: row.metadata_reviewed_at,
      acceptedAt: row.metadata_accepted_at,
    };
  } catch {
    return fallback;
  }
}

function auditMemoryMetadata(metadata: MemoryMetadata): MemoryMetadata {
  return {
    tags: [...metadata.tags],
    importance: metadata.importance,
    confidence: metadata.confidence,
    source: metadata.source,
    reviewedAt: metadata.reviewedAt,
    acceptedAt: metadata.acceptedAt,
  };
}
