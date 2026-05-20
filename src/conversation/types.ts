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
};

export type ConversationTurnResult = {
  conversation: ConversationRecord;
  ownerMessage: ConversationMessageRecord;
  rinMessage: ConversationMessageRecord;
};
