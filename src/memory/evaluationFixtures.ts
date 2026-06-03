import type { MemoryStatus, MemoryType } from "./manager";
import type { MemorySkipReason } from "./retrieval";

export type MemoryEvaluationMemoryInput = {
  id: string;
  text: string;
  memoryType?: MemoryType;
  status?: MemoryStatus;
  updatedAt?: string;
};

export type MemoryEvaluationCase = {
  caseId: string;
  query: string;
  acceptedMemories: MemoryEvaluationMemoryInput[];
  nonAcceptedMemories?: MemoryEvaluationMemoryInput[];
  expectedInjectedIds: string[];
  expectedNotInjectedIds?: string[];
  expectedMatchedTokens?: Record<string, string[]>;
  expectedMatchedTypeSignals?: Record<string, string[]>;
  expectedTypeMatchBonuses?: Record<string, number>;
  expectedSkipReasons?: Record<string, MemorySkipReason>;
  expectedPrivacyForbiddenText?: string[];
  maxInjectedMemories?: number;
  maxMemoryContextCharacters?: number;
};

export const BUILT_IN_MEMORY_EVALUATION_CASES: MemoryEvaluationCase[] = [
  {
    caseId: "plural-model-models",
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
];
