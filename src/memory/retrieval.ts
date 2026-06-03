import type { MemoryMetadata, MemoryRecord, MemoryType } from "./manager";
import {
  buildRetrievalTokenProfile,
  scoreRetrievalOverlap,
} from "./retrievalTokens";

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
  memoryType: MemoryType;
  matchedKeywords: string[];
  overlapCount: number;
  latinTokenMatchCount: number;
  cjkBigramMatchCount: number;
  normalizedQueryTokenCount: number;
  typeMatchBonus: number;
  matchedTypeSignals: string[];
  matchedTags: string[];
  tagMatchBonus: number;
  importanceBonus: number;
  confidenceAdjustment: number;
  metadataBonus: number;
  metadataSignals: string[];
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
  memoryType: MemoryType;
  score: number;
  tokenScore: number;
  typeMatchBonus: number;
  matchedTypeSignals: string[];
  metadataMatch: MetadataScoreMatch;
  match: ReturnType<typeof scoreRetrievalOverlap>;
  updatedAt: string;
};

type TypeSignalMatch = {
  bonus: number;
  matchedSignals: string[];
};

type MetadataScoreMatch = {
  bonus: number;
  matchedTags: string[];
  tagMatchBonus: number;
  importanceBonus: number;
  confidenceAdjustment: number;
  metadataSignals: string[];
};

const TYPE_MATCH_BONUS = 1;
const TOKEN_SCORE_WEIGHT = 10;
const TAG_MATCH_BONUS = 1;
const MAX_TAG_MATCH_BONUS = 1;
const HIGH_IMPORTANCE_BONUS = 1;
const LOW_CONFIDENCE_ADJUSTMENT = -1;
const MAX_METADATA_BONUS = 2;

const MEMORY_TYPE_SIGNALS: Record<
  MemoryType,
  { latin: string[]; cjk: string[] }
> = {
  raw_log: { latin: ["raw", "log"], cjk: ["原始", "日志"] },
  episodic: { latin: ["episode", "episodic", "event"], cjk: ["事件", "经历"] },
  semantic: { latin: ["semantic", "fact", "knowledge"], cjk: ["事实", "知识"] },
  preference: {
    latin: ["preference", "prefer", "preferred", "like"],
    cjk: ["偏好", "喜欢"],
  },
  procedural: {
    latin: ["procedure", "procedural", "workflow", "process", "step"],
    cjk: ["流程", "步骤"],
  },
  goal: { latin: ["goal", "objective"], cjk: ["目标"] },
  project: {
    latin: ["project", "code", "github", "branch", "commit", "repo", "repository"],
    cjk: ["项目", "代码"],
  },
  reflection: { latin: ["reflection", "reflect", "review"], cjk: ["反思", "复盘"] },
  identity: { latin: ["identity", "profile", "persona", "owner"], cjk: ["身份"] },
};

