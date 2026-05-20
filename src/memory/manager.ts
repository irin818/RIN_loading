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
