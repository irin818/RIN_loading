import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  appendMessageMemoryContext,
  appendConversationMessage,
  createConversationTurn,
  createConversation,
  findConversationTurn,
  getConversation,
  getConversationMessage,
  getConversationTurn,
  listConversationMessages,
  markConversationTurnCompleted,
  markConversationTurnFailed,
  markConversationTurnStarted,
} from "./repository";
import {
  ConversationError,
  toConversationError,
  withConversationTurnDetails,
} from "./errors";
import type {
  ConversationMessageRecord,
  ConversationRecord,
  ConversationTurnRecord,
  ConversationTurnResult,
} from "./types";
import {
  buildModelContext,
  DEFAULT_MAX_INJECTED_MEMORIES,
  readSemanticContextConfig,
} from "../context";
import { appendAuditEvent, openRinDatabase, type RinDatabase } from "../database";
import {
  getMemoryV2ProductionCandidateMemories,
  maybeCreateOwnerMemoryProposal,
  retrieveAcceptedMemoriesWithExplanation,
  selectSemanticContextExpansionCandidates,
  toMemoryInjectionTrace,
  type AcceptedMemoryRetrievalResult,
} from "../memory";
import { getConfiguredModelAdapter, type ModelAdapter } from "../model";
import { evaluateModelResponse } from "../policy";
import { buildProfileContextMessage, loadProfileContext } from "../profile";
import { appendRawEvent } from "../rawLog";
import { snapshotSlowVariables } from "../slowVariables";
import { updateStateAfterConversation } from "../state";
import type { RinDataLayout } from "../storage";

export type ProcessOwnerMessageInput = {
  content: string;
  ownerId: string;
  conversationId?: string;
  turnId?: string;
  now?: Date;
};

