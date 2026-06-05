import { describe, expect, it } from "vitest";
import {
  evaluateDailyChatResponse,
  formatDailyChatEvaluationReport,
  hasUnsafeThinkingLeak,
  runDailyChatEvaluation,
  sanitizeAssistantContent,
} from "./assistantResponseQuality";

describe("assistant response quality", () => {
  it("removes paired thinking blocks without exposing hidden text", () => {
    const result = sanitizeAssistantContent(
      "<think>hidden analysis</think>\n\n今晚吃番茄鸡蛋面。",
    );

    expect(result.content).toBe("今晚吃番茄鸡蛋面。");
    expect(result.removedThinkingArtifacts).toBe(true);
    expect(result.content).not.toContain("hidden analysis");
  });

  it("removes leaked preamble before an unpaired closing thinking tag", () => {
    const result = sanitizeAssistantContent(
      "首先，用户问晚饭建议，我需要分析。\n</think>\n\n今晚吃番茄鸡蛋面。",
    );

    expect(result.content).toBe("今晚吃番茄鸡蛋面。");
    expect(result.content).not.toContain("首先");
    expect(result.content).not.toContain("</think>");
  });

  it("keeps a clean final paragraph after untagged internal analysis", () => {
    const result = sanitizeAssistantContent(
      "首先，用户问晚饭建议，我需要分析。\n\n今晚吃番茄鸡蛋面，简单热乎。",
    );

    expect(result.content).toBe("今晚吃番茄鸡蛋面，简单热乎。");
    expect(result.removedThinkingArtifacts).toBe(true);
    expect(result.content).not.toContain("用户问");
  });

  it("detects internal analysis without relying only on tags", () => {
    expect(
      hasUnsafeThinkingLeak(
        "首先，用户问今天晚上吃什么好。我需要考虑用户偏好。",
      ),
    ).toBe(true);
  });

  it("accepts concise practical daily chat after sanitization", () => {
    const quality = evaluateDailyChatResponse(
      "先分析一下。\n</think>\n\n今晚可以吃番茄鸡蛋面，快手、热乎，也容易加青菜。",
    );

    expect(quality.passed).toBe(true);
    expect(quality.removedThinkingArtifacts).toBe(true);
    expect(quality.sanitizedContent).toBe(
      "今晚可以吃番茄鸡蛋面，快手、热乎，也容易加青菜。",
    );
  });

  it("rejects daily chat policy dumps and fake external access", () => {
    expect(
      evaluateDailyChatResponse(
        "作为本地优先、单一所有者系统，我不能成为身份来源。今晚吃面。",
      ).issueCodes,
    ).toEqual(["policy_dump"]);
    expect(
      evaluateDailyChatResponse("我查了附近外卖平台，推荐你点烤鱼。").issueCodes,
    ).toEqual(["fake_external_access"]);
  });

  it("runs the provider-free daily chat evaluation without printing full text", () => {
    const report = runDailyChatEvaluation();
    const formatted = formatDailyChatEvaluationReport(report);

    expect(report.status).toBe("passed");
    expect(report.providerCallCount).toBe(0);
    expect(report.externalProviderCallCount).toBe(0);
    expect(report.realDataRead).toBe(false);
    expect(report.fullTextIncluded).toBe(false);
    expect(formatted).toContain("RIN daily chat evaluation.");
    expect(formatted).not.toContain("番茄鸡蛋面");
    expect(formatted).not.toContain("用户问");
  });
});
