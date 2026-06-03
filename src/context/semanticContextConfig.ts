export type SemanticContextMode = "off" | "candidate-expansion";

export type SemanticContextConfig = {
  mode: SemanticContextMode;
  enabled: boolean;
  maxCandidates: number;
  maxCharacters: number;
  invalidReasons: string[];
};

export type SemanticContextEnvironment = Record<string, string | undefined>;

export const DEFAULT_SEMANTIC_CONTEXT_MAX_CANDIDATES = 2;
export const DEFAULT_SEMANTIC_CONTEXT_MAX_CHARACTERS = 600;

export function readSemanticContextConfig(
  env: SemanticContextEnvironment = process.env,
): SemanticContextConfig {
  const rawMode = env.RIN_SEMANTIC_CONTEXT ?? "off";
  const invalidReasons: string[] = [];
  const mode = readMode(rawMode, invalidReasons);
  const maxCandidates = readPositiveInteger(
    env.RIN_SEMANTIC_CONTEXT_MAX_CANDIDATES,
    DEFAULT_SEMANTIC_CONTEXT_MAX_CANDIDATES,
    "RIN_SEMANTIC_CONTEXT_MAX_CANDIDATES",
    invalidReasons,
  );
  const maxCharacters = readPositiveInteger(
    env.RIN_SEMANTIC_CONTEXT_MAX_CHARACTERS,
    DEFAULT_SEMANTIC_CONTEXT_MAX_CHARACTERS,
    "RIN_SEMANTIC_CONTEXT_MAX_CHARACTERS",
    invalidReasons,
  );

  return {
    mode,
    enabled: mode === "candidate-expansion" && invalidReasons.length === 0,
    maxCandidates,
    maxCharacters,
    invalidReasons,
  };
}

function readMode(value: string, invalidReasons: string[]): SemanticContextMode {
  if (value === "off" || value.trim().length === 0) {
    return "off";
  }

  if (value === "candidate-expansion") {
    return "candidate-expansion";
  }

  invalidReasons.push("RIN_SEMANTIC_CONTEXT must be off or candidate-expansion.");
  return "off";
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  invalidReasons: string[],
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    invalidReasons.push(`${name} must be a positive integer.`);
    return fallback;
  }

  return parsed;
}
