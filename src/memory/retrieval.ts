import type { MemoryRecord } from "./manager";

/**
 * A compact, model-facing view of an accepted memory. Only the stable id and a
 * short text snippet are exposed; raw memory metadata is intentionally kept out
 * of model context.
 */
export type AcceptedMemorySnippet = {
  id: string;
  text: string;
};

export type MemorySkipReason =
  | "zero_relevance"
  | "empty_snippet"
  | "max_count_exceeded"
  | "memory_budget_exceeded";

export type MemoryInjectionExplanation = {
  memoryId: string;
  matchedKeywords: string[];
  overlapCount: number;
  wasInjected: boolean;
  skippedReason: MemorySkipReason | null;
  snippetLength: number;
};

export type MemoryRetrievalOptions = {
  /** Maximum number of memories selected for injection. */
  maxInjectedMemories?: number;
  /** Maximum characters kept for any single memory snippet. */
  maxSnippetCharacters?: number;
};

export type AcceptedMemoryRetrievalResult = {
  snippets: AcceptedMemorySnippet[];
  explanations: MemoryInjectionExplanation[];
};

export const DEFAULT_MAX_INJECTED_MEMORIES = 5;
export const DEFAULT_MAX_SNIPPET_CHARACTERS = 240;

type ScoredMemory = {
  snippet: AcceptedMemorySnippet;
  score: number;
  matchedKeywords: string[];
  updatedAt: string;
};

/**
 * Select a small, deterministic subset of accepted memories that are relevant to
 * the current owner message. The first version uses keyword overlap with recency
 * as a tiebreaker. Only memories with status "accepted" are ever considered, and
 * memories with no keyword overlap are not injected.
 */
export function selectRelevantAcceptedMemories(
  memories: readonly MemoryRecord[],
  ownerMessage: string,
  options: MemoryRetrievalOptions = {},
): AcceptedMemorySnippet[] {
  return retrieveAcceptedMemoriesWithExplanation(memories, ownerMessage, options)
    .snippets;
}

/**
 * Retrieve accepted memories for context injection together with safe
 * explanation metadata. Non-accepted memories are omitted from explanations.
 */
export function retrieveAcceptedMemoriesWithExplanation(
  memories: readonly MemoryRecord[],
  ownerMessage: string,
  options: MemoryRetrievalOptions = {},
): AcceptedMemoryRetrievalResult {
  const maxInjected = Math.max(
    0,
    options.maxInjectedMemories ?? DEFAULT_MAX_INJECTED_MEMORIES,
  );
  const maxSnippetCharacters = Math.max(
    1,
    options.maxSnippetCharacters ?? DEFAULT_MAX_SNIPPET_CHARACTERS,
  );
  const explanations: MemoryInjectionExplanation[] = [];

  if (maxInjected === 0) {
    return { snippets: [], explanations };
  }

  const ownerTokens = tokenize(ownerMessage);

  if (ownerTokens.size === 0) {
    return { snippets: [], explanations };
  }

  const scored: ScoredMemory[] = [];

  for (const memory of memories) {
    if (memory.status !== "accepted") {
      continue;
    }

    const text = memorySnippetText(memory.content, maxSnippetCharacters);
    const memoryTokens = tokenize(text, memory.memoryType);
    const matchedKeywords = findMatchedKeywords(ownerTokens, memoryTokens);
    const overlapCount = matchedKeywords.length;

    if (text.length === 0) {
      explanations.push({
        memoryId: memory.id,
        matchedKeywords: [],
        overlapCount: 0,
        wasInjected: false,
        skippedReason: "empty_snippet",
        snippetLength: 0,
      });
      continue;
    }

    if (overlapCount === 0) {
      explanations.push({
        memoryId: memory.id,
        matchedKeywords: [],
        overlapCount: 0,
        wasInjected: false,
        skippedReason: "zero_relevance",
        snippetLength: text.length,
      });
      continue;
    }

    scored.push({
      snippet: { id: memory.id, text },
      score: overlapCount,
      matchedKeywords,
      updatedAt: memory.updatedAt,
    });
  }

  scored.sort(compareScoredMemories);

  const selected = scored.slice(0, maxInjected);
  const selectedIds = new Set(selected.map((item) => item.snippet.id));

  for (const item of scored) {
    const isSelected = selectedIds.has(item.snippet.id);
    explanations.push({
      memoryId: item.snippet.id,
      matchedKeywords: item.matchedKeywords,
      overlapCount: item.matchedKeywords.length,
      wasInjected: false,
      skippedReason: isSelected ? null : "max_count_exceeded",
      snippetLength: item.snippet.text.length,
    });
  }

  return {
    snippets: selected.map((item) => item.snippet),
    explanations,
  };
}

