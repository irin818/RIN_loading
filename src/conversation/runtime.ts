import {
  appendConversationMessage,
  createConversation,
  getConversation,
  listConversationMessages,
} from "./repository";
import { ConversationError, toConversationError } from "./errors";
import type { ConversationTurnResult } from "./types";
import { buildModelContext } from "../context";
import { appendAuditEvent, openRinDatabase, type RinDatabase } from "../database";
import { maybeCreateOwnerMemoryProposal } from "../memory";
import { getConfiguredModelAdapter, type ModelAdapter } from "../model";
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

export type ProcessOwnerMessageDeps = {
  resolveAdapter?: (layout: RinDataLayout) => Promise<ModelAdapter>;
};

export async function processOwnerMessage(
  layout: RinDataLayout,
  input: ProcessOwnerMessageInput,
  deps: ProcessOwnerMessageDeps = {},
): Promise<ConversationTurnResult> {
  const content = input.content.trim();

  if (content.length === 0) {
    throw new Error("Owner message cannot be empty.");
  }

  const resolveAdapter = deps.resolveAdapter ?? getConfiguredModelAdapter;
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
    const adapter = await resolveAdapter(layout);
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
    const conversationError = toConversationError(error);
    logTurnFailure(database, conversationError, input, now);
    throw conversationError;
  } finally {
    database.close();
  }
}

/**
 * Record a failed turn after the transaction has been rolled back so the failure
 * is auditable without persisting a fake RIN reply. The owner message is not
 * stored on failure because the whole turn transaction was rolled back. Only
 * safe metadata is logged: no stack traces, secrets, or local paths.
 */
function logTurnFailure(
  database: RinDatabase,
  conversationError: ConversationError,
  input: ProcessOwnerMessageInput,
  now: Date,
): void {
  const payload = {
    conversationId: input.conversationId ?? null,
    errorCode: conversationError.payload.code,
    provider: conversationError.payload.provider,
    modelAdapter: conversationError.payload.modelAdapter,
    retryable: conversationError.payload.retryable,
  };

  try {
    appendRawEvent(database, {
      eventType: "conversation.turn_failed",
      source: conversationError.payload.modelAdapter ?? "conversation",
      payload,
      now,
    });
    appendAuditEvent(database, {
      eventType: "conversation.turn_failed",
      payload,
      now,
    });
  } catch {
    // Logging the failure must never mask the original conversation error.
  }
}

function titleFromContent(content: string): string {
  return content.length > 48 ? `${content.slice(0, 45)}...` : content;
}