export type ProcessOwnerMessageDeps = {
  resolveAdapter?: (layout: RinDataLayout) => Promise<ModelAdapter>;
  retrieveAcceptedMemories?: (
    database: RinDatabase,
    ownerMessage: string,
  ) => AcceptedMemoryRetrievalResult;
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
  const retrieveAcceptedMemories =
    deps.retrieveAcceptedMemories ?? defaultRetrieveAcceptedMemories;
  const now = input.now ?? new Date();
  const turnId = normalizeTurnId(input.turnId) ?? randomUUID();
  const startedAtMs = performance.now();
  const timing: TurnTiming = {};
  const database = openRinDatabase(layout);

  try {
    const preModelPersistenceStartedAtMs = performance.now();
    const persistedTurn = persistTurnStart(
      database,
      {
        ...input,
        content,
        turnId,
      },
      now,
    );
    timing.preModelPersistenceMs = elapsedMs(preModelPersistenceStartedAtMs);

    if (persistedTurn.turn.status === "completed") {
      return loadCompletedTurnResult(database, persistedTurn.turn);
    }

    const conversationMessages = listConversationMessages(
      database,
      persistedTurn.conversation.id,
    ).map((message) => ({
      role: message.role,
      content: message.content,
    }));
    const memoryRetrieval = retrieveAcceptedMemories(database, content);
    const profileContext = await loadProfileContext(layout);
    const profileContextMessage = buildProfileContextMessage(profileContext);
    const semanticCandidateIds = memoryRetrieval.explanations
      .filter((item) => item.contextSource === "semantic")
      .map((item) => item.memoryId);
    const modelContext = buildModelContext(conversationMessages, undefined, {
      memories: memoryRetrieval.snippets,
      explanations: memoryRetrieval.explanations,
      semanticCandidateIds,
      semanticContextExpansionEnabled: semanticCandidateIds.length > 0,
      maxInjectedMemories:
        DEFAULT_MAX_INJECTED_MEMORIES + semanticCandidateIds.length,
      profileContext: profileContextMessage,
    });
    const memoryContextTrace = toMemoryInjectionTrace(
      modelContext.stats.memoryInjectionExplanations,
      modelContext.stats.injectedMemoryIds,
      modelContext.stats.memoryContextCharacterCount,
    );
    const adapter = await resolveAdapter(layout);
    const modelCallStartedAtMs = performance.now();
    let modelResponse: Awaited<ReturnType<ModelAdapter["generate"]>>;

    try {
      modelResponse = await adapter.generate({
        ownerId: input.ownerId,
        conversationId: persistedTurn.conversation.id,
        messages: modelContext.messages,
      });
      timing.modelCallMs = elapsedMs(modelCallStartedAtMs);
    } catch (error) {
      timing.modelCallMs = elapsedMs(modelCallStartedAtMs);
      const conversationError = toConversationError(error);
      const failedTurn = persistTurnFailure(
        database,
        persistedTurn.turn,
        conversationError,
        now,
        timing,
        startedAtMs,
      );
      throw withConversationTurnDetails(conversationError, failedTurn);
    }

    const completionPersistenceStartedAtMs = performance.now();

    try {
      database.exec("BEGIN;");

      const currentTurn = getConversationTurn(database, persistedTurn.turn.id);
      if (currentTurn.status === "completed") {
        database.exec("COMMIT;");
        return loadCompletedTurnResult(database, currentTurn);
      }

      const policyDecision = evaluateModelResponse(modelResponse);

      appendRawEvent(database, {
        eventType: "model.response_received",
        source: modelResponse.adapterId,
        payload: {
          turnId: persistedTurn.turn.id,
          conversationId: persistedTurn.conversation.id,
          metadata: modelResponse.metadata,
          policyDecision,
          contextBudgetApplied: modelContext.stats.contextBudgetApplied,
          modelContextMessageCount: modelContext.stats.messageCount,
          modelContextCharacterCount: modelContext.stats.characterCount,
          modelContextDroppedMessageCount:
            modelContext.stats.droppedMessageCount,
          injectedMemoryCount: modelContext.stats.injectedMemoryCount,
          injectedMemoryIds: modelContext.stats.injectedMemoryIds,
          deterministicInjectedMemoryIds:
            modelContext.stats.deterministicInjectedMemoryIds,
          semanticInjectedMemoryIds: modelContext.stats.semanticInjectedMemoryIds,
          semanticCandidateIds: modelContext.stats.semanticCandidateIds,
          semanticContextExpansionEnabled:
            modelContext.stats.semanticContextExpansionEnabled,
          memoryContextCharacterCount:
            modelContext.stats.memoryContextCharacterCount,
          memoryRetrievalSource:
            memoryRetrieval.retrievalSource ?? "legacy-memory-items",
          legacyAcceptedMemoryCount:
            memoryRetrieval.legacyAcceptedMemoryCount ?? null,
          migratedLegacyMemoryCount:
            memoryRetrieval.migratedLegacyMemoryCount ?? null,
          pendingLegacyMemoryCount:
            memoryRetrieval.pendingLegacyMemoryCount ?? null,
          profileContextIncluded: modelContext.stats.profileContextIncluded,
          profileContextCharacterCount:
            modelContext.stats.profileContextCharacterCount,
          memorySkippedByBudgetCount: memoryContextTrace.skippedByBudgetCount,
          memorySkippedByRelevanceCount: memoryContextTrace.skippedByRelevanceCount,
          memorySkippedByMaxCountCount: memoryContextTrace.skippedByMaxCountCount,
          memoryInjectionItems: memoryContextTrace.items,
          timingMs: timingPayload(timing, startedAtMs),
        },
        now,
      });

      if (!policyDecision.allowed) {
        throw new Error(policyDecision.reasonEnglish);
      }

      const rinMessage = appendConversationMessage(database, {
        conversationId: persistedTurn.conversation.id,
        role: "rin",
        content: modelResponse.content,
        modelAdapter: modelResponse.adapterId,
        now,
      });
      if (memoryContextTrace.items.length > 0) {
        appendMessageMemoryContext(database, {
          messageId: rinMessage.id,
          memoryContext: memoryContextTrace,
          now,
        });
      }
      await updateStateAfterConversation(database, layout, now);
      await snapshotSlowVariables(
        database,
        layout,
        "conversation.turn_completed",
        now,
      );

      timing.completionPersistenceMs = elapsedMs(completionPersistenceStartedAtMs);
      const completedTurn = markConversationTurnCompleted(database, {
        turnId: persistedTurn.turn.id,
        rinMessageId: rinMessage.id,
        now,
      });

      appendAuditEvent(database, {
        eventType: "conversation.turn_completed",
        payload: {
          turnId: completedTurn.id,
          conversationId: persistedTurn.conversation.id,
          ownerMessageId: persistedTurn.ownerMessage.id,
          rinMessageId: rinMessage.id,
          attemptCount: completedTurn.attemptCount,
          modelAdapter: modelResponse.adapterId,
          memoryProposalId: persistedTurn.memoryProposalId,
          contextBudgetApplied: modelContext.stats.contextBudgetApplied,
          modelContextMessageCount: modelContext.stats.messageCount,
          modelContextCharacterCount: modelContext.stats.characterCount,
          modelContextDroppedMessageCount:
            modelContext.stats.droppedMessageCount,
          injectedMemoryCount: modelContext.stats.injectedMemoryCount,
          injectedMemoryIds: modelContext.stats.injectedMemoryIds,
          deterministicInjectedMemoryIds:
            modelContext.stats.deterministicInjectedMemoryIds,
          semanticInjectedMemoryIds: modelContext.stats.semanticInjectedMemoryIds,
          semanticCandidateIds: modelContext.stats.semanticCandidateIds,
          semanticContextExpansionEnabled:
            modelContext.stats.semanticContextExpansionEnabled,
          memoryContextCharacterCount:
            modelContext.stats.memoryContextCharacterCount,
          memoryRetrievalSource:
            memoryRetrieval.retrievalSource ?? "legacy-memory-items",
          legacyAcceptedMemoryCount:
            memoryRetrieval.legacyAcceptedMemoryCount ?? null,
          migratedLegacyMemoryCount:
            memoryRetrieval.migratedLegacyMemoryCount ?? null,
          pendingLegacyMemoryCount:
            memoryRetrieval.pendingLegacyMemoryCount ?? null,
          profileContextIncluded: modelContext.stats.profileContextIncluded,
          profileContextCharacterCount:
            modelContext.stats.profileContextCharacterCount,
          memorySkippedByBudgetCount: memoryContextTrace.skippedByBudgetCount,
          memorySkippedByRelevanceCount: memoryContextTrace.skippedByRelevanceCount,
          memorySkippedByMaxCountCount: memoryContextTrace.skippedByMaxCountCount,
          memoryInjectionItems: memoryContextTrace.items,
          timingMs: timingPayload(timing, startedAtMs),
        },
        now,
      });

      database.exec("COMMIT;");

      return {
        turn: completedTurn,
        conversation: {
          ...persistedTurn.conversation,
          updatedAt: rinMessage.createdAt,
        },
        ownerMessage: persistedTurn.ownerMessage,
        rinMessage: {
          ...rinMessage,
          memoryContext:
            memoryContextTrace.items.length > 0 ? memoryContextTrace : null,
        },
        memoryContext:
          memoryContextTrace.items.length > 0 ? memoryContextTrace : null,
      };
    } catch (error) {
      safeRollback(database);
      timing.completionPersistenceMs = elapsedMs(completionPersistenceStartedAtMs);
      const conversationError = toConversationError(error);
      const failedTurn = persistTurnFailure(
        database,
        persistedTurn.turn,
        conversationError,
        now,
        timing,
        startedAtMs,
      );
      throw withConversationTurnDetails(conversationError, failedTurn);
    }
  } finally {
    database.close();
  }
}

