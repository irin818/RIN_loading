/**
 * Lightweight deterministic tokenization for accepted-memory retrieval.
 * No external NLP dependencies.
 */

export type RetrievalTokenProfile = {
  /** Normalized Latin tokens after stopword filtering. */
  latinTokens: Set<string>;
  /** CJK bigrams (and single-character CJK when needed). */
  cjkBigrams: Set<string>;
  /** Count of query tokens used for scoring (latin + cjk, post stopword). */
  normalizedTokenCount: number;
};

export type RetrievalMatchResult = {
  matchedKeywords: string[];
  latinTokenMatchCount: number;
  cjkBigramMatchCount: number;
  overlapCount: number;
  score: number;
};

const EN_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "to",
  "of",
  "and",
  "or",
  "in",
  "on",
  "for",
  "with",
  "this",
  "that",
]);

const ZH_STOPWORDS = new Set([
  "的",
  "了",
  "是",
  "我",
  "你",
  "他",
  "她",
  "它",
  "和",
  "与",
  "在",
  "对",
]);

/** Technical tokens that must never be treated as stopwords. */
const PROTECTED_TOKENS = new Set([
  "api",
  "model",
  "local",
  "memory",
  "ollama",
  "qwen3",
  "rin",
  "agent",
  "system",
  "semantic",
  "sqlite",
  "ollama",
]);

const EXPLICIT_PLURALS: Record<string, string> = {
  models: "model",
  memories: "memory",
  systems: "system",
  agents: "agent",
  apis: "api",
};

const CJK_RUN_REGEX = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu;
const LATIN_TOKEN_REGEX = /[a-z0-9]+/gi;

export function buildRetrievalTokenProfile(
  text: string,
  extra?: string,
): RetrievalTokenProfile {
  const source = extra ? `${text} ${extra}` : text;
  const prepared = preprocessText(source);
  const latinTokens = extractLatinTokens(prepared);
  const cjkBigrams = extractCjkBigrams(prepared);

  return {
    latinTokens,
    cjkBigrams,
    normalizedTokenCount: latinTokens.size + cjkBigrams.size,
  };
}

export function scoreRetrievalOverlap(
  owner: RetrievalTokenProfile,
  memory: RetrievalTokenProfile,
): RetrievalMatchResult {
  const matchedLatin: string[] = [];
  const matchedCjk: string[] = [];

  for (const token of memory.latinTokens) {
    if (owner.latinTokens.has(token)) {
      matchedLatin.push(token);
    }
  }

  for (const bigram of memory.cjkBigrams) {
    if (owner.cjkBigrams.has(bigram)) {
      matchedCjk.push(bigram);
    }
  }

  matchedLatin.sort();
  matchedCjk.sort();

  const latinTokenMatchCount = matchedLatin.length;
  const cjkBigramMatchCount = matchedCjk.length;
  const overlapCount = latinTokenMatchCount + cjkBigramMatchCount;
  const score = latinTokenMatchCount * 2 + cjkBigramMatchCount;

  return {
    matchedKeywords: [...matchedLatin, ...matchedCjk],
    latinTokenMatchCount,
    cjkBigramMatchCount,
    overlapCount,
    score,
  };
}

export function preprocessText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[/\\|]+/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeLatinToken(raw: string): string {
  const lower = raw.toLowerCase().trim();

  if (lower.length === 0) {
    return lower;
  }

  if (EXPLICIT_PLURALS[lower]) {
    return EXPLICIT_PLURALS[lower];
  }

  if (lower.endsWith("ies") && lower.length > 4) {
    const singular = `${lower.slice(0, -3)}y`;
    if (singular.length >= 3) {
      return singular;
    }
  }

  if (
    lower.endsWith("s") &&
    lower.length >= 5 &&
    !lower.endsWith("ss") &&
    !lower.endsWith("us") &&
    !lower.endsWith("is")
  ) {
    const singular = lower.slice(0, -1);
    if (singular.length >= 3) {
      return singular;
    }
  }

  return lower;
}

export function isStopword(token: string): boolean {
  if (PROTECTED_TOKENS.has(token)) {
    return false;
  }

  if (EN_STOPWORDS.has(token)) {
    return true;
  }

  if (token.length === 1 && ZH_STOPWORDS.has(token)) {
    return true;
  }

  if (ZH_STOPWORDS.has(token)) {
    return true;
  }

  return false;
}

function extractLatinTokens(prepared: string): Set<string> {
  const tokens = new Set<string>();
  const matches = prepared.match(LATIN_TOKEN_REGEX);

  if (!matches) {
    return tokens;
  }

  for (const raw of matches) {
    const normalized = normalizeLatinToken(raw);

    if (normalized.length === 0 || isStopword(normalized)) {
      continue;
    }

    tokens.add(normalized);
  }

  return tokens;
}

function extractCjkBigrams(prepared: string): Set<string> {
  const bigrams = new Set<string>();
  const runs = prepared.match(CJK_RUN_REGEX);

  if (!runs) {
    return bigrams;
  }

  for (const run of runs) {
    if (run.length === 1) {
      if (!ZH_STOPWORDS.has(run)) {
        bigrams.add(run);
      }
      continue;
    }

    for (let index = 0; index < run.length - 1; index += 1) {
      const bigram = run.slice(index, index + 2);
      if (!isCjkBigramStopword(bigram)) {
        bigrams.add(bigram);
      }
    }
  }

  return bigrams;
}

function isCjkBigramStopword(bigram: string): boolean {
  return [...bigram].every((char) => ZH_STOPWORDS.has(char));
}
