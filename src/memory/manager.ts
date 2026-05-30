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

export type MemoryProposal = {
  id: string;
  memoryType: MemoryType;
  content: Record<string, unknown>;
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
};

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
          SELECT * FROM memory_items
          WHERE status = ?
          ORDER BY updated_at DESC
          LIMIT ?
        `,
      )
      .all(input.status, limit)
      .map((row) => mapMemoryItem(row as MemoryItemRow));
  }

  return database
    .prepare(
      `
        SELECT * FROM memory_items
        ORDER BY updated_at DESC
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
    .prepare("SELECT * FROM memory_items WHERE id = ?")
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
    },
    now: input.now,
  });

  return {
    ...current,
    status: nextStatus,
    updatedAt: timestamp,
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
