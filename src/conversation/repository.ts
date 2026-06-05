import { randomUUID } from "node:crypto";
import { appendAuditEvent, openRinDatabase, type RinDatabase } from "../database";
import type { RinDataLayout } from "../storage";
import type {
  ConversationMessageRecord,
  ConversationRecord,
  ConversationTurnRecord,
} from "./types";
import type { MemoryInjectionTrace } from "../memory";

type ConversationRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: "owner" | "rin" | "system";
  content: string;
  model_adapter: string | null;
  created_at: string;
  memory_context_json?: string | null;
};

type ConversationTurnRow = {
  id: string;
  conversation_id: string;
  owner_message_id: string;
  rin_message_id: string | null;
  status: ConversationTurnRecord["status"];
  attempt_count: number;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  failed_at: string | null;
};

export function createConversation(
  database: RinDatabase,
  title: string,
  now: Date,
): ConversationRecord {
  const id = randomUUID();
  const timestamp = now.toISOString();

  database
    .prepare(
      `
        INSERT INTO conversations (id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(id, title, timestamp, timestamp);

  appendAuditEvent(database, {
    eventType: "conversation.created",
    payload: { conversationId: id },
    now,
  });

  return {
    id,
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function appendConversationMessage(
  database: RinDatabase,
  input: {
    conversationId: string;
    role: ConversationMessageRecord["role"];
    content: string;
    modelAdapter?: string | null;
    now: Date;
  },
): ConversationMessageRecord {
  const id = randomUUID();
  const timestamp = input.now.toISOString();
  const modelAdapter = input.modelAdapter ?? null;

  database
    .prepare(
      `
        INSERT INTO messages (
          id,
          conversation_id,
          role,
          content,
          model_adapter,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      input.conversationId,
      input.role,
      input.content,
      modelAdapter,
      timestamp,
    );

  database
    .prepare("UPDATE conversations SET updated_at = ? WHERE id = ?")
    .run(timestamp, input.conversationId);

  appendAuditEvent(database, {
    eventType: "conversation.message_appended",
    payload: {
      conversationId: input.conversationId,
      messageId: id,
      role: input.role,
      modelAdapter,
    },
    now: input.now,
  });

  return {
    id,
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    modelAdapter,
    createdAt: timestamp,
    memoryContext: null,
  };
}

export function appendMessageMemoryContext(
  database: RinDatabase,
  input: {
    messageId: string;
    memoryContext: MemoryInjectionTrace;
    now: Date;
  },
): void {
  database
    .prepare(
      `
        INSERT INTO message_memory_contexts (
          message_id,
          trace_json,
          created_at
        )
        VALUES (?, ?, ?)
      `,
    )
    .run(
      input.messageId,
      JSON.stringify(safeMemoryContextTrace(input.memoryContext)),
      input.now.toISOString(),
    );
}

export function createConversationTurn(
  database: RinDatabase,
  input: {
    id: string;
    conversationId: string;
    ownerMessageId: string;
    now: Date;
  },
): ConversationTurnRecord {
  const timestamp = input.now.toISOString();

  database
    .prepare(
      `
        INSERT INTO conversation_turns (
          id,
          conversation_id,
          owner_message_id,
          rin_message_id,
          status,
          attempt_count,
          error_code,
          created_at,
          updated_at,
          completed_at,
          failed_at
        )
        VALUES (?, ?, ?, NULL, 'started', 1, NULL, ?, ?, NULL, NULL)
      `,
    )
    .run(
      input.id,
      input.conversationId,
      input.ownerMessageId,
      timestamp,
      timestamp,
    );

  appendAuditEvent(database, {
    eventType: "conversation.turn_started",
    payload: {
      turnId: input.id,
      conversationId: input.conversationId,
      ownerMessageId: input.ownerMessageId,
      attemptCount: 1,
    },
    now: input.now,
  });

  return getConversationTurn(database, input.id);
}

export function getConversationTurn(
  database: RinDatabase,
  turnId: string,
): ConversationTurnRecord {
  const row = database
    .prepare("SELECT * FROM conversation_turns WHERE id = ?")
    .get(turnId) as ConversationTurnRow | undefined;

  if (!row) {
    throw new Error(`Conversation turn not found: ${turnId}`);
  }

  return mapConversationTurn(row);
}

export function findConversationTurn(
  database: RinDatabase,
  turnId: string,
): ConversationTurnRecord | null {
  const row = database
    .prepare("SELECT * FROM conversation_turns WHERE id = ?")
    .get(turnId) as ConversationTurnRow | undefined;

  return row ? mapConversationTurn(row) : null;
}

export function markConversationTurnStarted(
  database: RinDatabase,
  input: {
    turnId: string;
    now: Date;
  },
): ConversationTurnRecord {
  const current = getConversationTurn(database, input.turnId);
  const nextAttemptCount =
    current.status === "completed" ? current.attemptCount : current.attemptCount + 1;

  database
    .prepare(
      `
        UPDATE conversation_turns
        SET status = 'started',
            attempt_count = ?,
            error_code = NULL,
            updated_at = ?,
            failed_at = NULL
        WHERE id = ?
      `,
    )
    .run(nextAttemptCount, input.now.toISOString(), input.turnId);

  appendAuditEvent(database, {
    eventType: "conversation.turn_retry_started",
    payload: {
      turnId: input.turnId,
      conversationId: current.conversationId,
      ownerMessageId: current.ownerMessageId,
      attemptCount: nextAttemptCount,
    },
    now: input.now,
  });

  return getConversationTurn(database, input.turnId);
}

export function markConversationTurnCompleted(
  database: RinDatabase,
  input: {
    turnId: string;
    rinMessageId: string;
    now: Date;
  },
): ConversationTurnRecord {
  database
    .prepare(
      `
        UPDATE conversation_turns
        SET status = 'completed',
            rin_message_id = ?,
            error_code = NULL,
            updated_at = ?,
            completed_at = ?,
            failed_at = NULL
        WHERE id = ?
      `,
    )
    .run(
      input.rinMessageId,
      input.now.toISOString(),
      input.now.toISOString(),
      input.turnId,
    );

  return getConversationTurn(database, input.turnId);
}

export function markConversationTurnFailed(
  database: RinDatabase,
  input: {
    turnId: string;
    errorCode: string;
    now: Date;
  },
): ConversationTurnRecord {
  database
    .prepare(
      `
        UPDATE conversation_turns
        SET status = 'failed',
            error_code = ?,
            updated_at = ?,
            failed_at = ?
        WHERE id = ?
      `,
    )
    .run(
      input.errorCode,
      input.now.toISOString(),
      input.now.toISOString(),
      input.turnId,
    );

  return getConversationTurn(database, input.turnId);
}

export function getConversation(
  database: RinDatabase,
  conversationId: string,
): ConversationRecord {
  const row = database
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(conversationId) as ConversationRow | undefined;

  if (!row) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  return mapConversation(row);
}

export function getConversationMessage(
  database: RinDatabase,
  messageId: string,
): ConversationMessageRecord {
  const row = database
    .prepare(
      `
        SELECT
          messages.*,
          message_memory_contexts.trace_json AS memory_context_json
        FROM messages
        LEFT JOIN message_memory_contexts
          ON message_memory_contexts.message_id = messages.id
        WHERE messages.id = ?
      `,
    )
    .get(messageId) as MessageRow | undefined;

  if (!row) {
    throw new Error(`Conversation message not found: ${messageId}`);
  }

  return mapMessage(row);
}

export function listConversationMessages(
  database: RinDatabase,
  conversationId: string,
): ConversationMessageRecord[] {
  return database
    .prepare(
      `
        SELECT
          messages.*,
          message_memory_contexts.trace_json AS memory_context_json
        FROM messages
        LEFT JOIN message_memory_contexts
          ON message_memory_contexts.message_id = messages.id
        WHERE messages.conversation_id = ?
        ORDER BY messages.created_at ASC
      `,
    )
    .all(conversationId)
    .map((row) => mapMessage(row as MessageRow));
}

export function listRecentConversations(
  layout: RinDataLayout,
  limit: number = 10,
): ConversationRecord[] {
  const database = openRinDatabase(layout);

  try {
    return database
      .prepare(
        `
          SELECT * FROM conversations
          ORDER BY updated_at DESC
          LIMIT ?
        `,
      )
      .all(limit)
      .map((row) => mapConversation(row as ConversationRow));
  } finally {
    database.close();
  }
}

function mapConversation(row: ConversationRow): ConversationRecord {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConversationTurn(row: ConversationTurnRow): ConversationTurnRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    ownerMessageId: row.owner_message_id,
    rinMessageId: row.rin_message_id,
    status: row.status,
    attemptCount: row.attempt_count,
    errorCode: row.error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
  };
}

