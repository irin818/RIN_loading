export type AssistantResponseIssueCode =
  | "empty_content"
  | "thinking_tag"
  | "internal_analysis"
  | "policy_dump"
  | "fake_external_access"
  | "excessive_length";

export type AssistantContentSanitization = {
  content: string;
  removedThinkingArtifacts: boolean;
};

export type DailyChatQualityResult = {
  passed: boolean;
  issueCodes: AssistantResponseIssueCode[];
  sanitizedContent: string;
  contentLength: number;
  removedThinkingArtifacts: boolean;
  maxAllowedCharacters: number;
};

export type DailyChatEvaluationCase = {
  id: string;
  prompt: string;
  response: string;
  expectedPassed: boolean;
  expectedIssueCodes?: AssistantResponseIssueCode[];
};

export type DailyChatEvaluationCaseResult = {
  id: string;
  expectedPassed: boolean;
  actualPassed: boolean;
  passed: boolean;
  issueCodes: AssistantResponseIssueCode[];
  contentLength: number;
  removedThinkingArtifacts: boolean;
};

export type DailyChatEvaluationReport = {
  mode: "daily-chat-eval";
  status: "passed" | "failed";
  total: number;
  passed: number;
  failed: number;
  providerCallCount: 0;
  externalProviderCallCount: 0;
  realDataRead: false;
  fullTextIncluded: false;
  cases: DailyChatEvaluationCaseResult[];
};

export const DAILY_CHAT_MAX_RESPONSE_CHARACTERS = 420;

const THINKING_BLOCK_PATTERN = /<think\b[^>]*>[\s\S]*?<\/think>/gi;
const THINKING_TAG_PATTERN = /<\/?think\b[^>]*>/i;
const CLOSING_THINK_TAG = "</think>";

const INTERNAL_ANALYSIS_PATTERNS: RegExp[] = [
  /(^|\n)\s*(首先|接下来|然后|最后)[，,]?\s*(用户|我需要|我得|需要考虑)/,
  /我(需要|得)(先)?(考虑|分析|想).*用户/,
  /system prompt/i,
  /First[,，]?\s+(the\s+)?user/i,
  /I need to (consider|think|analy[sz]e)/i,
];

const POLICY_DUMP_PATTERNS: RegExp[] = [
  /local-first/i,
  /single-owner/i,
  /slow variables/i,
  /identity source/i,
  /PROJECT_CHARTER/,
  /本地优先/,
  /单一所有者/,
  /慢变量/,
  /身份来源/,
  /权限系统/,
  /项目宪章/,
];

const FAKE_EXTERNAL_ACCESS_PATTERNS: RegExp[] = [
  /我(查|搜索|看了).*(网上|网络|网页|外卖|地图|天气)/,
  /根据(你|您的)?(位置|定位|附近)/,
  /实时(天气|新闻|价格|数据)/,
  /I (searched|looked up|checked) (online|the web|the internet)/i,
  /based on your (location|nearby places)/i,
];

export function sanitizeAssistantContent(
  rawContent: string,
): AssistantContentSanitization {
  let content = rawContent.replace(/\r\n/g, "\n").trim();
  let removedThinkingArtifacts = false;

  THINKING_BLOCK_PATTERN.lastIndex = 0;
  if (THINKING_BLOCK_PATTERN.test(content)) {
    removedThinkingArtifacts = true;
    THINKING_BLOCK_PATTERN.lastIndex = 0;
    content = content.replace(THINKING_BLOCK_PATTERN, "\n").trim();
  }

  const lower = content.toLowerCase();
  const closingTagIndex = lower.lastIndexOf(CLOSING_THINK_TAG);

  if (closingTagIndex >= 0) {
    removedThinkingArtifacts = true;
    content = content.slice(closingTagIndex + CLOSING_THINK_TAG.length).trim();
  }

  const openingTagMatch = content.match(/<think\b[^>]*>/i);

  if (openingTagMatch?.index !== undefined) {
    removedThinkingArtifacts = true;
    content = content.slice(0, openingTagMatch.index).trim();
  }

  const finalParagraph = extractFinalParagraphAfterInternalAnalysis(content);

  if (finalParagraph !== null) {
    removedThinkingArtifacts = true;
    content = finalParagraph;
  }

  return { content, removedThinkingArtifacts };
}

