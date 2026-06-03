import type { MemoryMetadataInput, MemoryStatus, MemoryType } from "./manager";

export type SemanticComparisonCategory =
  | "paraphrase-recall"
  | "false-positive"
  | "hybrid"
  | "accepted-only"
  | "privacy"
  | "zero-overlap"
  | "deterministic-baseline";

export type SemanticComparisonMemoryInput = {
  id: string;
  text: string;
  memoryType?: MemoryType;
  metadata?: MemoryMetadataInput;
  status?: MemoryStatus;
  updatedAt?: string;
};

export type SemanticComparisonCase = {
  caseId: string;
  categories?: SemanticComparisonCategory[];
  query: string;
  acceptedMemories: SemanticComparisonMemoryInput[];
  nonAcceptedMemories?: SemanticComparisonMemoryInput[];
  /**
   * Fixture-only semantic candidate IDs. This is not real semantic retrieval,
   * embedding search, provider output, or production retrieval behavior.
   */
  semanticCandidateIds: string[];
  expectedInjectedIds: string[];
  expectedDeterministicInjectedIds?: string[];
  expectedSemanticCandidateIds?: string[];
  expectedHybridCandidateIds?: string[];
  expectedFalsePositiveIds?: string[];
  expectedFalseNegativeIds?: string[];
  expectedAcceptedOnlyViolationIds?: string[];
  expectedZeroOverlapSemanticCandidateIds?: string[];
  expectedPrivacyForbiddenText?: string[];
  notes?: string[];
};

