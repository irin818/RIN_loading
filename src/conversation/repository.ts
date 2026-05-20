import { randomUUID } from "node:crypto";
import { appendAuditEvent, openRinDatabase, type RinDatabase } from "../database";
import type { RinDataLayout } from "../storage";
import type {
  ConversationMessageRecord,
  ConversationRecord,
} from "./types";

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
  };
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

export function listConversationMessages(
  database: RinDatabase,
  conversationId: string,
): ConversationMessageRecord[] {
  return database
    .prepare(
      `
        SELECT * FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC
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

function mapMessage(row: MessageRow): ConversationMessageRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    modelAdapter: row.model_adapter,
    createdAt: row.created_at,
  };
}
