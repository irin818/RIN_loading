import { describe, expect, it } from "vitest";
import { readSemanticContextConfig } from "./semanticContextConfig";

describe("readSemanticContextConfig", () => {
  it("defaults semantic context expansion off", () => {
    expect(readSemanticContextConfig({})).toEqual({
      mode: "off",
      enabled: false,
      maxCandidates: 2,
      maxCharacters: 600,
      invalidReasons: [],
    });
  });

  it("enables candidate expansion only with explicit valid config", () => {
    expect(
      readSemanticContextConfig({
        RIN_SEMANTIC_CONTEXT: "candidate-expansion",
        RIN_SEMANTIC_CONTEXT_MAX_CANDIDATES: "3",
        RIN_SEMANTIC_CONTEXT_MAX_CHARACTERS: "900",
      }),
    ).toEqual({
      mode: "candidate-expansion",
      enabled: true,
      maxCandidates: 3,
      maxCharacters: 900,
      invalidReasons: [],
    });
  });

  it("falls back safely for invalid config", () => {
    const config = readSemanticContextConfig({
      RIN_SEMANTIC_CONTEXT: "auto",
      RIN_SEMANTIC_CONTEXT_MAX_CANDIDATES: "0",
      RIN_SEMANTIC_CONTEXT_MAX_CHARACTERS: "many",
    });

    expect(config.enabled).toBe(false);
    expect(config.mode).toBe("off");
    expect(config.maxCandidates).toBe(2);
    expect(config.maxCharacters).toBe(600);
    expect(config.invalidReasons).toHaveLength(3);
  });
});
