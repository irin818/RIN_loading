import { describe, expect, it } from "vitest";
import {
  buildRetrievalTokenProfile,
  normalizeLatinToken,
  preprocessText,
  scoreRetrievalOverlap,
} from "./retrievalTokens";
import { retrieveAcceptedMemoriesWithExplanation } from "./retrieval";
import type { MemoryRecord } from "./manager";

describe("normalizeLatinToken", () => {
  it("normalizes common English plurals without aggressive stemming", () => {
    expect(normalizeLatinToken("models")).toBe("model");
    expect(normalizeLatinToken("APIs")).toBe("api");
    expect(normalizeLatinToken("memories")).toBe("memory");
    expect(normalizeLatinToken("systems")).toBe("system");
    expect(normalizeLatinToken("agents")).toBe("agent");
    expect(normalizeLatinToken("class")).toBe("class");
    expect(normalizeLatinToken("status")).toBe("status");
  });
});

describe("preprocessText", () => {
  it("splits slash and hyphen separated tokens", () => {
    expect(preprocessText("Ollama/Qwen3")).toBe("ollama qwen3");
    expect(preprocessText("local-model-first")).toBe("local model first");
    expect(preprocessText("API-compatible")).toBe("api compatible");
  });
});

describe("buildRetrievalTokenProfile", () => {
  it("filters English stopwords but keeps technical tokens", () => {
    const profile = buildRetrievalTokenProfile(
      "The local model and API for RIN should use Ollama",
    );

    expect(profile.latinTokens.has("the")).toBe(false);
    expect(profile.latinTokens.has("local")).toBe(true);
    expect(profile.latinTokens.has("model")).toBe(true);
    expect(profile.latinTokens.has("api")).toBe(true);
    expect(profile.latinTokens.has("rin")).toBe(true);
    expect(profile.latinTokens.has("ollama")).toBe(true);
  });

  it("extracts CJK bigrams for Chinese phrases", () => {
    const profile = buildRetrievalTokenProfile("所有者偏好本地模型");

    expect(profile.cjkBigrams.has("本地")).toBe(true);
    expect(profile.cjkBigrams.has("地模")).toBe(true);
    expect(profile.cjkBigrams.has("模型")).toBe(true);
  });

  it("supports mixed Latin and CJK queries", () => {
    const profile = buildRetrievalTokenProfile("qwen3 本地模型");

    expect(profile.latinTokens.has("qwen3")).toBe(true);
    expect(profile.cjkBigrams.has("本地")).toBe(true);
    expect(profile.cjkBigrams.has("模型")).toBe(true);
  });
});

describe("scoreRetrievalOverlap", () => {
  it("matches singular query tokens to plural memory tokens", () => {
    const owner = buildRetrievalTokenProfile("Which local Ollama model?");
    const memory = buildRetrievalTokenProfile("Owner prefers local Ollama models.");

    const match = scoreRetrievalOverlap(owner, memory);

    expect(match.latinTokenMatchCount).toBeGreaterThan(0);
    expect(match.matchedKeywords).toContain("model");
    expect(match.matchedKeywords).toContain("ollama");
    expect(match.matchedKeywords).toContain("local");
  });

  it("matches Chinese phrases through CJK bigrams", () => {
    const owner = buildRetrievalTokenProfile("请说明本地模型的偏好");
    const memory = buildRetrievalTokenProfile("所有者记录：偏好本地模型与 Ollama。");

    const match = scoreRetrievalOverlap(owner, memory);

    expect(match.cjkBigramMatchCount).toBeGreaterThan(0);
    expect(match.matchedKeywords.some((token) => token.includes("本地"))).toBe(
      true,
    );
  });

  it("returns zero score for unrelated text", () => {
    const owner = buildRetrievalTokenProfile("SQLite schema migration");
    const memory = buildRetrievalTokenProfile("周末徒步旅行计划");

    const match = scoreRetrievalOverlap(owner, memory);

    expect(match.overlapCount).toBe(0);
    expect(match.score).toBe(0);
  });
});

describe("retrieveAcceptedMemoriesWithExplanation integration", () => {
  function mem(id: string, text: string): MemoryRecord {
    return {
      id,
      memoryType: "semantic",
      content: { text },
      sourceMessageId: null,
      status: "accepted",
      createdAt: "2026-05-19T00:00:00.000Z",
      updatedAt: "2026-05-19T00:00:00.000Z",
    };
  }

  it("matches model vs models and explains normalized tokens", () => {
    const result = retrieveAcceptedMemoriesWithExplanation(
      [mem("m1", "Owner prefers local Ollama models.")],
      "Which local Ollama model should RIN use?",
    );

    expect(result.snippets).toHaveLength(1);
    expect(result.explanations[0]?.matchedKeywords).toContain("model");
    expect(result.explanations[0]?.latinTokenMatchCount).toBeGreaterThan(0);
    expect(JSON.stringify(result.explanations)).not.toContain(
      "Owner prefers",
    );
  });

  it("matches mixed qwen3 and Chinese memory text", () => {
    const result = retrieveAcceptedMemoriesWithExplanation(
      [mem("m1", "推荐本地模型 qwen3:4b 通过 Ollama 运行。")],
      "qwen3 本地模型",
    );

    expect(result.snippets).toHaveLength(1);
    expect(result.explanations[0]?.matchedKeywords).toContain("qwen3");
    expect(result.explanations[0]?.cjkBigramMatchCount).toBeGreaterThan(0);
  });

  it("keeps deterministic ranking for equal-score ties", () => {
    const result = retrieveAcceptedMemoriesWithExplanation(
      [
        {
          ...mem("a", "note a about local models"),
          updatedAt: "2026-05-19T00:00:00.000Z",
        },
        {
          ...mem("b", "note b about local models"),
          updatedAt: "2026-05-19T00:01:00.000Z",
        },
      ],
      "local models",
    );

    expect(result.snippets.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
