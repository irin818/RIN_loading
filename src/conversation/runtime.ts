import {
  appendConversationMessage,
  createConversation,
  getConversation,
  listConversationMessages,
} from "./repository";
import type { ConversationTurnResult } from "./types";
import { buildModelContext } from "../context";
import { appendAuditEvent, openRinDatabase } from "../database";
import { maybeCreateOwnerMemoryProposal } from "../memory";
import { getConfiguredModelAdapter } from "../model";
import { evaluateModelResponse } from "../policy";
import { appendRawEvent } from "../rawLog";
import { snapshotSlowVariables } from "../slowVariables";
import { updateStateAfterConversation } from "../state";
import type { RinDataLayout } from "../storage";

export type ProcessOwnerMessageInput = {
  content: string;
  ownerId: string;
  conversationId?: string;
  now?: Date;
};

export async function processOwnerMessage(
  layout: RinDataLayout,
  input: ProcessOwnerMessageInput,
): Promise<ConversationTurnResult> {
  const content = input.content.trim();

  if (content.length === 0) {
    throw new Error("Owner message cannot be empty.");
  }

  const now = input.now ?? new Date();
  const database = openRinDatabase(layout);

  try {
    database.exec("BEGIN;");

    const conversation = input.conversationId
      ? getConversation(database, input.conversationId)
      : createConversation(database, titleFromContent(content), now);

    const ownerMessage = appendConversationMessage(database, {
      conversationId: conversation.id,
      role: "owner",
      content,
      now,
    });
    appendRawEvent(database, {
      eventType: "conversation.owner_message_received",
      source: "owner",
      payload: {
        conversationId: conversation.id,
        messageId: ownerMessage.id,
        content,
      },
      now,
    });
    const memoryProposal = maybeCreateOwnerMemoryProposal(
      database,
      ownerMessage,
      now,
    );
    const conversationMessages = [
      ...listConversationMessages(database, conversation.id).map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];
    const modelContext = buildModelContext(conversationMessages);
    const adapter = await getConfiguredModelAdapter(layout);
    const modelResponse = await adapter.generate({
      ownerId: input.ownerId,
      conversationId: conversation.id,
      messages: modelContext.messages,
    });
    const policyDecision = evaluateModelResponse(modelResponse);

    appendRawEvent(database, {
      eventType: "model.response_received",
      source: modelResponse.adapterId,
      payload: {
        conversationId: conversation.id,
        metadata: modelResponse.metadata,
        policyDecision,
        contextBudgetApplied: modelContext.stats.contextBudgetApplied,
        modelContextMessageCount: modelContext.stats.messageCount,
        modelContextCharacterCount: modelContext.stats.characterCount,
        modelContextDroppedMessageCount: modelContext.stats.droppedMessageCount,
      },
      now,
    });

    if (!policyDecision.allowed) {
      throw new Error(policyDecision.reasonEnglish);
    }

    const rinMessage = appendConversationMessage(database, {
      conversationId: conversation.id,
      role: "rin",
      content: modelResponse.content,
      modelAdapter: modelResponse.adapterId,
      now,
    });
    await updateStateAfterConversation(database, layout, now);
    await snapshotSlowVariables(database, layout, "conversation.turn_completed", now);

    appendAuditEvent(database, {
      eventType: "conversation.turn_completed",
      payload: {
        conversationId: conversation.id,
        ownerMessageId: ownerMessage.id,
        rinMessageId: rinMessage.id,
        modelAdapter: modelResponse.adapterId,
        memoryProposalId: memoryProposal?.id ?? null,
        contextBudgetApplied: modelContext.stats.contextBudgetApplied,
        modelContextMessageCount: modelContext.stats.messageCount,
        modelContextCharacterCount: modelContext.stats.characterCount,
        modelContextDroppedMessageCount: modelContext.stats.droppedMessageCount,
      },
      now,
    });

    database.exec("COMMIT;");

    return {
      conversation: {
        ...conversation,
        updatedAt: rinMessage.createdAt,
      },
      ownerMessage,
      rinMessage,
    };
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  } finally {
    database.close();
  }
}

function titleFromContent(content: string): string {
  return content.length > 48 ? `${content.slice(0, 45)}...` : content;
}
