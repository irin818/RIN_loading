import type { MemoryMetadataInput, MemoryStatus, MemoryType } from "./manager";
import type { MemorySkipReason } from "./retrieval";

export type MemoryEvaluationCategory =
  | "lexical"
  | "cjk"
  | "type-aware"
  | "metadata-aware"
  | "privacy"
  | "budget"
  | "non-accepted"
  | "trace"
  | "token-dominance"
  | "zero-overlap";

export type MemoryEvaluationMemoryInput = {
  id: string;
  text: string;
  memoryType?: MemoryType;
  metadata?: MemoryMetadataInput;
  status?: MemoryStatus;
  updatedAt?: string;
};

export type MemoryEvaluationCase = {
  caseId: string;
  categories?: MemoryEvaluationCategory[];
  query: string;
  acceptedMemories: MemoryEvaluationMemoryInput[];
  nonAcceptedMemories?: MemoryEvaluationMemoryInput[];
  expectedInjectedIds: string[];
  expectedNotInjectedIds?: string[];
  expectedMatchedTokens?: Record<string, string[]>;
  expectedMatchedTypeSignals?: Record<string, string[]>;
  expectedTypeMatchBonuses?: Record<string, number>;
  expectedMatchedTags?: Record<string, string[]>;
  expectedTagMatchBonuses?: Record<string, number>;
  expectedImportanceBonuses?: Record<string, number>;
  expectedConfidenceAdjustments?: Record<string, number>;
  expectedMetadataBonuses?: Record<string, number>;
  expectedMetadataSignals?: Record<string, string[]>;
  expectedSkipReasons?: Record<string, MemorySkipReason>;
  expectedPrivacyForbiddenText?: string[];
  maxInjectedMemories?: number;
  maxMemoryContextCharacters?: number;
};