export const BUILT_IN_SEMANTIC_COMPARISON_CASES: SemanticComparisonCase[] = [
  {
    caseId: "semantic-paraphrase-recovers-routine",
    categories: ["paraphrase-recall", "zero-overlap", "deterministic-baseline"],
    query: "Which morning focus routine should be used?",
    acceptedMemories: [
      {
        id: "sem-paraphrase-routine",
        memoryType: "procedural",
        text: "Owner starts the day by triaging urgent inbox items before calendar review.",
      },
    ],
    semanticCandidateIds: ["sem-paraphrase-routine"],
    expectedInjectedIds: ["sem-paraphrase-routine"],
    expectedDeterministicInjectedIds: [],
    expectedSemanticCandidateIds: ["sem-paraphrase-routine"],
    expectedHybridCandidateIds: ["sem-paraphrase-routine"],
    expectedZeroOverlapSemanticCandidateIds: ["sem-paraphrase-routine"],
    expectedPrivacyForbiddenText: [
      "Owner starts the day by triaging urgent inbox items before calendar review",
    ],
    notes: ["Fixture annotation simulates a paraphrase candidate only."],
  },
  {
    caseId: "semantic-false-positive-detected",
    categories: ["false-positive", "deterministic-baseline"],
    query: "local model adapter setup",
    acceptedMemories: [
      {
        id: "sem-local-adapter",
        memoryType: "semantic",
        text: "RIN local model adapter setup uses explicit configuration.",
      },
      {
        id: "sem-ui-theme",
        memoryType: "preference",
        text: "Owner prefers compact interface spacing in the console.",
      },
    ],
    semanticCandidateIds: ["sem-local-adapter", "sem-ui-theme"],
    expectedInjectedIds: ["sem-local-adapter"],
    expectedDeterministicInjectedIds: ["sem-local-adapter"],
    expectedSemanticCandidateIds: ["sem-local-adapter", "sem-ui-theme"],
    expectedHybridCandidateIds: ["sem-local-adapter", "sem-ui-theme"],
    expectedFalsePositiveIds: ["sem-ui-theme"],
    expectedZeroOverlapSemanticCandidateIds: ["sem-ui-theme"],
  },
  {
    caseId: "semantic-hybrid-identifies-both-sources",
    categories: ["hybrid", "paraphrase-recall", "deterministic-baseline"],
    query: "project branch review",
    acceptedMemories: [
      {
        id: "sem-branch-review",
        memoryType: "project",
        text: "Project branch review should happen before merge.",
      },
      {
        id: "sem-merge-gate",
        memoryType: "procedural",
        text: "Owner waits for verification gates before integrating completed work.",
      },
    ],
    semanticCandidateIds: ["sem-merge-gate"],
    expectedInjectedIds: ["sem-branch-review", "sem-merge-gate"],
    expectedDeterministicInjectedIds: ["sem-branch-review"],
    expectedSemanticCandidateIds: ["sem-merge-gate"],
    expectedHybridCandidateIds: ["sem-branch-review", "sem-merge-gate"],
    expectedZeroOverlapSemanticCandidateIds: ["sem-merge-gate"],
  },
  {
    caseId: "semantic-non-accepted-flagged-and-excluded",
    categories: ["accepted-only", "deterministic-baseline"],
    query: "accepted memory boundary",
    acceptedMemories: [
      {
        id: "sem-accepted-boundary",
        memoryType: "semantic",
        text: "Accepted memory boundary remains enforced for retrieval.",
      },
    ],
    nonAcceptedMemories: [
      {
        id: "sem-pending-boundary",
        memoryType: "semantic",
        status: "proposal",
        text: "Pending memory boundary must not become a semantic candidate.",
      },
    ],
    semanticCandidateIds: ["sem-accepted-boundary", "sem-pending-boundary"],
    expectedInjectedIds: ["sem-accepted-boundary"],
    expectedDeterministicInjectedIds: ["sem-accepted-boundary"],
    expectedSemanticCandidateIds: [
      "sem-accepted-boundary",
      "sem-pending-boundary",
    ],
    expectedHybridCandidateIds: ["sem-accepted-boundary"],
    expectedAcceptedOnlyViolationIds: ["sem-pending-boundary"],
  },
  {
    caseId: "semantic-privacy-report-hides-text",
    categories: ["privacy", "hybrid"],
    query: "private semantic report",
    acceptedMemories: [
      {
        id: "sem-private-memory",
        memoryType: "semantic",
        text: "Synthetic confidential semantic phrase must stay out of reports.",
      },
    ],
    semanticCandidateIds: ["sem-private-memory"],
    expectedInjectedIds: ["sem-private-memory"],
    expectedDeterministicInjectedIds: ["sem-private-memory"],
    expectedSemanticCandidateIds: ["sem-private-memory"],
    expectedHybridCandidateIds: ["sem-private-memory"],
    expectedPrivacyForbiddenText: [
      "Synthetic confidential semantic phrase must stay out of reports",
    ],
  },
  {
    caseId: "semantic-zero-overlap-report-only",
    categories: ["zero-overlap", "paraphrase-recall", "deterministic-baseline"],
    query: "API credential rotation checklist",
    acceptedMemories: [
      {
        id: "sem-secret-hygiene",
        memoryType: "procedural",
        text: "Owner renews access keys through offline safety steps.",
      },
    ],
    semanticCandidateIds: ["sem-secret-hygiene"],
    expectedInjectedIds: ["sem-secret-hygiene"],
    expectedDeterministicInjectedIds: [],
    expectedSemanticCandidateIds: ["sem-secret-hygiene"],
    expectedHybridCandidateIds: ["sem-secret-hygiene"],
    expectedZeroOverlapSemanticCandidateIds: ["sem-secret-hygiene"],
  },
  {
    caseId: "semantic-deterministic-baseline-unchanged",
    categories: ["deterministic-baseline", "hybrid"],
    query: "memory metadata ranking",
    acceptedMemories: [
      {
        id: "sem-metadata-ranking",
        memoryType: "semantic",
        text: "Memory metadata ranking remains deterministic and bounded.",
      },
      {
        id: "sem-archive-policy",
        memoryType: "procedural",
        text: "Owner waits for verification gates before integration.",
      },
    ],
    semanticCandidateIds: ["sem-archive-policy"],
    expectedInjectedIds: ["sem-metadata-ranking", "sem-archive-policy"],
    expectedDeterministicInjectedIds: ["sem-metadata-ranking"],
    expectedSemanticCandidateIds: ["sem-archive-policy"],
    expectedHybridCandidateIds: ["sem-metadata-ranking", "sem-archive-policy"],
    expectedZeroOverlapSemanticCandidateIds: ["sem-archive-policy"],
  },
];