function mapMessage(row: MessageRow): ConversationMessageRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    modelAdapter: row.model_adapter,
    createdAt: row.created_at,
    memoryContext: parseMemoryContextTrace(row.memory_context_json ?? null),
  };
}

function safeMemoryContextTrace(
  trace: MemoryInjectionTrace,
): MemoryInjectionTrace {
  return {
    injectedMemoryCount: trace.injectedMemoryCount,
    injectedMemoryIds: [...trace.injectedMemoryIds],
    deterministicInjectedMemoryIds: [
      ...(trace.deterministicInjectedMemoryIds ?? trace.injectedMemoryIds),
    ],
    semanticInjectedMemoryIds: [...(trace.semanticInjectedMemoryIds ?? [])],
    semanticCandidateIds: [...(trace.semanticCandidateIds ?? [])],
    semanticContextExpansionEnabled:
      trace.semanticContextExpansionEnabled ?? false,
    memoryContextCharacterCount: trace.memoryContextCharacterCount,
    skippedByBudgetCount: trace.skippedByBudgetCount,
    skippedByRelevanceCount: trace.skippedByRelevanceCount,
    skippedByMaxCountCount: trace.skippedByMaxCountCount,
    items: trace.items.map((item) => ({
      memoryId: item.memoryId,
      memoryType: item.memoryType ?? "semantic",
      matchedKeywords: [...item.matchedKeywords],
      overlapCount: item.overlapCount,
      latinTokenMatchCount: item.latinTokenMatchCount,
      cjkBigramMatchCount: item.cjkBigramMatchCount,
      normalizedQueryTokenCount: item.normalizedQueryTokenCount,
      typeMatchBonus: item.typeMatchBonus ?? 0,
      matchedTypeSignals: [...(item.matchedTypeSignals ?? [])],
      matchedTags: [...(item.matchedTags ?? [])],
      tagMatchBonus: item.tagMatchBonus ?? 0,
      importanceBonus: item.importanceBonus ?? 0,
      confidenceAdjustment: item.confidenceAdjustment ?? 0,
      metadataBonus: item.metadataBonus ?? 0,
      metadataSignals: [...(item.metadataSignals ?? [])],
      contextSource: item.contextSource ?? "deterministic",
      wasInjected: item.wasInjected,
      skippedReason: item.skippedReason,
      snippetLength: item.snippetLength,
    })),
  };
}

function parseMemoryContextTrace(raw: string | null): MemoryInjectionTrace | null {
  if (!raw) {
    return null;
  }

  try {
    return safeMemoryContextTrace(JSON.parse(raw) as MemoryInjectionTrace);
  } catch {
    return null;
  }
}
