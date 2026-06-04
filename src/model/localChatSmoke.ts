import { loadEnvironment, loadEnvironmentSource } from "../config/loadEnvironment";
import { createDataLayout } from "../storage";
import {
  getActiveModelAdapterId,
  loadModelRuntimeConfig,
  OLLAMA_ADAPTER_ID,
  type ModelEnvironmentSource,
} from "./config";
import { isModelError } from "./errors";
import { getConfiguredModelAdapter } from "./registry";
import type { ModelAdapter } from "./types";

export type LocalChatSmokeStatus =
  | "skipped_not_selected"
  | "success"
  | "unavailable"
  | "failed";

export type LocalChatSmokeReport = {
  mode: "local-chat-smoke";
  status: LocalChatSmokeStatus;
  adapter: string;
  provider: "local" | "unknown";
  model: string | null;
  localModelCallCount: 0 | 1;
  externalProviderCallCount: 0;
  success: boolean;
  contentLength: number;
  errorCode: string | null;
  retryable: boolean | null;
  fullTextIncluded: false;
  rawProviderResponseIncluded: false;
  thinkingIncluded: false;
};

const LOCAL_CHAT_SMOKE_PROMPT =
  "请用三句话解释 RIN 为什么坚持本地优先、记忆需要主人审查，以及外部 API 为什么只能作为可选后备。不要展开推理，只给最终回答。";

export async function runLocalChatSmoke(options: {
  cwd?: string;
  source?: ModelEnvironmentSource;
  adapter?: ModelAdapter;
  model?: string;
} = {}): Promise<LocalChatSmokeReport> {
  const cwd = options.cwd ?? process.cwd();
  const source = options.source ?? loadEnvironmentSource(cwd);
  const environment = loadEnvironment(source);
  const layout = createDataLayout(environment.dataDir, cwd);
  const config = await loadModelRuntimeConfig(layout);
  const activeAdapter = getActiveModelAdapterId(config, source);
  const model = options.model ?? readOllamaModel(config, source);

  if (activeAdapter !== OLLAMA_ADAPTER_ID && !options.adapter) {
    return {
      mode: "local-chat-smoke",
      status: "skipped_not_selected",
      adapter: activeAdapter,
      provider: "unknown",
      model,
      localModelCallCount: 0,
      externalProviderCallCount: 0,
      success: false,
      contentLength: 0,
      errorCode: null,
      retryable: null,
      fullTextIncluded: false,
      rawProviderResponseIncluded: false,
      thinkingIncluded: false,
    };
  }

  try {
    const adapter = options.adapter ?? (await getConfiguredModelAdapter(layout, source));

    if (adapter.provider !== "local") {
      return {
        mode: "local-chat-smoke",
        status: "skipped_not_selected",
        adapter: adapter.id,
        provider: "unknown",
        model,
        localModelCallCount: 0,
        externalProviderCallCount: 0,
        success: false,
        contentLength: 0,
        errorCode: null,
        retryable: null,
        fullTextIncluded: false,
        rawProviderResponseIncluded: false,
        thinkingIncluded: false,
      };
    }

    const response = await adapter.generate({
      ownerId: environment.ownerId,
      conversationId: "local-chat-smoke",
      messages: [{ role: "owner", content: LOCAL_CHAT_SMOKE_PROMPT }],
    });

    return {
      mode: "local-chat-smoke",
      status: "success",
      adapter: adapter.id,
      provider: "local",
      model,
      localModelCallCount: 1,
      externalProviderCallCount: 0,
      success: true,
      contentLength: response.content.length,
      errorCode: null,
      retryable: null,
      fullTextIncluded: false,
      rawProviderResponseIncluded: false,
      thinkingIncluded: false,
    };
  } catch (error) {
    if (isModelError(error)) {
      const unavailable =
        error.code === "LOCAL_MODEL_UNAVAILABLE" ||
        error.code === "LOCAL_MODEL_MISSING";

      return {
        mode: "local-chat-smoke",
        status: unavailable ? "unavailable" : "failed",
        adapter: error.adapterId,
        provider: "local",
        model: error.details.model ?? model,
        localModelCallCount: 1,
        externalProviderCallCount: 0,
        success: false,
        contentLength: 0,
        errorCode: error.code,
        retryable: error.retryable,
        fullTextIncluded: false,
        rawProviderResponseIncluded: false,
        thinkingIncluded: false,
      };
    }

    return {
      mode: "local-chat-smoke",
      status: "failed",
      adapter: activeAdapter,
      provider: "unknown",
      model,
      localModelCallCount: 0,
      externalProviderCallCount: 0,
      success: false,
      contentLength: 0,
      errorCode: "LOCAL_CHAT_SMOKE_FAILED",
      retryable: true,
      fullTextIncluded: false,
      rawProviderResponseIncluded: false,
      thinkingIncluded: false,
    };
  }
}

export function formatLocalChatSmokeReport(report: LocalChatSmokeReport): string {
  return [
    "RIN local chat smoke report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Adapter: ${report.adapter}`,
    `Provider: ${report.provider}`,
    `Model: ${report.model ?? "none"}`,
    `Success: ${report.success ? "yes" : "no"}`,
    `Content length: ${report.contentLength}`,
    `Error code: ${report.errorCode ?? "none"}`,
    `Retryable: ${report.retryable === null ? "n/a" : report.retryable ? "yes" : "no"}`,
    `Local model calls: ${report.localModelCallCount}`,
    `External provider calls: ${report.externalProviderCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    `Raw provider response included: ${report.rawProviderResponseIncluded ? "yes" : "no"}`,
    `Thinking included: ${report.thinkingIncluded ? "yes" : "no"}`,
  ].join("\n");
}

function readOllamaModel(
  config: Awaited<ReturnType<typeof loadModelRuntimeConfig>>,
  source: ModelEnvironmentSource,
): string | null {
  const adapter = config.adapters.find((item) => item.id === OLLAMA_ADAPTER_ID);
  return source.RIN_OLLAMA_MODEL ?? adapter?.model ?? null;
}
