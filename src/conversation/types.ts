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

export type ConversationTurnResult = {
  conversation: ConversationRecord;
  ownerMessage: ConversationMessageRecord;
  rinMessage: ConversationMessageRecord;
  memoryContext: MemoryInjectionTrace | null;
};
