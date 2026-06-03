import type { ModelMessage } from "../model";
import type { AcceptedMemorySnippet } from "../memory";
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
  injectedMemoryCount: number;
  injectedMemoryIds: string[];
  memoryContextCharacterCount: number;
};

export type BuiltModelContext = {
  messages: ModelMessage[];
  stats: ModelContextStats;
};

export type MemoryInjectionOptions = {
  memories?: readonly AcceptedMemorySnippet[];
  maxInjectedMemories?: number;
  maxMemoryContextCharacters?: number;
};

export const DEFAULT_MAX_INJECTED_MEMORIES = 5;
export const DEFAULT_MAX_MEMORY_CONTEXT_CHARACTERS = 2000;

const MEMORY_BLOCK_HEADER = "Relevant accepted owner memories:";
const MEMORY_BLOCK_INSTRUCTIONS = [
  "These are accepted local memories.",
  "Use them only when relevant.",
  "Do not claim access to memories not shown.",
  "If memory conflicts with the current user message, prefer the current user message and do not overwrite memory automatically.",
].join(" ");

type IndexedMessage = {
  index: number;
  message: ModelMessage;
};

export function buildModelContext(
  conversationMessages: readonly ModelMessage[],
  budget: ContextBudgetPolicy = DEFAULT_CONTEXT_BUDGET,
  memoryOptions: MemoryInjectionOptions = {},
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

  const maxInjectedMemories = Math.max(
    0,
    memoryOptions.maxInjectedMemories ?? DEFAULT_MAX_INJECTED_MEMORIES,
  );
  const maxMemoryContextCharacters = Math.max(
    0,
    memoryOptions.maxMemoryContextCharacters ??
      DEFAULT_MAX_MEMORY_CONTEXT_CHARACTERS,
  );

  let memorySnippets = fitMemorySnippetsByCharacterBudget(
    (memoryOptions.memories ?? []).slice(0, maxInjectedMemories),
    maxMemoryContextCharacters,
  );

  const bounded = trimByCharacterBudget(
    retained,
    latestOwnerIndex,
    systemMessage,
    memorySnippets,
    budget,
  );
  memorySnippets = bounded.memorySnippets;

  const memoryMessage = composeMemoryMessage(memorySnippets);
  const messages = [
    systemMessage,
    ...(memoryMessage ? [memoryMessage] : []),
    ...bounded.messages.map((item) => item.message),
  ];

  return {
    messages,
    stats: {
      contextBudgetApplied: true,
      messageCount: messages.length,
      characterCount: countCharacters(messages),
      droppedMessageCount:
        conversationMessages.length - bounded.messages.length,
      injectedMemoryCount: memorySnippets.length,
      injectedMemoryIds: memorySnippets.map((snippet) => snippet.id),
      memoryContextCharacterCount: memoryMessage
        ? memoryMessage.content.length
        : 0,
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

/**
 * Enforce the character budget with this priority order: the RIN system prompt
 * and the latest owner message are always preserved, recent conversation
 * messages are dropped first (oldest first), and injected accepted memories are
 * only dropped after no other conversation messages can be removed. Memories
 * never displace the latest owner message.
 */
function trimByCharacterBudget(
  messages: readonly IndexedMessage[],
  latestOwnerIndex: number | null,
  systemMessage: ModelMessage,
  memorySnippets: readonly AcceptedMemorySnippet[],
  budget: ContextBudgetPolicy,
): { messages: IndexedMessage[]; memorySnippets: AcceptedMemorySnippet[] } {
  const retained = [...messages];
  let snippets = [...memorySnippets];
  const maxInputCharacters = Math.max(0, budget.maxInputCharacters);

  const totalCharacters = (): number => {
    const memoryMessage = composeMemoryMessage(snippets);
    return countCharacters([
      systemMessage,
      ...(memoryMessage ? [memoryMessage] : []),
      ...retained.map((item) => item.message),
    ]);
  };

  while (totalCharacters() > maxInputCharacters) {
    const removableIndex = retained.findIndex(
      (item) =>
        !budget.preserveLatestOwnerMessage || item.index !== latestOwnerIndex,
    );

    if (removableIndex === -1) {
      break;
    }

    retained.splice(removableIndex, 1);
  }

  while (snippets.length > 0 && totalCharacters() > maxInputCharacters) {
    snippets = snippets.slice(0, -1);
  }

  return { messages: retained, memorySnippets: snippets };
}

function fitMemorySnippetsByCharacterBudget(
  snippets: readonly AcceptedMemorySnippet[],
  maxMemoryContextCharacters: number,
): AcceptedMemorySnippet[] {
  let fitted = [...snippets];

  while (fitted.length > 0) {
    const message = composeMemoryMessage(fitted);

    if (!message || message.content.length <= maxMemoryContextCharacters) {
      break;
    }

    fitted = fitted.slice(0, -1);
  }

  return fitted;
}

function composeMemoryMessage(
  snippets: readonly AcceptedMemorySnippet[],
): ModelMessage | null {
  if (snippets.length === 0) {
    return null;
  }

  const bullets = snippets
    .map((snippet) => `- [memory:${snippet.id}] ${snippet.text}`)
    .join("\n");

  return {
    role: "system",
    content: `${MEMORY_BLOCK_HEADER}\n${bullets}\n\n${MEMORY_BLOCK_INSTRUCTIONS}`,
  };
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