export const BUILT_IN_MEMORY_EVALUATION_CASES: MemoryEvaluationCase[] = [
  {
    caseId: "plural-model-models",
    categories: ["lexical", "privacy", "trace"],
    query: "Which local Ollama model should RIN use?",
    acceptedMemories: [
      {
        id: "mem-models",
        text: "Owner prefers local Ollama models.",
      },
    ],
    expectedInjectedIds: ["mem-models"],
    expectedMatchedTokens: {
      "mem-models": ["local", "model", "ollama"],
    },
    expectedPrivacyForbiddenText: ["Owner prefers local Ollama models"],
  },
  {
    caseId: "plural-api-memory-system",
    categories: ["lexical"],
    query: "Check api memory system behavior.",
    acceptedMemories: [
      {
        id: "mem-api-memory",
        text: "RIN APIs and memories belong to local systems.",
      },
    ],
    expectedInjectedIds: ["mem-api-memory"],
    expectedMatchedTokens: {
      "mem-api-memory": ["api", "memory", "system"],
    },
  },
  {
    caseId: "separator-ollama-qwen3-local-model-first",
    categories: ["lexical"],
    query: "qwen3 local model first runtime",
    acceptedMemories: [
      {
        id: "mem-separators",
        text: "Ollama/Qwen3 supports local-model-first experimentation.",
      },
    ],
    expectedInjectedIds: ["mem-separators"],
    expectedMatchedTokens: {
      "mem-separators": ["qwen3", "local", "model", "first"],
    },
  },
  {
    caseId: "cjk-local-model",
    categories: ["lexical", "cjk"],
    query: "请说明本地模型偏好",
    acceptedMemories: [
      {
        id: "mem-cjk-local-model",
        text: "所有者偏好本地模型和模型记忆。",
      },
    ],
    expectedInjectedIds: ["mem-cjk-local-model"],
    expectedMatchedTokens: {
      "mem-cjk-local-model": ["本地", "模型"],
    },
  },
  {
    caseId: "mixed-qwen3-local-model",
    categories: ["lexical", "cjk"],
    query: "qwen3 本地模型",
    acceptedMemories: [
      {
        id: "mem-mixed-qwen3",
        text: "推荐本地模型 qwen3:4b 通过 Ollama 运行。",
      },
    ],
    expectedInjectedIds: ["mem-mixed-qwen3"],
    expectedMatchedTokens: {
      "mem-mixed-qwen3": ["qwen3", "本地", "模型"],
    },
  },
  {
    caseId: "non-accepted-exclusion",
    categories: ["non-accepted"],
    query: "local Ollama model preference",
    acceptedMemories: [
      {
        id: "mem-accepted-only",
        text: "Accepted local Ollama model preference.",
      },
    ],
    nonAcceptedMemories: [
      {
        id: "mem-pending",
        text: "Pending local Ollama model preference.",
        status: "proposal",
      },
      {
        id: "mem-rejected",
        text: "Rejected local Ollama model preference.",
        status: "rejected",
      },
      {
        id: "mem-archived",
        text: "Archived local Ollama model preference.",
        status: "archived",
      },
    ],
    expectedInjectedIds: ["mem-accepted-only"],
    expectedNotInjectedIds: ["mem-pending", "mem-rejected", "mem-archived"],
  },
  {
    caseId: "unrelated-memory-exclusion",
    categories: ["zero-overlap"],
    query: "SQLite schema migration plan",
    acceptedMemories: [
      {
        id: "mem-hiking",
        text: "Owner enjoys weekend hiking trips.",
      },
    ],
    expectedInjectedIds: [],
    expectedNotInjectedIds: ["mem-hiking"],
    expectedSkipReasons: {
      "mem-hiking": "zero_relevance",
    },
  },
  {
    caseId: "max-count-exclusion",
    categories: ["budget"],
    query: "local model memory preference",
    acceptedMemories: [
      {
        id: "mem-count-old",
        text: "Old local model memory preference.",
        updatedAt: "2026-05-19T00:00:00.000Z",
      },
      {
        id: "mem-count-new",
        text: "New local model memory preference.",
        updatedAt: "2026-05-19T00:01:00.000Z",
      },
    ],
    maxInjectedMemories: 1,
    expectedInjectedIds: ["mem-count-new"],
    expectedNotInjectedIds: ["mem-count-old"],
    expectedSkipReasons: {
      "mem-count-old": "max_count_exceeded",
    },
  },
  {
    caseId: "memory-budget-exclusion",
    categories: ["budget"],
    query: "first second third memory snippet",
    acceptedMemories: [
      { id: "mem-budget-1", text: "first memory snippet" },
      { id: "mem-budget-2", text: "second memory snippet" },
      { id: "mem-budget-3", text: "third memory snippet" },
    ],
    maxMemoryContextCharacters: 355,
    expectedInjectedIds: ["mem-budget-1"],
    expectedNotInjectedIds: ["mem-budget-2", "mem-budget-3"],
    expectedSkipReasons: {
      "mem-budget-2": "memory_budget_exceeded",
      "mem-budget-3": "memory_budget_exceeded",
    },
  },
  {
    caseId: "privacy-no-text-leak",
    categories: ["privacy", "trace"],
    query: "private retrieval phrase",
    acceptedMemories: [
      {
        id: "mem-private-phrase",
        text: "Owner private retrieval phrase should stay out of trace.",
      },
    ],
    expectedInjectedIds: ["mem-private-phrase"],
    expectedMatchedTokens: {
      "mem-private-phrase": ["private", "retrieval", "phrase"],
    },
    expectedPrivacyForbiddenText: [
      "Owner private retrieval phrase should stay out of trace",
    ],
  },
  {
    caseId: "type-bonus-breaks-token-tie",
    categories: ["type-aware"],
    query: "project memory notes",
    acceptedMemories: [
      {
        id: "mem-type-tie-semantic",
        memoryType: "semantic",
        text: "Owner keeps memory notes.",
        updatedAt: "2026-05-19T00:01:00.000Z",
      },
      {
        id: "mem-type-tie-project",
        memoryType: "project",
        text: "Owner keeps memory notes.",
        updatedAt: "2026-05-19T00:00:00.000Z",
      },
    ],
    maxInjectedMemories: 1,
    expectedInjectedIds: ["mem-type-tie-project"],
    expectedNotInjectedIds: ["mem-type-tie-semantic"],
    expectedMatchedTokens: {
      "mem-type-tie-project": ["memory", "note"],
      "mem-type-tie-semantic": ["memory", "note"],
    },
    expectedMatchedTypeSignals: {
      "mem-type-tie-project": ["project"],
    },
    expectedTypeMatchBonuses: {
      "mem-type-tie-project": 1,
      "mem-type-tie-semantic": 0,
    },
    expectedSkipReasons: {
      "mem-type-tie-semantic": "max_count_exceeded",
    },
  },
  {
    caseId: "type-only-zero-overlap-excluded",
    categories: ["type-aware", "zero-overlap"],
    query: "project github branch",
    acceptedMemories: [
      {
        id: "mem-type-only-project",
        memoryType: "project",
        text: "Owner enjoys weekend hiking trips.",
      },
    ],
    expectedInjectedIds: [],
    expectedNotInjectedIds: ["mem-type-only-project"],
    expectedTypeMatchBonuses: {
      "mem-type-only-project": 0,
    },
    expectedSkipReasons: {
      "mem-type-only-project": "zero_relevance",
    },
  },
  {
    caseId: "token-relevance-beats-type-bonus",
    categories: ["type-aware", "token-dominance"],
    query: "project memory notes",
    acceptedMemories: [
      {
        id: "mem-weak-project-type",
        memoryType: "project",
        text: "Owner keeps memory notes.",
      },
      {
        id: "mem-strong-semantic-tokens",
        memoryType: "semantic",
        text: "Owner keeps project memory notes.",
      },
    ],
    maxInjectedMemories: 1,
    expectedInjectedIds: ["mem-strong-semantic-tokens"],
    expectedNotInjectedIds: ["mem-weak-project-type"],
    expectedMatchedTypeSignals: {
      "mem-weak-project-type": ["project"],
    },
    expectedTypeMatchBonuses: {
      "mem-weak-project-type": 1,
      "mem-strong-semantic-tokens": 0,
    },
    expectedSkipReasons: {
      "mem-weak-project-type": "max_count_exceeded",
    },
  },
  {
    caseId: "non-accepted-type-signal-excluded",
    categories: ["type-aware", "non-accepted"],
    query: "project memory notes",
    acceptedMemories: [],
    nonAcceptedMemories: [
      {
        id: "mem-pending-project-type",
        memoryType: "project",
        text: "Project memory notes should not inject while pending.",
        status: "proposal",
      },
      {
        id: "mem-rejected-project-type",
        memoryType: "project",
        text: "Project memory notes should not inject after rejection.",
        status: "rejected",
      },
    ],
    expectedInjectedIds: [],
    expectedNotInjectedIds: [
      "mem-pending-project-type",
      "mem-rejected-project-type",
    ],
  },
  {
    caseId: "cjk-type-bonus-breaks-token-tie",
    categories: ["cjk", "type-aware"],
    query: "项目 本地模型",
    acceptedMemories: [
      {
        id: "mem-cjk-type-semantic",
        memoryType: "semantic",
        text: "本地模型记忆。",
        updatedAt: "2026-05-19T00:01:00.000Z",
      },
      {
        id: "mem-cjk-type-project",
        memoryType: "project",
        text: "本地模型记忆。",
        updatedAt: "2026-05-19T00:00:00.000Z",
      },
    ],
    maxInjectedMemories: 1,
    expectedInjectedIds: ["mem-cjk-type-project"],
    expectedNotInjectedIds: ["mem-cjk-type-semantic"],
    expectedMatchedTokens: {
      "mem-cjk-type-project": ["本地", "地模", "模型"],
    },
    expectedMatchedTypeSignals: {
      "mem-cjk-type-project": ["项目"],
    },
    expectedTypeMatchBonuses: {
      "mem-cjk-type-project": 1,
      "mem-cjk-type-semantic": 0,
    },
    expectedSkipReasons: {
      "mem-cjk-type-semantic": "max_count_exceeded",
    },
  },
  {
    caseId: "type-trace-privacy-no-text-leak",
    categories: ["type-aware", "privacy", "trace"],
    query: "preference private retrieval phrase",
    acceptedMemories: [
      {
        id: "mem-type-private-phrase",
        memoryType: "preference",
        text: "Owner private retrieval phrase should stay out of type trace.",
      },
    ],
    expectedInjectedIds: ["mem-type-private-phrase"],
    expectedMatchedTokens: {
      "mem-type-private-phrase": ["private", "retrieval", "phrase"],
    },
    expectedMatchedTypeSignals: {
      "mem-type-private-phrase": ["preference"],
    },
    expectedTypeMatchBonuses: {
      "mem-type-private-phrase": 1,
    },
    expectedPrivacyForbiddenText: [
      "Owner private retrieval phrase should stay out of type trace",
    ],
  },
  {
    caseId: "metadata-token-relevance-dominates",
    categories: ["metadata-aware", "token-dominance", "privacy"],
    query: "project memory notes",
    acceptedMemories: [
      {
        id: "mem-metadata-high",
        text: "Owner keeps memory notes.",
        metadata: {
          tags: ["urgent-metadata-tag", "project"],
          importance: "high",
          confidence: "high",
          source: "owner-reviewed-source",
        },
      },
      {
        id: "mem-metadata-strong-tokens",
        text: "Owner keeps project memory notes.",
        metadata: {
          tags: [],
          importance: "low",
          confidence: "low",
          source: null,
        },
      },
    ],
    maxInjectedMemories: 1,
    expectedInjectedIds: ["mem-metadata-strong-tokens"],
    expectedNotInjectedIds: ["mem-metadata-high"],
    expectedSkipReasons: {
      "mem-metadata-high": "max_count_exceeded",
    },
    expectedMatchedTags: {
      "mem-metadata-high": ["project"],
    },
    expectedTagMatchBonuses: {
      "mem-metadata-high": 1,
      "mem-metadata-strong-tokens": 0,
    },
    expectedImportanceBonuses: {
      "mem-metadata-high": 1,
      "mem-metadata-strong-tokens": 0,
    },
    expectedMetadataBonuses: {
      "mem-metadata-high": 2,
      "mem-metadata-strong-tokens": 0,
    },
    expectedMetadataSignals: {
      "mem-metadata-high": ["tag_match", "importance_high"],
    },
    expectedPrivacyForbiddenText: [
      "urgent-metadata-tag",
      "owner-reviewed-source",
    ],
  },
  {
    caseId: "metadata-tag-match-boosts-relevant-memory",
    categories: ["metadata-aware"],
    query: "project memory notes",
    acceptedMemories: [
      {
        id: "mem-tag-project",
        text: "Owner keeps memory notes.",
        metadata: {
          tags: ["project"],
          importance: "normal",
          confidence: "medium",
          source: null,
        },
        updatedAt: "2026-05-19T00:00:00.000Z",
      },
      {
        id: "mem-tag-neutral-newer",
        text: "Owner keeps memory notes.",
        metadata: {
          tags: [],
          importance: "normal",
          confidence: "medium",
          source: null,
        },
        updatedAt: "2026-05-19T00:01:00.000Z",
      },
    ],
    maxInjectedMemories: 1,
    expectedInjectedIds: ["mem-tag-project"],
    expectedNotInjectedIds: ["mem-tag-neutral-newer"],
    expectedMatchedTags: {
      "mem-tag-project": ["project"],
    },
    expectedTagMatchBonuses: {
      "mem-tag-project": 1,
      "mem-tag-neutral-newer": 0,
    },
    expectedMetadataBonuses: {
      "mem-tag-project": 1,
      "mem-tag-neutral-newer": 0,
    },
    expectedMetadataSignals: {
      "mem-tag-project": ["tag_match"],
    },
    expectedSkipReasons: {
      "mem-tag-neutral-newer": "max_count_exceeded",
    },
  },
  {
    caseId: "metadata-tag-only-zero-overlap-excluded",
    categories: ["metadata-aware", "zero-overlap"],
    query: "project github branch",
    acceptedMemories: [
      {
        id: "mem-tag-only-zero-overlap",
        text: "Owner enjoys weekend hiking trips.",
        metadata: {
          tags: ["project", "github"],
          importance: "high",
          confidence: "high",
          source: null,
        },
      },
    ],
    expectedInjectedIds: [],
    expectedNotInjectedIds: ["mem-tag-only-zero-overlap"],
    expectedTagMatchBonuses: {
      "mem-tag-only-zero-overlap": 0,
    },
    expectedImportanceBonuses: {
      "mem-tag-only-zero-overlap": 0,
    },
    expectedMetadataBonuses: {
      "mem-tag-only-zero-overlap": 0,
    },
    expectedSkipReasons: {
      "mem-tag-only-zero-overlap": "zero_relevance",
    },
  },
  {
    caseId: "metadata-importance-bonus-bounded",
    categories: ["metadata-aware"],
    query: "memory notes",
    acceptedMemories: [
      {
        id: "mem-importance-high",
        text: "Owner keeps memory notes.",
        metadata: {
          tags: [],
          importance: "high",
          confidence: "medium",
          source: null,
        },
        updatedAt: "2026-05-19T00:00:00.000Z",
      },
      {
        id: "mem-importance-normal-newer",
        text: "Owner keeps memory notes.",
        metadata: {
          tags: [],
          importance: "normal",
          confidence: "medium",
          source: null,
        },
        updatedAt: "2026-05-19T00:01:00.000Z",
      },
    ],
    maxInjectedMemories: 1,
    expectedInjectedIds: ["mem-importance-high"],
    expectedNotInjectedIds: ["mem-importance-normal-newer"],
    expectedImportanceBonuses: {
      "mem-importance-high": 1,
      "mem-importance-normal-newer": 0,
    },
    expectedMetadataBonuses: {
      "mem-importance-high": 1,
      "mem-importance-normal-newer": 0,
    },
    expectedMetadataSignals: {
      "mem-importance-high": ["importance_high"],
    },
    expectedSkipReasons: {
      "mem-importance-normal-newer": "max_count_exceeded",
    },
  },
  {
    caseId: "metadata-low-confidence-dampens-bonus",
    categories: ["metadata-aware"],
    query: "project memory notes",
    acceptedMemories: [
      {
        id: "mem-confidence-low",
        text: "Owner keeps memory notes.",
        metadata: {
          tags: ["project"],
          importance: "high",
          confidence: "low",
          source: null,
        },
      },
    ],
    expectedInjectedIds: ["mem-confidence-low"],
    expectedMatchedTags: {
      "mem-confidence-low": ["project"],
    },
    expectedTagMatchBonuses: {
      "mem-confidence-low": 1,
    },
    expectedImportanceBonuses: {
      "mem-confidence-low": 1,
    },
    expectedConfidenceAdjustments: {
      "mem-confidence-low": -1,
    },
    expectedMetadataBonuses: {
      "mem-confidence-low": 1,
    },
    expectedMetadataSignals: {
      "mem-confidence-low": [
        "tag_match",
        "importance_high",
        "confidence_low_dampened",
      ],
    },
  },
  {
    caseId: "metadata-rich-non-accepted-excluded",
    categories: ["metadata-aware", "non-accepted", "privacy"],
    query: "project memory notes",
    acceptedMemories: [],
    nonAcceptedMemories: [
      {
        id: "mem-pending-metadata-rich",
        text: "Project memory notes should not inject while pending.",
        status: "proposal",
        metadata: {
          tags: ["project"],
          importance: "high",
          confidence: "high",
          source: "owner-reviewed-source",
        },
      },
    ],
    expectedInjectedIds: [],
    expectedNotInjectedIds: ["mem-pending-metadata-rich"],
    expectedPrivacyForbiddenText: ["owner-reviewed-source"],
  },
  {
    caseId: "metadata-trace-privacy-safe-fields",
    categories: ["metadata-aware", "privacy", "trace"],
    query: "project private phrase",
    acceptedMemories: [
      {
        id: "mem-metadata-private-trace",
        text: "Owner private retrieval phrase should stay out of metadata trace.",
        metadata: {
          tags: ["project"],
          importance: "high",
          confidence: "medium",
          source: "owner-reviewed-secret-source",
        },
      },
    ],
    expectedInjectedIds: ["mem-metadata-private-trace"],
    expectedMatchedTags: {
      "mem-metadata-private-trace": ["project"],
    },
    expectedMetadataBonuses: {
      "mem-metadata-private-trace": 2,
    },
    expectedMetadataSignals: {
      "mem-metadata-private-trace": ["tag_match", "importance_high"],
    },
    expectedPrivacyForbiddenText: [
      "Owner private retrieval phrase should stay out of metadata trace",
      "owner-reviewed-secret-source",
    ],
  },
  {
    caseId: "metadata-missing-behaves-neutral",
    categories: ["metadata-aware"],
    query: "memory notes",
    acceptedMemories: [
      {
        id: "mem-no-metadata-newer",
        text: "Owner keeps memory notes.",
        updatedAt: "2026-05-19T00:01:00.000Z",
      },
      {
        id: "mem-low-neutral-older",
        text: "Owner keeps memory notes.",
        metadata: {
          tags: [],
          importance: "low",
          confidence: "medium",
          source: null,
        },
        updatedAt: "2026-05-19T00:00:00.000Z",
      },
    ],
    maxInjectedMemories: 1,
    expectedInjectedIds: ["mem-no-metadata-newer"],
    expectedNotInjectedIds: ["mem-low-neutral-older"],
    expectedMetadataBonuses: {
      "mem-no-metadata-newer": 0,
      "mem-low-neutral-older": 0,
    },
    expectedSkipReasons: {
      "mem-low-neutral-older": "max_count_exceeded",
    },
  },
  {
    caseId: "metadata-near-miss-token-dominance",
    categories: ["metadata-aware", "token-dominance"],
    query: "github branch release checklist",
    acceptedMemories: [
      {
        id: "mem-metadata-near-miss",
        text: "Owner keeps github release notes.",
        metadata: {
          tags: ["branch", "checklist"],
          importance: "high",
          confidence: "high",
          source: null,
        },
      },
      {
        id: "mem-lexical-strong-checklist",
        text: "Owner keeps github branch release checklist.",
        metadata: {
          tags: [],
          importance: "low",
          confidence: "low",
          source: null,
        },
      },
    ],
    maxInjectedMemories: 1,
    expectedInjectedIds: ["mem-lexical-strong-checklist"],
    expectedNotInjectedIds: ["mem-metadata-near-miss"],
    expectedMatchedTags: {
      "mem-metadata-near-miss": ["branch", "checklist"],
    },
    expectedTagMatchBonuses: {
      "mem-metadata-near-miss": 1,
      "mem-lexical-strong-checklist": 0,
    },
    expectedImportanceBonuses: {
      "mem-metadata-near-miss": 1,
      "mem-lexical-strong-checklist": 0,
    },
    expectedMetadataBonuses: {
      "mem-metadata-near-miss": 2,
      "mem-lexical-strong-checklist": 0,
    },
    expectedMetadataSignals: {
      "mem-metadata-near-miss": ["tag_match", "importance_high"],
    },
    expectedSkipReasons: {
      "mem-metadata-near-miss": "max_count_exceeded",
    },
  },
  {
    caseId: "cjk-near-miss-token-dominance",
    categories: ["cjk", "token-dominance"],
    query: "本地模型安全策略",
    acceptedMemories: [
      {
        id: "mem-cjk-near-miss",
        text: "本地模型展览安排。",
      },
      {
        id: "mem-cjk-strong-policy",
        text: "本地模型安全策略。",
      },
    ],
    maxInjectedMemories: 1,
    expectedInjectedIds: ["mem-cjk-strong-policy"],
    expectedNotInjectedIds: ["mem-cjk-near-miss"],
    expectedSkipReasons: {
      "mem-cjk-near-miss": "max_count_exceeded",
    },
  },
  {
    caseId: "metadata-rich-budget-edge",
    categories: ["metadata-aware", "budget"],
    query: "project memory budget notes",
    acceptedMemories: [
      {
        id: "mem-budget-metadata-first",
        text: "project memory budget notes first",
        metadata: {
          tags: ["project"],
          importance: "high",
          confidence: "high",
          source: null,
        },
      },
      {
        id: "mem-budget-metadata-second",
        text: "project memory budget notes second",
        metadata: {
          tags: ["project"],
          importance: "high",
          confidence: "high",
          source: null,
        },
      },
    ],
    maxMemoryContextCharacters: 355,
    expectedInjectedIds: ["mem-budget-metadata-first"],
    expectedNotInjectedIds: ["mem-budget-metadata-second"],
    expectedMetadataBonuses: {
      "mem-budget-metadata-first": 2,
      "mem-budget-metadata-second": 2,
    },
    expectedSkipReasons: {
      "mem-budget-metadata-second": "memory_budget_exceeded",
    },
  },
  {
    caseId: "metadata-privacy-no-leak-with-source",
    categories: ["metadata-aware", "privacy", "trace"],
    query: "project private phrase",
    acceptedMemories: [
      {
        id: "mem-metadata-source-private",
        text: "Owner private metadata source phrase should stay out of trace.",
        metadata: {
          tags: ["project"],
          importance: "high",
          confidence: "high",
          source: "private-source-note",
        },
      },
    ],
    expectedInjectedIds: ["mem-metadata-source-private"],
    expectedMatchedTags: {
      "mem-metadata-source-private": ["project"],
    },
    expectedMetadataBonuses: {
      "mem-metadata-source-private": 2,
    },
    expectedPrivacyForbiddenText: [
      "Owner private metadata source phrase should stay out of trace",
      "private-source-note",
    ],
  },
  {
    caseId: "type-metadata-interaction-breaks-tie",
    categories: ["type-aware", "metadata-aware"],
    query: "preference project memory notes",
    acceptedMemories: [
      {
        id: "mem-interaction-neutral-newer",
        memoryType: "semantic",
        text: "Owner keeps project memory notes.",
        metadata: {
          tags: [],
          importance: "normal",
          confidence: "medium",
          source: null,
        },
        updatedAt: "2026-05-19T00:01:00.000Z",
      },
      {
        id: "mem-interaction-preference-metadata",
        memoryType: "preference",
        text: "Owner keeps project memory notes.",
        metadata: {
          tags: ["project"],
          importance: "high",
          confidence: "medium",
          source: null,
        },
        updatedAt: "2026-05-19T00:00:00.000Z",
      },
    ],
    maxInjectedMemories: 1,
    expectedInjectedIds: ["mem-interaction-preference-metadata"],
    expectedNotInjectedIds: ["mem-interaction-neutral-newer"],
    expectedMatchedTypeSignals: {
      "mem-interaction-preference-metadata": ["preference"],
    },
    expectedTypeMatchBonuses: {
      "mem-interaction-preference-metadata": 1,
      "mem-interaction-neutral-newer": 0,
    },
    expectedMatchedTags: {
      "mem-interaction-preference-metadata": ["project"],
    },
    expectedMetadataBonuses: {
      "mem-interaction-preference-metadata": 2,
      "mem-interaction-neutral-newer": 0,
    },
    expectedSkipReasons: {
      "mem-interaction-neutral-newer": "max_count_exceeded",
    },
  },
];