export function hasUnsafeThinkingLeak(content: string): boolean {
  return THINKING_TAG_PATTERN.test(content) || hasInternalAnalysisLeak(content);
}

export function hasInternalAnalysisLeak(content: string): boolean {
  return INTERNAL_ANALYSIS_PATTERNS.some((pattern) => pattern.test(content));
}

export function evaluateDailyChatResponse(
  rawContent: string,
  options: { maxCharacters?: number } = {},
): DailyChatQualityResult {
  const maxAllowedCharacters =
    options.maxCharacters ?? DAILY_CHAT_MAX_RESPONSE_CHARACTERS;
  const sanitized = sanitizeAssistantContent(rawContent);
  const issueCodes: AssistantResponseIssueCode[] = [];

  if (sanitized.content.trim().length === 0) {
    issueCodes.push("empty_content");
  }

  if (THINKING_TAG_PATTERN.test(sanitized.content)) {
    issueCodes.push("thinking_tag");
  }

  if (hasInternalAnalysisLeak(sanitized.content)) {
    issueCodes.push("internal_analysis");
  }

  if (hasPolicyDump(sanitized.content)) {
    issueCodes.push("policy_dump");
  }

  if (hasFakeExternalAccess(sanitized.content)) {
    issueCodes.push("fake_external_access");
  }

  if (sanitized.content.length > maxAllowedCharacters) {
    issueCodes.push("excessive_length");
  }

  return {
    passed: issueCodes.length === 0,
    issueCodes,
    sanitizedContent: sanitized.content,
    contentLength: sanitized.content.length,
    removedThinkingArtifacts: sanitized.removedThinkingArtifacts,
    maxAllowedCharacters,
  };
}

export function runDailyChatEvaluation(
  cases: readonly DailyChatEvaluationCase[] = DAILY_CHAT_EVALUATION_CASES,
): DailyChatEvaluationReport {
  const caseResults = cases.map((testCase) => {
    const quality = evaluateDailyChatResponse(testCase.response);
    const expectedIssueCodes = testCase.expectedIssueCodes ?? [];
    const expectedIssuesMatched = sameIssueCodes(
      quality.issueCodes,
      expectedIssueCodes,
    );
    const passed =
      quality.passed === testCase.expectedPassed && expectedIssuesMatched;

    return {
      id: testCase.id,
      expectedPassed: testCase.expectedPassed,
      actualPassed: quality.passed,
      passed,
      issueCodes: quality.issueCodes,
      contentLength: quality.contentLength,
      removedThinkingArtifacts: quality.removedThinkingArtifacts,
    };
  });
  const passed = caseResults.filter((result) => result.passed).length;
  const failed = caseResults.length - passed;

  return {
    mode: "daily-chat-eval",
    status: failed === 0 ? "passed" : "failed",
    total: caseResults.length,
    passed,
    failed,
    providerCallCount: 0,
    externalProviderCallCount: 0,
    realDataRead: false,
    fullTextIncluded: false,
    cases: caseResults,
  };
}