type PersistedTurnStart = {
  turn: ConversationTurnRecord;
  conversation: ConversationRecord;
  ownerMessage: ConversationMessageRecord;
  memoryProposalId: string | null;
};

type TurnTiming = {
  preModelPersistenceMs?: number;
  modelCallMs?: number;
  completionPersistenceMs?: number;
  failurePersistenceMs?: number;
};

function persistTurnStart(
  database: RinDatabase,
  input: ProcessOwnerMessageInput & { content: string; turnId: string },
  now: Date,
): PersistedTurnStart {
  database.exec("BEGIN;");

  try {
    const existingTurn = findConversationTurn(database, input.turnId);

    if (existingTurn) {
      const ownerMessage = getConversationMessage(
        database,
        existingTurn.ownerMessageId,
      );

      if (ownerMessage.content !== input.content) {
        throw new Error("Conversation turn retry content mismatch.");
      }

      const turn =
        existingTurn.status === "completed"
          ? existingTurn
          : markConversationTurnStarted(database, {
              turnId: existingTurn.id,
              now,
            });
      const conversation = getConversation(database, turn.conversationId);

      if (turn.status !== "completed") {
        appendRawEvent(database, {
          eventType: "conversation.turn_retry_started",
          source: "conversation",
          payload: {
            turnId: turn.id,
            conversationId: turn.conversationId,
            ownerMessageId: turn.ownerMessageId,
            attemptCount: turn.attemptCount,
          },
          now,
        });
      }

      database.exec("COMMIT;");
      return {
        turn,
        conversation,
        ownerMessage,
        memoryProposalId: null,
      };
    }

    const conversation = input.conversationId
      ? getConversation(database, input.conversationId)
      : createConversation(database, titleFromContent(input.content), now);

    const ownerMessage = appendConversationMessage(database, {
      conversationId: conversation.id,
      role: "owner",
      content: input.content,
      now,
    });
    appendRawEvent(database, {
      eventType: "conversation.owner_message_received",
      source: "owner",
      payload: {
        turnId: input.turnId,
        conversationId: conversation.id,
        messageId: ownerMessage.id,
        content: input.content,
      },
      now,
    });
    const memoryProposal = maybeCreateOwnerMemoryProposal(
      database,
      ownerMessage,
      now,
    );
    const turn = createConversationTurn(database, {
      id: input.turnId,
      conversationId: conversation.id,
      ownerMessageId: ownerMessage.id,
      now,
    });
    appendRawEvent(database, {
      eventType: "conversation.turn_started",
      source: "conversation",
      payload: {
        turnId: turn.id,
        conversationId: conversation.id,
        ownerMessageId: ownerMessage.id,
        attemptCount: turn.attemptCount,
      },
      now,
    });

    database.exec("COMMIT;");
    return {
      turn,
      conversation,
      ownerMessage,
      memoryProposalId: memoryProposal?.id ?? null,
    };
  } catch (error) {
    safeRollback(database);
    throw error;
  }
}

