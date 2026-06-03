export type ContextBudgetPolicy = {
  maxRecentMessages: number;
  maxInputCharacters: number;
  preserveLatestOwnerMessage: boolean;
};

export const DEFAULT_CONTEXT_BUDGET: ContextBudgetPolicy = {
  maxRecentMessages: 12,
  maxInputCharacters: 12_000,
  preserveLatestOwnerMessage: true,
};

