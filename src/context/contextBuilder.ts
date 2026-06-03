import type { ModelMessage } from "../model";
import {
  DEFAULT_CONTEXT_BUDGET,
  type ContextBudgetPolicy,
} from "./contextBudget";
import { buildRinSystemPrompt } from "./rinSystemPrompt";

export type ModelContextStats = {
  contextBudgetApplied: true;
  messageCount: number;
  characterCount: number;
  droppedMessageCount: number;
};

export type BuiltModelContext = {
  messages: ModelMessage[];
  stats: ModelContextStats;
};

type IndexedMessage = {
  index: number;
  message: ModelMessage;
};

export function buildModelContext(
  conversationMessages: readonly ModelMessage[],
  budget: ContextBudgetPolicy = DEFAULT_CONTEXT_BUDGET,
): BuiltModelContext {
  const systemMessage = buildRinSystemPrompt();
  const normalizedMessages = conversationMessages
    .filter((message) => message.role !== "system")
    .map((message, index) => ({ index, message }));
  const latestOwnerIndex = findLatestOwnerIndex(normalizedMessages);
  const retained = trimByMessageBudget(
    normalizedMessages,
    latestOwnerIndex,
    budget,
  );
  const characterBounded = trimByCharacterBudget(
    retained,
    latestOwnerIndex,
    systemMessage,
    budget,
  );
  const messages = [
    systemMessage,
    ...characterBounded.map((item) => item.message),
  ];

  return {
    messages,
    stats: {
      contextBudgetApplied: true,
      messageCount: messages.length,
      characterCount: countCharacters(messages),
      droppedMessageCount: conversationMessages.length - characterBounded.length,
    },
  };
}

export function countModelContextCharacters(
  messages: readonly ModelMessage[],
): number {
  return countCharacters(messages);
}

function trimByMessageBudget(
  messages: readonly IndexedMessage[],
  latestOwnerIndex: number | null,
  budget: ContextBudgetPolicy,
): IndexedMessage[] {
  const retained: IndexedMessage[] = [];
  const maxRecentMessages = Math.max(0, budget.maxRecentMessages);

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    const isLatestOwner =
      budget.preserveLatestOwnerMessage && item.index === latestOwnerIndex;

    if (retained.length < maxRecentMessages || isLatestOwner) {
      retained.push(item);
    }
  }

  return retained.sort((left, right) => left.index - right.index);
}

function trimByCharacterBudget(
  messages: readonly IndexedMessage[],
  latestOwnerIndex: number | null,
  systemMessage: ModelMessage,
  budget: ContextBudgetPolicy,
): IndexedMessage[] {
  const retained = [...messages];
  const maxInputCharacters = Math.max(0, budget.maxInputCharacters);

  while (
    countCharacters([systemMessage, ...retained.map((item) => item.message)]) >
    maxInputCharacters
  ) {
    const removableIndex = retained.findIndex(
      (item) =>
        !budget.preserveLatestOwnerMessage || item.index !== latestOwnerIndex,
    );

    if (removableIndex === -1) {
      break;
    }

    retained.splice(removableIndex, 1);
  }

  return retained;
}

function findLatestOwnerIndex(
  messages: readonly IndexedMessage[],
): number | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];

    if (item.message.role === "owner") {
      return item.index;
    }
  }

  return null;
}

function countCharacters(messages: readonly ModelMessage[]): number {
  return messages.reduce((total, message) => total + message.content.length, 0);
}
