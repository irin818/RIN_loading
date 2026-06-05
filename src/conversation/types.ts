import type { MemoryInjectionTrace } from "../memory";

export type ConversationRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversationMessageRecord = {
  id: string;
  conversationId: string;
  role: "owner" | "rin" | "system";
  content: string;
  modelAdapter: string | null;
  createdAt: string;
  memoryContext: MemoryInjectionTrace | null;
};

export type ConversationTurnStatus = "started" | "completed" | "failed";

export type ConversationTurnRecord = {
  id: string;
  conversationId: string;
  ownerMessageId: string;
  rinMessageId: string | null;
  status: ConversationTurnStatus;
  attemptCount: number;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  failedAt: string | null;
};

export type ConversationTurnResult = {
  turn: ConversationTurnRecord;
  conversation: ConversationRecord;
  ownerMessage: ConversationMessageRecord;
  rinMessage: ConversationMessageRecord;
  memoryContext: MemoryInjectionTrace | null;
};
