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

export type MemoryRetrievalOptions = {
  /** Maximum number of memories selected for injection. */
  maxInjectedMemories?: number;
  /** Maximum characters kept for any single memory snippet. */
  maxSnippetCharacters?: number;
};

export const DEFAULT_MAX_INJECTED_MEMORIES = 5;
export const DEFAULT_MAX_SNIPPET_CHARACTERS = 240;

type ScoredMemory = {
  snippet: AcceptedMemorySnippet;
  score: number;
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
  const maxInjected = Math.max(
    0,
    options.maxInjectedMemories ?? DEFAULT_MAX_INJECTED_MEMORIES,
  );
  const maxSnippetCharacters = Math.max(
    1,
    options.maxSnippetCharacters ?? DEFAULT_MAX_SNIPPET_CHARACTERS,
  );

  if (maxInjected === 0) {
    return [];
  }

  const ownerTokens = tokenize(ownerMessage);

  if (ownerTokens.size === 0) {
    return [];
  }

  const scored: ScoredMemory[] = [];

  for (const memory of memories) {
    if (memory.status !== "accepted") {
      continue;
    }

    const text = memorySnippetText(memory.content, maxSnippetCharacters);

    if (text.length === 0) {
      continue;
    }

    const score = overlapScore(ownerTokens, tokenize(text, memory.memoryType));

    if (score <= 0) {
      continue;
    }

    scored.push({
      snippet: { id: memory.id, text },
      score,
      updatedAt: memory.updatedAt,
    });
  }

  scored.sort(compareScoredMemories);

  return scored.slice(0, maxInjected).map((item) => item.snippet);
}

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

function overlapScore(
  ownerTokens: ReadonlySet<string>,
  memoryTokens: ReadonlySet<string>,
): number {
  let score = 0;

  for (const token of memoryTokens) {
    if (ownerTokens.has(token)) {
      score += 1;
    }
  }

  return score;
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