export function formatDailyChatEvaluationReport(
  report: DailyChatEvaluationReport,
): string {
  return [
    "RIN daily chat evaluation.",
    "Mode: fixture-only, provider-free, report-only.",
    `Status: ${report.status}`,
    `Total: ${report.total}`,
    `Passed: ${report.passed}`,
    `Failed: ${report.failed}`,
    `providerCallCount: ${report.providerCallCount}`,
    `External provider calls: ${report.externalProviderCallCount}`,
    `Real .rin-data read: ${report.realDataRead ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Cases:",
    ...report.cases.map(
      (result) =>
        `- ${result.id} passed=${result.passed ? "yes" : "no"} expected=${result.expectedPassed ? "clean" : "blocked"} actual=${result.actualPassed ? "clean" : "blocked"} issues=${formatIssueCodes(result.issueCodes)} length=${result.contentLength} thinking_removed=${result.removedThinkingArtifacts ? "yes" : "no"}`,
    ),
  ].join("\n");
}

function hasPolicyDump(content: string): boolean {
  return POLICY_DUMP_PATTERNS.some((pattern) => pattern.test(content));
}

function hasFakeExternalAccess(content: string): boolean {
  return FAKE_EXTERNAL_ACCESS_PATTERNS.some((pattern) => pattern.test(content));
}

function extractFinalParagraphAfterInternalAnalysis(content: string): string | null {
  if (!hasInternalAnalysisLeak(content)) {
    return null;
  }

  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  if (paragraphs.length < 2) {
    return null;
  }

  for (let index = paragraphs.length - 1; index > 0; index -= 1) {
    const paragraph = paragraphs[index];

    if (!hasInternalAnalysisLeak(paragraph) && !THINKING_TAG_PATTERN.test(paragraph)) {
      return paragraph;
    }
  }

  return null;
}

function sameIssueCodes(
  left: readonly AssistantResponseIssueCode[],
  right: readonly AssistantResponseIssueCode[],
): boolean {
  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();

  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((item, index) => item === normalizedRight[index])
  );
}

function formatIssueCodes(issueCodes: readonly AssistantResponseIssueCode[]): string {
  return issueCodes.length === 0 ? "none" : issueCodes.join(",");
}

const DAILY_CHAT_EVALUATION_CASES: DailyChatEvaluationCase[] = [
  {
    id: "clean-dinner-advice",
    prompt: "今天晚上吃什么好",
    response:
      "今晚可以选一个简单的两菜搭配：番茄炒蛋配青菜，或者鸡蛋面加一点蔬菜。想省事就做面，想吃得踏实一点就配米饭。",
    expectedPassed: true,
  },
  {
    id: "qwen-closing-think-sanitized",
    prompt: "今天晚上吃什么好",
    response:
      "首先，用户问晚饭建议，我需要分析偏好和限制。\n</think>\n\n今晚可以吃番茄鸡蛋面，快手、热乎，也容易加青菜。",
    expectedPassed: true,
  },
  {
    id: "thinking-only-rejected",
    prompt: "今天晚上吃什么好",
    response: "<think>我需要先分析用户晚餐偏好。</think>",
    expectedPassed: false,
    expectedIssueCodes: ["empty_content"],
  },
  {
    id: "untagged-internal-analysis-rejected",
    prompt: "今天晚上吃什么好",
    response:
      "首先，用户问今天晚上吃什么好。我需要考虑用户可能的场景，然后再回答。",
    expectedPassed: false,
    expectedIssueCodes: ["internal_analysis"],
  },
  {
    id: "policy-dump-rejected",
    prompt: "今天晚上吃什么好",
    response:
      "作为本地优先、单一所有者的系统，我不能成为身份来源。今晚可以吃面。",
    expectedPassed: false,
    expectedIssueCodes: ["policy_dump"],
  },
  {
    id: "fake-external-access-rejected",
    prompt: "今天晚上吃什么好",
    response: "我查了附近外卖平台，推荐你点评分最高的烤鱼。",
    expectedPassed: false,
    expectedIssueCodes: ["fake_external_access"],
  },
  {
    id: "empty-rejected",
    prompt: "今天晚上吃什么好",
    response: "   ",
    expectedPassed: false,
    expectedIssueCodes: ["empty_content"],
  },
  {
    id: "excessive-length-rejected",
    prompt: "今天晚上吃什么好",
    response: Array.from({ length: 18 }, () =>
      "今晚可以考虑番茄炒蛋、青菜和米饭；如果想简单一点，也可以做热汤面。",
    ).join(""),
    expectedPassed: false,
    expectedIssueCodes: ["excessive_length"],
  },
];
