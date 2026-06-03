import { describe, expect, it } from "vitest";
import {
  evaluateMemoryCase,
  formatMemoryEvaluationSummary,
  runBuiltInMemoryEvaluation,
  runMemoryEvaluationCases,
  summarizeMemoryEvaluationCategories,
} from "./evaluation";
import type { MemoryEvaluationCase } from "./evaluationFixtures";

describe("runBuiltInMemoryEvaluation", () => {
  it("passes the built-in memory injection fixtures", () => {
    const result = runBuiltInMemoryEvaluation();

    expect(result.total).toBeGreaterThanOrEqual(10);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(result.total);
    expect(result.providerCallCount).toBe(0);
  });

  it("prints a concise summary", () => {
    const result = runBuiltInMemoryEvaluation();
    const summary = formatMemoryEvaluationSummary(result);

    expect(summary).toContain("RIN memory injection evaluation.");
    expect(summary).toContain(`Total: ${result.total}`);
    expect(summary).toContain("Failed: 0");
    expect(summary).toContain("providerCallCount: 0");
    expect(summary).toContain("Failed case IDs: none");
    expect(summary).toContain("Categories:");
    expect(result.categorySummaries.length).toBeGreaterThan(0);
    expect(result.categorySummaries.map((item) => item.category)).toContain(
      "metadata-aware",
    );
    expect(result.categorySummaries.map((item) => item.category)).toContain(
      "privacy",
    );
  });

  it("summarizes category pass and failure counts without memory text", () => {
    const result = runMemoryEvaluationCases([
      {
        caseId: "category-pass",
        categories: ["lexical"],
        query: "local model",
        acceptedMemories: [{ id: "a", text: "local model preference" }],
        expectedInjectedIds: ["a"],
      },
      {
        caseId: "category-fail",
        categories: ["lexical", "privacy"],
        query: "private model",
        acceptedMemories: [
          {
            id: "b",
            text: "private full memory text should not appear in summary",
          },
        ],
        expectedInjectedIds: ["missing"],
      },
    ]);
    const summary = formatMemoryEvaluationSummary(result);

    expect(result.failedCaseIds).toEqual(["category-fail"]);
    expect(
      summarizeMemoryEvaluationCategories(result.caseResults),
    ).toMatchObject([
      {
        category: "lexical",
        total: 2,
        passed: 1,
        failed: 1,
        failedCaseIds: ["category-fail"],
      },
      {
        category: "privacy",
        total: 1,
        passed: 0,
        failed: 1,
        failedCaseIds: ["category-fail"],
      },
    ]);
    expect(summary).toContain("Failed case IDs: category-fail");
    expect(summary).toContain(
      "- lexical: 1 passed / 1 failed (2 total); failed IDs: category-fail",
    );
    expect(summary).toContain(
      "- privacy: 0 passed / 1 failed (1 total); failed IDs: category-fail",
    );
    expect(summary).toContain("providerCallCount: 0");
    expect(summary).not.toContain("private full memory text");
  });
});

describe("evaluateMemoryCase", () => {
  it("reports useful failures for wrong expected injected ids", () => {
    const result = evaluateMemoryCase({
      caseId: "deliberate-failure",
      query: "local model",
      acceptedMemories: [
        {
          id: "actual-memory",
          text: "local models are relevant",
        },
      ],
      expectedInjectedIds: ["missing-memory"],
    });

    expect(result.passed).toBe(false);
    expect(result.failures.join("\n")).toContain("Expected injected ids");
    expect(result.failures.join("\n")).toContain("missing-memory");
    expect(result.failures.join("\n")).toContain("actual-memory");
  });

  it("detects forbidden text in trace privacy checks", () => {
    const result = evaluateMemoryCase({
      caseId: "privacy-failure",
      query: "local model",
      acceptedMemories: [
        {
          id: "m1",
          text: "local model preference",
        },
      ],
      expectedInjectedIds: ["m1"],
      expectedPrivacyForbiddenText: ["local"],
    });

    expect(result.passed).toBe(false);
    expect(result.privacyPassed).toBe(false);
    expect(result.failures.join("\n")).toContain("Trace leaked forbidden");
    expect(result.failures.join("\n")).not.toContain("local model preference");
  });

  it("evaluates pending, rejected, and archived memories as excluded", () => {
    const result = evaluateMemoryCase({
      caseId: "non-accepted-excluded",
      query: "local Ollama model",
      acceptedMemories: [],
      nonAcceptedMemories: [
        { id: "pending", text: "local Ollama model", status: "proposal" },
        { id: "rejected", text: "local Ollama model", status: "rejected" },
        { id: "archived", text: "local Ollama model", status: "archived" },
      ],
      expectedInjectedIds: [],
      expectedNotInjectedIds: ["pending", "rejected", "archived"],
    });

    expect(result.passed).toBe(true);
    expect(result.trace.items).toEqual([]);
  });

  it("evaluates unrelated memories as zero relevance", () => {
    const result = evaluateMemoryCase({
      caseId: "unrelated",
      query: "SQLite schema migration",
      acceptedMemories: [{ id: "hiking", text: "weekend hiking trips" }],
      expectedInjectedIds: [],
      expectedNotInjectedIds: ["hiking"],
      expectedSkipReasons: { hiking: "zero_relevance" },
    });

    expect(result.passed).toBe(true);
    expect(result.skipReasonsByMemoryId.hiking).toBe("zero_relevance");
  });

  it("evaluates max count and memory budget exclusions", () => {
    const cases: MemoryEvaluationCase[] = [
      {
        caseId: "max-count",
        query: "local model memory",
        acceptedMemories: [
          {
            id: "old",
            text: "old local model memory",
            updatedAt: "2026-05-19T00:00:00.000Z",
          },
          {
            id: "new",
            text: "new local model memory",
            updatedAt: "2026-05-19T00:01:00.000Z",
          },
        ],
        maxInjectedMemories: 1,
        expectedInjectedIds: ["new"],
        expectedNotInjectedIds: ["old"],
        expectedSkipReasons: { old: "max_count_exceeded" },
      },
      {
        caseId: "budget",
        query: "first second third memory snippet",
        acceptedMemories: [
          { id: "one", text: "first memory snippet" },
          { id: "two", text: "second memory snippet" },
          { id: "three", text: "third memory snippet" },
        ],
        maxMemoryContextCharacters: 355,
        expectedInjectedIds: ["one", "three"],
        expectedNotInjectedIds: ["two"],
        expectedSkipReasons: {
          two: "memory_budget_exceeded",
        },
      },
    ];

    const result = runMemoryEvaluationCases(cases);

    expect(result.failed).toBe(0);
  });

  it("detects expected matched normalized tokens", () => {
    const result = evaluateMemoryCase({
      caseId: "matched-tokens",
      query: "qwen3 本地模型",
      acceptedMemories: [
        {
          id: "mixed",
          text: "推荐本地模型 qwen3:4b 通过 Ollama 运行。",
        },
      ],
      expectedInjectedIds: ["mixed"],
      expectedMatchedTokens: { mixed: ["qwen3", "本地", "模型"] },
    });

    expect(result.passed).toBe(true);
    expect(result.matchedTokensByMemoryId.mixed).toEqual(
      expect.arrayContaining(["qwen3", "本地", "模型"]),
    );
  });
});
