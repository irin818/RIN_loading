import type { SemanticContextConfig } from "../context";
import type { AcceptedMemorySnippet, MemoryInjectionExplanation } from "./retrieval";
import { memorySnippetText } from "./retrieval";
import { buildRetrievalTokenProfile } from "./retrievalTokens";
import type { MemoryRecord } from "./manager";
import { createFixtureSemanticEmbeddingProvider } from "./semanticEmbedding";
import { createInMemoryVectorIndex } from "./vectorIndex";

export type SemanticContextExpansionResult = {
  enabled: boolean;
  candidateIds: string[];
  snippets: AcceptedMemorySnippet[];
  explanations: MemoryInjectionExplanation[];
  skippedNonAcceptedIds: string[];
  providerId: string | null;
  providerMode: "disabled" | "fixture-mock";
  providerCallCount: 0;
  errorCode: string | null;
  maxCandidates: number;
  maxCharacters: number;
};

export function selectSemanticContextExpansionCandidates(input: {
  memories: readonly MemoryRecord[];
  ownerMessage: string;
  deterministicMemoryIds: readonly string[];
  config: SemanticContextConfig;
}): SemanticContextExpansionResult {
  if (!input.config.enabled) {
    return disabledSemanticContextExpansion(input.config);
  }

  const acceptedMemories = input.memories.filter(
    (memory) => memory.status === "accepted",
  );
  const deterministicIds = new Set(input.deterministicMemoryIds);
  const eligibleMemories = acceptedMemories.filter(
    (memory) => !deterministicIds.has(memory.id),
  );
  const skippedNonAcceptedIds = input.memories
    .filter((memory) => memory.status !== "accepted")
    .map((memory) => memory.id)
    .sort();
  const queryTerms = termsForText(input.ownerMessage);

  if (eligibleMemories.length === 0 || queryTerms.length === 0) {
    return {
      ...baseSemanticContextExpansion(input.config),
      enabled: true,
      skippedNonAcceptedIds,
    };
  }

  const provider = createFixtureSemanticEmbeddingProvider();
  const queryEmbedding = provider.embed({
    id: "semantic-context-query",
    terms: queryTerms,
  });
  const entries = eligibleMemories.map((memory) => ({
    id: memory.id,
    vector: provider.embed({
      id: memory.id,
      terms: termsForText(memorySnippetText(memory.content)),
    }).vector,
  }));
  const candidateIds = createInMemoryVectorIndex(entries)
    .query(queryEmbedding.vector, {
      topK: input.config.maxCandidates,
      candidateCap: input.config.maxCandidates,
    })
    .map((match) => match.id);
  const memoryById = new Map(eligibleMemories.map((memory) => [memory.id, memory]));
  const selected = fitSemanticSnippetsByCharacterBudget(
    candidateIds
      .map((candidateId) => memoryById.get(candidateId))
      .filter((memory): memory is MemoryRecord => memory !== undefined),
    input.config.maxCharacters,
  );

  return {
    ...baseSemanticContextExpansion(input.config),
    enabled: true,
    candidateIds,
    snippets: selected.map((memory) => ({
      id: memory.id,
      text: memorySnippetText(memory.content),
    })),
    explanations: selected.map((memory) =>
      semanticContextExplanation(memory, input.ownerMessage),
    ),
    skippedNonAcceptedIds,
    providerId: provider.providerId,
    providerMode: "fixture-mock",
  };
}

function disabledSemanticContextExpansion(
  config: SemanticContextConfig,
): SemanticContextExpansionResult {
  return {
    ...baseSemanticContextExpansion(config),
    errorCode:
      config.invalidReasons.length > 0
        ? "SEMANTIC_CONTEXT_INVALID_CONFIG"
        : "SEMANTIC_CONTEXT_DISABLED",
  };
}

function baseSemanticContextExpansion(
  config: SemanticContextConfig,
): SemanticContextExpansionResult {
  return {
    enabled: false,
    candidateIds: [],
    snippets: [],
    explanations: [],
    skippedNonAcceptedIds: [],
    providerId: null,
    providerMode: "disabled",
    providerCallCount: 0,
    errorCode: null,
    maxCandidates: config.maxCandidates,
    maxCharacters: config.maxCharacters,
  };
}

function semanticContextExplanation(
  memory: MemoryRecord,
  ownerMessage: string,
): MemoryInjectionExplanation {
  const ownerProfile = buildRetrievalTokenProfile(ownerMessage);
  const snippet = memorySnippetText(memory.content);

  return {
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
    contextSource: "semantic",
    wasInjected: false,
    skippedReason: null,
    snippetLength: snippet.length,
  };
}

function fitSemanticSnippetsByCharacterBudget(
  memories: readonly MemoryRecord[],
  maxCharacters: number,
): MemoryRecord[] {
  const selected: MemoryRecord[] = [];
  let usedCharacters = 0;

  for (const memory of memories) {
    const snippetLength = memorySnippetText(memory.content).length;

    if (usedCharacters + snippetLength > maxCharacters) {
      continue;
    }

    selected.push(memory);
    usedCharacters += snippetLength;
  }

  return selected;
}

function termsForText(text: string): string[] {
  const profile = buildRetrievalTokenProfile(text);
  return [...profile.latinTokens, ...profile.cjkBigrams].sort();
}