/**
 * Update explanation rows after context budget assembly. Candidates with overlap
 * but not in the final injected set are marked memory_budget_exceeded.
 */
export function finalizeInjectionExplanations(
  explanations: readonly MemoryInjectionExplanation[],
  injectedMemoryIds: readonly string[],
): MemoryInjectionExplanation[] {
  const injected = new Set(injectedMemoryIds);

  return explanations.map((item) => {
    if (
      item.skippedReason === "zero_relevance" ||
      item.skippedReason === "empty_snippet" ||
      item.skippedReason === "max_count_exceeded"
    ) {
      return { ...item, wasInjected: false };
    }

    if (injected.has(item.memoryId)) {
      return {
        ...item,
        wasInjected: true,
        skippedReason: null,
      };
    }

    return {
      ...item,
      wasInjected: false,
      skippedReason: "memory_budget_exceeded",
    };
  });
}

export function summarizeMemoryInjection(
  explanations: readonly MemoryInjectionExplanation[],
): {
  skippedByBudgetCount: number;
  skippedByRelevanceCount: number;
  skippedByMaxCountCount: number;
} {
  let skippedByBudgetCount = 0;
  let skippedByRelevanceCount = 0;
  let skippedByMaxCountCount = 0;

  for (const item of explanations) {
    switch (item.skippedReason) {
      case "memory_budget_exceeded":
        skippedByBudgetCount += 1;
        break;
      case "zero_relevance":
      case "empty_snippet":
        skippedByRelevanceCount += 1;
        break;
      case "max_count_exceeded":
        skippedByMaxCountCount += 1;
        break;
      default:
        break;
    }
  }

  return {
    skippedByBudgetCount,
    skippedByRelevanceCount,
    skippedByMaxCountCount,
  };
}

/**
 * Safe trace payload for raw/audit logs and API responses. Omits memory text.
 */
export function toMemoryInjectionTrace(
  explanations: readonly MemoryInjectionExplanation[],
  injectedMemoryIds: readonly string[],
  memoryContextCharacterCount: number,
): MemoryInjectionTrace {
  const summary = summarizeMemoryInjection(explanations);

  return {
    injectedMemoryCount: injectedMemoryIds.length,
    injectedMemoryIds: [...injectedMemoryIds],
    memoryContextCharacterCount,
    skippedByBudgetCount: summary.skippedByBudgetCount,
    skippedByRelevanceCount: summary.skippedByRelevanceCount,
    skippedByMaxCountCount: summary.skippedByMaxCountCount,
    items: explanations.map((item) => ({
      memoryId: item.memoryId,
      matchedKeywords: [...item.matchedKeywords],
      overlapCount: item.overlapCount,
      wasInjected: item.wasInjected,
      skippedReason: item.skippedReason,
      snippetLength: item.snippetLength,
    })),
  };
}

export type MemoryInjectionTrace = {
  injectedMemoryCount: number;
  injectedMemoryIds: string[];
  memoryContextCharacterCount: number;
  skippedByBudgetCount: number;
  skippedByRelevanceCount: number;
  skippedByMaxCountCount: number;
  items: MemoryInjectionExplanation[];
};

/**
 * Extract a compact, single-line snippet from memory content, preferring the
 * human-readable `text` field, then bilingual fields. Raw metadata is not used.
 */
export function memorySnippetText(
  content: Record<string, unknown>,
  maxSnippetCharacters: number = DEFAULT_MAX_SNIPPET_CHARACTERS,
): string {
  const candidates = [content.text, content.english, content.chinese];
  let snippet = "";

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      snippet = candidate.trim();
      break;
    }
  }

  const collapsed = snippet.replace(/\s+/g, " ").trim();

  return collapsed.length > maxSnippetCharacters
    ? `${collapsed.slice(0, Math.max(0, maxSnippetCharacters - 1))}…`
    : collapsed;
}

function compareScoredMemories(left: ScoredMemory, right: ScoredMemory): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.updatedAt !== left.updatedAt) {
    return right.updatedAt < left.updatedAt ? -1 : 1;
  }

  return left.snippet.id < right.snippet.id ? -1 : 1;
}

function findMatchedKeywords(
  ownerTokens: ReadonlySet<string>,
  memoryTokens: ReadonlySet<string>,
): string[] {
  const matched: string[] = [];

  for (const token of memoryTokens) {
    if (ownerTokens.has(token)) {
      matched.push(token);
    }
  }

  return matched.sort();
}

function tokenize(value: string, extra?: string): Set<string> {
  const tokens = new Set<string>();
  const source = extra ? `${value} ${extra}` : value;
  const matches = source.toLowerCase().match(/[\p{L}\p{N}]+/gu);

  if (matches) {
    for (const match of matches) {
      tokens.add(match);
    }
  }

  return tokens;
}