/**
 * Select a small, deterministic subset of accepted memories that are relevant to
 * the current owner message. Uses normalized keyword overlap with optional CJK
 * bigram matching. Only memories with status "accepted" are ever considered.
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

  const ownerProfile = buildRetrievalTokenProfile(ownerMessage);

  if (ownerProfile.normalizedTokenCount === 0) {
    return { snippets: [], explanations };
  }

  const scored: ScoredMemory[] = [];

  for (const memory of memories) {
    if (memory.status !== "accepted") {
      continue;
    }

    const text = memorySnippetText(memory.content, maxSnippetCharacters);
    const memoryProfile = buildRetrievalTokenProfile(text);
    const match = scoreRetrievalOverlap(ownerProfile, memoryProfile);
    const typeMatch = scoreTypeSignalMatch(ownerProfile, memory.memoryType);

    if (text.length === 0) {
      explanations.push({
        memoryId: memory.id,
        memoryType: memory.memoryType,
        matchedKeywords: [],
        overlapCount: 0,
        latinTokenMatchCount: 0,
        cjkBigramMatchCount: 0,
        normalizedQueryTokenCount: ownerProfile.normalizedTokenCount,
        typeMatchBonus: 0,
        matchedTypeSignals: [],
        matchedTags: [],
        tagMatchBonus: 0,
        importanceBonus: 0,
        confidenceAdjustment: 0,
        metadataBonus: 0,
        metadataSignals: [],
        wasInjected: false,
        skippedReason: "empty_snippet",
        snippetLength: 0,
      });
      continue;
    }

    if (match.overlapCount === 0) {
      explanations.push({
        memoryId: memory.id,
        memoryType: memory.memoryType,
        matchedKeywords: [],
        overlapCount: 0,
        latinTokenMatchCount: 0,
        cjkBigramMatchCount: 0,
        normalizedQueryTokenCount: ownerProfile.normalizedTokenCount,
        typeMatchBonus: 0,
        matchedTypeSignals: [],
        matchedTags: [],
        tagMatchBonus: 0,
        importanceBonus: 0,
        confidenceAdjustment: 0,
        metadataBonus: 0,
        metadataSignals: [],
        wasInjected: false,
        skippedReason: "zero_relevance",
        snippetLength: text.length,
      });
      continue;
    }

    const metadataMatch = scoreMetadataSignalMatch(ownerProfile, memory.metadata);

    scored.push({
      snippet: { id: memory.id, text },
      memoryType: memory.memoryType,
      score:
        match.score * TOKEN_SCORE_WEIGHT +
        typeMatch.bonus +
        metadataMatch.bonus,
      tokenScore: match.score,
      typeMatchBonus: typeMatch.bonus,
      matchedTypeSignals: typeMatch.matchedSignals,
      metadataMatch,
      match,
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
      memoryType: item.memoryType,
      matchedKeywords: item.match.matchedKeywords,
      overlapCount: item.match.overlapCount,
      latinTokenMatchCount: item.match.latinTokenMatchCount,
      cjkBigramMatchCount: item.match.cjkBigramMatchCount,
      normalizedQueryTokenCount: ownerProfile.normalizedTokenCount,
      typeMatchBonus: item.typeMatchBonus,
      matchedTypeSignals: [...item.matchedTypeSignals],
      matchedTags: [...item.metadataMatch.matchedTags],
      tagMatchBonus: item.metadataMatch.tagMatchBonus,
      importanceBonus: item.metadataMatch.importanceBonus,
      confidenceAdjustment: item.metadataMatch.confidenceAdjustment,
      metadataBonus: item.metadataMatch.bonus,
      metadataSignals: [...item.metadataMatch.metadataSignals],
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
      memoryType: item.memoryType,
      matchedKeywords: [...item.matchedKeywords],
      overlapCount: item.overlapCount,
      latinTokenMatchCount: item.latinTokenMatchCount,
      cjkBigramMatchCount: item.cjkBigramMatchCount,
      normalizedQueryTokenCount: item.normalizedQueryTokenCount,
      typeMatchBonus: item.typeMatchBonus,
      matchedTypeSignals: [...item.matchedTypeSignals],
      matchedTags: [...item.matchedTags],
      tagMatchBonus: item.tagMatchBonus,
      importanceBonus: item.importanceBonus,
      confidenceAdjustment: item.confidenceAdjustment,
      metadataBonus: item.metadataBonus,
      metadataSignals: [...item.metadataSignals],
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

  if (right.tokenScore !== left.tokenScore) {
    return right.tokenScore - left.tokenScore;
  }

  if (right.match.overlapCount !== left.match.overlapCount) {
    return right.match.overlapCount - left.match.overlapCount;
  }

  if (right.typeMatchBonus !== left.typeMatchBonus) {
    return right.typeMatchBonus - left.typeMatchBonus;
  }

  if (right.metadataMatch.bonus !== left.metadataMatch.bonus) {
    return right.metadataMatch.bonus - left.metadataMatch.bonus;
  }

  if (right.updatedAt !== left.updatedAt) {
    return right.updatedAt < left.updatedAt ? -1 : 1;
  }

  return left.snippet.id < right.snippet.id ? -1 : 1;
}

function scoreTypeSignalMatch(
  ownerProfile: ReturnType<typeof buildRetrievalTokenProfile>,
  memoryType: MemoryType,
): TypeSignalMatch {
  const signals = MEMORY_TYPE_SIGNALS[memoryType];
  const matchedSignals = [
    ...signals.latin.filter((token) => ownerProfile.latinTokens.has(token)),
    ...signals.cjk.filter((bigram) => ownerProfile.cjkBigrams.has(bigram)),
  ].sort();

  return {
    bonus: matchedSignals.length > 0 ? TYPE_MATCH_BONUS : 0,
    matchedSignals,
  };
}

function scoreMetadataSignalMatch(
  ownerProfile: ReturnType<typeof buildRetrievalTokenProfile>,
  metadata: MemoryMetadata | null | undefined,
): MetadataScoreMatch {
  if (!metadata) {
    return neutralMetadataScoreMatch();
  }

  const matchedTags = matchMetadataTags(ownerProfile, metadata.tags);
  const tagMatchBonus = Math.min(
    matchedTags.length * TAG_MATCH_BONUS,
    MAX_TAG_MATCH_BONUS,
  );
  const importanceBonus =
    metadata.importance === "high" ? HIGH_IMPORTANCE_BONUS : 0;
  const confidenceAdjustment =
    metadata.confidence === "low" && tagMatchBonus + importanceBonus > 0
      ? LOW_CONFIDENCE_ADJUSTMENT
      : 0;
  const uncappedBonus = Math.max(
    0,
    tagMatchBonus + importanceBonus + confidenceAdjustment,
  );
  const bonus = Math.min(uncappedBonus, MAX_METADATA_BONUS);
  const metadataSignals = [
    ...(matchedTags.length > 0 ? ["tag_match"] : []),
    ...(importanceBonus > 0 ? ["importance_high"] : []),
    ...(confidenceAdjustment < 0 ? ["confidence_low_dampened"] : []),
  ];

  return {
    bonus,
    matchedTags,
    tagMatchBonus,
    importanceBonus,
    confidenceAdjustment,
    metadataSignals,
  };
}

function matchMetadataTags(
  ownerProfile: ReturnType<typeof buildRetrievalTokenProfile>,
  tags: readonly string[],
): string[] {
  const matched = new Set<string>();

  for (const tag of tags) {
    const profile = buildRetrievalTokenProfile(tag);
    let hasMatch = false;

    for (const token of profile.latinTokens) {
      if (ownerProfile.latinTokens.has(token)) {
        hasMatch = true;
        break;
      }
    }

    if (!hasMatch) {
      for (const bigram of profile.cjkBigrams) {
        if (ownerProfile.cjkBigrams.has(bigram)) {
          hasMatch = true;
          break;
        }
      }
    }

    if (hasMatch) {
      matched.add(tag);
    }
  }

  return [...matched].sort();
}

function neutralMetadataScoreMatch(): MetadataScoreMatch {
  return {
    bonus: 0,
    matchedTags: [],
    tagMatchBonus: 0,
    importanceBonus: 0,
    confidenceAdjustment: 0,
    metadataSignals: [],
  };
}