function loadCompletedTurnResult(
  database: RinDatabase,
  turn: ConversationTurnRecord,
): ConversationTurnResult {
  if (!turn.rinMessageId) {
    throw new Error(`Completed conversation turn has no RIN message: ${turn.id}`);
  }

  const conversation = getConversation(database, turn.conversationId);
  const ownerMessage = getConversationMessage(database, turn.ownerMessageId);
  const rinMessage = getConversationMessage(database, turn.rinMessageId);

  return {
    turn,
    conversation,
    ownerMessage,
    rinMessage,
    memoryContext: rinMessage.memoryContext,
  };
}

/**
 * Record a failed turn after the model call or completion transaction has ended
 * so the failure is auditable while preserving the owner message and never
 * storing a fake RIN reply. Only safe metadata is logged.
 */
function persistTurnFailure(
  database: RinDatabase,
  turn: ConversationTurnRecord,
  conversationError: ConversationError,
  now: Date,
  timing: TurnTiming,
  startedAtMs: number,
): ConversationTurnRecord {
  const failurePersistenceStartedAtMs = performance.now();
  const payload = {
    turnId: turn.id,
    conversationId: turn.conversationId,
    ownerMessageId: turn.ownerMessageId,
    errorCode: conversationError.payload.code,
    provider: conversationError.payload.provider,
    modelAdapter: conversationError.payload.modelAdapter,
    retryable: conversationError.payload.retryable,
    timingMs: timingPayload(
      {
        ...timing,
        failurePersistenceMs: elapsedMs(failurePersistenceStartedAtMs),
      },
      startedAtMs,
    ),
  };

  try {
    database.exec("BEGIN;");
    const failedTurn = markConversationTurnFailed(database, {
      turnId: turn.id,
      errorCode: conversationError.payload.code,
      now,
    });
    const failedPayload = {
      ...payload,
      attemptCount: failedTurn.attemptCount,
      timingMs: timingPayload(
        {
          ...timing,
          failurePersistenceMs: elapsedMs(failurePersistenceStartedAtMs),
        },
        startedAtMs,
      ),
    };

    appendRawEvent(database, {
      eventType: "conversation.turn_failed",
      source: conversationError.payload.modelAdapter ?? "conversation",
      payload: failedPayload,
      now,
    });
    appendAuditEvent(database, {
      eventType: "conversation.turn_failed",
      payload: failedPayload,
      now,
    });
    database.exec("COMMIT;");
    return failedTurn;
  } catch {
    safeRollback(database);
    // Logging the failure must never mask the original conversation error.
    return {
      ...turn,
      status: "failed",
      errorCode: conversationError.payload.code,
      failedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }
}

function normalizeTurnId(turnId: string | undefined): string | null {
  const normalized = turnId?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function elapsedMs(startedAtMs: number): number {
  return Math.max(0, Math.round((performance.now() - startedAtMs) * 100) / 100);
}

function timingPayload(
  timing: TurnTiming,
  startedAtMs: number,
): Record<string, number> {
  return {
    totalMs: elapsedMs(startedAtMs),
    preModelPersistenceMs: timing.preModelPersistenceMs ?? 0,
    modelCallMs: timing.modelCallMs ?? 0,
    completionPersistenceMs: timing.completionPersistenceMs ?? 0,
    failurePersistenceMs: timing.failurePersistenceMs ?? 0,
  };
}

function safeRollback(database: RinDatabase): void {
  try {
    database.exec("ROLLBACK;");
  } catch {
    // Ignore rollback failures; the original error is more relevant.
  }
}

/**
 * Retrieve a small, relevant subset of explicitly accepted memories for the
 * current owner message. Only accepted memories are queried; pending, rejected,
 * and archived memories are never injected. Selection is deterministic and
 * bounded by the context builder's injection limits.
 */
function defaultRetrieveAcceptedMemories(
  database: RinDatabase,
  ownerMessage: string,
): AcceptedMemoryRetrievalResult {
  const productionCandidates = getMemoryV2ProductionCandidateMemories(database, {
    limit: 50,
  });
  const acceptedMemories = productionCandidates.memories;

  const deterministic = retrieveAcceptedMemoriesWithExplanation(
    acceptedMemories,
    ownerMessage,
  );
  const semanticExpansion = selectSemanticContextExpansionCandidates({
    memories: acceptedMemories,
    ownerMessage,
    deterministicMemoryIds: deterministic.snippets.map((snippet) => snippet.id),
    config: readSemanticContextConfig(),
  });
  const semanticCandidateIds = new Set(
    semanticExpansion.snippets.map((snippet) => snippet.id),
  );

  return {
    snippets: [...deterministic.snippets, ...semanticExpansion.snippets],
    retrievalSource: productionCandidates.retrievalSource,
    legacyAcceptedMemoryCount: productionCandidates.legacyAcceptedMemoryCount,
    migratedLegacyMemoryCount: productionCandidates.migratedLegacyMemoryCount,
    pendingLegacyMemoryCount: productionCandidates.pendingLegacyMemoryCount,
    explanations: [
      ...deterministic.explanations.filter(
        (item) => !semanticCandidateIds.has(item.memoryId),
      ),
      ...semanticExpansion.explanations,
    ],
  };
}

function titleFromContent(content: string): string {
  return content.length > 48 ? `${content.slice(0, 45)}...` : content;
}
