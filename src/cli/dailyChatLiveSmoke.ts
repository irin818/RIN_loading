import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvironment, loadEnvironmentSource } from "../config/loadEnvironment";
import { processOwnerMessage, isConversationError } from "../conversation";
import {
  evaluateDailyChatResponse,
  getActiveModelAdapterId,
  loadModelRuntimeConfig,
  OLLAMA_ADAPTER_ID,
  OLLAMA_DEFAULT_MODEL,
} from "../model";
import { createDataLayout, initializeRinStorage } from "../storage";

type DailyChatLiveSmokeCase = {
  id: string;
  prompt: string;
};

type DailyChatLiveSmokeCaseResult = {
  id: string;
  passed: boolean;
  contentLength: number;
  issueCodes: string[];
  errorCode: string | null;
  thinkingIncluded: boolean;
};

type DailyChatLiveSmokeReport = {
  mode: "daily-chat-live-smoke";
  status: "skipped_not_selected" | "success" | "failed";
  activeAdapter: string;
  provider: "local" | "unknown";
  model: string | null;
  cases: DailyChatLiveSmokeCaseResult[];
  passed: number;
  failed: number;
  localModelCallCount: number;
  externalProviderCallCount: 0;
  realDataRead: false;
  fullTextIncluded: false;
  rawProviderResponseIncluded: false;
  thinkingIncluded: boolean;
};

const DAILY_CHAT_LIVE_CASES: DailyChatLiveSmokeCase[] = [
  { id: "dinner-advice", prompt: "今天晚上吃什么好" },
  { id: "tired-simple-dinner", prompt: "我有点累，晚饭想简单一点，有什么建议？" },
];

const cwd = process.cwd();
const source = loadEnvironmentSource(cwd);
const environment = loadEnvironment(source);
const realLayout = createDataLayout(environment.dataDir, cwd);
const modelConfig = await loadModelRuntimeConfig(realLayout);
const activeAdapter = getActiveModelAdapterId(modelConfig, source);
const model =
  source.RIN_OLLAMA_MODEL ??
  modelConfig.adapters.find((adapter) => adapter.id === OLLAMA_ADAPTER_ID)?.model ??
  OLLAMA_DEFAULT_MODEL;

if (activeAdapter !== OLLAMA_ADAPTER_ID) {
  const report: DailyChatLiveSmokeReport = {
    mode: "daily-chat-live-smoke",
    status: "skipped_not_selected",
    activeAdapter,
    provider: "unknown",
    model,
    cases: [],
    passed: 0,
    failed: 0,
    localModelCallCount: 0,
    externalProviderCallCount: 0,
    realDataRead: false,
    fullTextIncluded: false,
    rawProviderResponseIncluded: false,
    thinkingIncluded: false,
  };

  console.log(formatDailyChatLiveSmokeReport(report));
} else {
  const tempRoot = await mkdtemp(join(tmpdir(), "rin-daily-chat-live-"));

  try {
    const storage = await initializeRinStorage(
      {
        ...environment,
        dataDir: tempRoot,
      },
      { cwd },
    );
    const cases: DailyChatLiveSmokeCaseResult[] = [];

    for (const testCase of DAILY_CHAT_LIVE_CASES) {
      try {
        const turn = await processOwnerMessage(storage.layout, {
          ownerId: environment.ownerId,
          content: testCase.prompt,
        });
        const quality = evaluateDailyChatResponse(turn.rinMessage.content);

        cases.push({
          id: testCase.id,
          passed: quality.passed,
          contentLength: quality.contentLength,
          issueCodes: quality.issueCodes,
          errorCode: null,
          thinkingIncluded:
            quality.issueCodes.includes("thinking_tag") ||
            quality.issueCodes.includes("internal_analysis"),
        });
      } catch (error) {
        cases.push({
          id: testCase.id,
          passed: false,
          contentLength: 0,
          issueCodes: [],
          errorCode: isConversationError(error)
            ? error.payload.code
            : "DAILY_CHAT_LIVE_SMOKE_FAILED",
          thinkingIncluded: isConversationError(error)
            ? error.payload.details.unsafeContentIssue === "internal_analysis"
            : false,
        });
      }
    }

    const passed = cases.filter((item) => item.passed).length;
    const failed = cases.length - passed;
    const report: DailyChatLiveSmokeReport = {
      mode: "daily-chat-live-smoke",
      status: failed === 0 ? "success" : "failed",
      activeAdapter,
      provider: "local",
      model,
      cases,
      passed,
      failed,
      localModelCallCount: cases.length,
      externalProviderCallCount: 0,
      realDataRead: false,
      fullTextIncluded: false,
      rawProviderResponseIncluded: false,
      thinkingIncluded: cases.some((item) => item.thinkingIncluded),
    };

    console.log(formatDailyChatLiveSmokeReport(report));

    if (report.status === "failed") {
      process.exitCode = 1;
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function formatDailyChatLiveSmokeReport(report: DailyChatLiveSmokeReport): string {
  return [
    "RIN daily chat live smoke report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Active adapter: ${report.activeAdapter}`,
    `Provider: ${report.provider}`,
    `Model: ${report.model ?? "none"}`,
    `Passed cases: ${report.passed}`,
    `Failed cases: ${report.failed}`,
    `Local model calls: ${report.localModelCallCount}`,
    `External provider calls: ${report.externalProviderCallCount}`,
    `Real .rin-data read: ${report.realDataRead ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    `Raw provider response included: ${
      report.rawProviderResponseIncluded ? "yes" : "no"
    }`,
    `Thinking included: ${report.thinkingIncluded ? "yes" : "no"}`,
    "Cases:",
    ...formatCases(report.cases),
  ].join("\n");
}

function formatCases(cases: readonly DailyChatLiveSmokeCaseResult[]): string[] {
  if (cases.length === 0) {
    return ["none"];
  }

  return cases.map(
    (item) =>
      `- ${item.id} passed=${item.passed ? "yes" : "no"} length=${item.contentLength} issues=${
        item.issueCodes.length === 0 ? "none" : item.issueCodes.join(",")
      } error=${item.errorCode ?? "none"}`,
  );
}
