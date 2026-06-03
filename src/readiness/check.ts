import { readFile } from "node:fs/promises";
import {
  loadEnvironment,
  loadEnvironmentSource,
} from "../config/loadEnvironment";
import type { EnvironmentSource } from "../config/loadEnvironment";
import { inspectRinDatabase } from "../database";
import {
  getModelRuntimeStatus,
  getOllamaRuntimeOptions,
  loadModelRuntimeConfig,
  OLLAMA_ADAPTER_ID,
  OLLAMA_BASE_URL_ENV,
  OLLAMA_MODEL_ENV,
} from "../model";
import {
  createDataLayout,
  inspectCoreStateFiles,
  parseRinDataManifest,
} from "../storage";

export type ReadinessStatus = "pass" | "warn" | "fail";

export type ReadinessCheck = {
  key: string;
  status: ReadinessStatus;
  english: string;
  chinese: string;
};

export type RinReadinessReport = {
  ok: boolean;
  readyForExternalModel: boolean;
  readyForLocalModel: boolean;
  readyForLiveModel: boolean;
  missingEnvironment: string[];
  checks: ReadinessCheck[];
};

export type ReadinessOptions = {
  fetchFn?: typeof fetch;
  ollamaTimeoutMs?: number;
};

export async function readRinReadiness(
  cwd: string = process.cwd(),
  source: EnvironmentSource = loadEnvironmentSource(cwd),
  options: ReadinessOptions = {},
): Promise<RinReadinessReport> {
  const environment = loadEnvironment(source);
  const layout = createDataLayout(environment.dataDir, cwd);
  const checks: ReadinessCheck[] = [];
  const manifestStatus = await readManifestStatus(layout.manifestPath);
  const coreFiles = await inspectCoreStateFiles(layout);
  const databaseStatus = readDatabaseStatus(layout);
  const modelConfig = await loadModelRuntimeConfig(layout);
  const modelStatus = getModelRuntimeStatus(modelConfig, source);
  const ollamaStatus =
    modelStatus.activeAdapter === OLLAMA_ADAPTER_ID
      ? await readOllamaStatus(modelConfig, source, options)
      : null;
  const readyForLocalModel = ollamaStatus?.ready ?? false;
  const readyForLiveModel =
    modelStatus.externalCallsEnabled || readyForLocalModel;

  checks.push({
    key: "manifest",
    status: manifestStatus,
    english: "Local data manifest is present and valid.",
    chinese: "本地数据 manifest 存在且有效。",
  });
  checks.push({
    key: "core-files",
    status: coreFiles.every((file) => file.exists) ? "pass" : "fail",
    english: "Core local config files are present.",
    chinese: "核心本地配置文件存在。",
  });
  checks.push({
    key: "database",
    status: databaseStatus,
    english: "SQLite database is present and inspectable.",
    chinese: "SQLite 数据库存在且可检查。",
  });
  checks.push({
    key: "model-adapter",
    status: readModelAdapterCheckStatus(modelStatus, ollamaStatus),
    english: readModelAdapterCheckEnglish(modelStatus, ollamaStatus),
    chinese: readModelAdapterCheckChinese(modelStatus, ollamaStatus),
  });
  checks.push({
    key: "api-key-storage",
    status: modelStatus.apiKeysStoredHere ? "fail" : "pass",
    english: "API keys are not stored in local core config.",
    chinese: "API Key 未存储在本地核心配置中。",
  });
  checks.push({
    key: "live-model",
    status: readyForLiveModel ? "pass" : "warn",
    english: readLiveModelEnglish(modelStatus, ollamaStatus),
    chinese: readLiveModelChinese(modelStatus, ollamaStatus),
  });

  return {
    ok: checks.every((check) => check.status !== "fail"),
    readyForExternalModel: modelStatus.externalCallsEnabled,
    readyForLocalModel,
    readyForLiveModel,
    missingEnvironment: modelStatus.missingEnvironment,
    checks,
  };
}

async function readManifestStatus(
  manifestPath: string,
): Promise<ReadinessStatus> {
  try {
    parseRinDataManifest(await readFile(manifestPath, "utf8"));
    return "pass";
  } catch {
    return "fail";
  }
}

function readDatabaseStatus(
  layout: ReturnType<typeof createDataLayout>,
): ReadinessStatus {
  try {
    inspectRinDatabase(layout);
    return "pass";
  } catch {
    return "fail";
  }
}

type ModelStatus = ReturnType<typeof getModelRuntimeStatus>;

type OllamaStatus = {
  ready: boolean;
  status: ReadinessStatus;
  baseUrl: string | null;
  model: string | null;
  english: string;
  chinese: string;
};

async function readOllamaStatus(
  modelConfig: Awaited<ReturnType<typeof loadModelRuntimeConfig>>,
  source: EnvironmentSource,
  options: ReadinessOptions,
): Promise<OllamaStatus> {
  const adapter = modelConfig.adapters.find(
    (config) => config.id === OLLAMA_ADAPTER_ID,
  );

  if (!adapter) {
    return {
      ready: false,
      status: "warn",
      baseUrl: null,
      model: null,
      english: "Ollama adapter config is missing.",
      chinese: "缺少 Ollama adapter 配置。",
    };
  }

  const runtimeOptions = getOllamaRuntimeOptions(adapter, source);

  if (!runtimeOptions.baseUrl || !runtimeOptions.model) {
    return {
      ready: false,
      status: "warn",
      baseUrl: runtimeOptions.baseUrl,
      model: runtimeOptions.model,
      english: `Ollama adapter is missing ${OLLAMA_BASE_URL_ENV} or ${OLLAMA_MODEL_ENV}.`,
      chinese: `Ollama adapter 缺少 ${OLLAMA_BASE_URL_ENV} 或 ${OLLAMA_MODEL_ENV}。`,
    };
  }

  return checkOllamaTags(
    runtimeOptions.baseUrl,
    runtimeOptions.model,
    options.fetchFn ?? fetch,
    options.ollamaTimeoutMs ?? 3_000,
  );
}

async function checkOllamaTags(
  baseUrl: string,
  model: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<OllamaStatus> {
  const endpoint = `${trimTrailingSlash(baseUrl)}/api/tags`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(endpoint, { signal: controller.signal });

    if (!response.ok) {
      return {
        ready: false,
        status: "warn",
        baseUrl,
        model,
        english: `Ollama local API returned ${response.status}. Run: open -ga Ollama`,
        chinese: `Ollama 本地 API 返回 ${response.status}。请运行：open -ga Ollama`,
      };
    }

    let body: unknown;

    try {
      body = await readJsonResponse(response);
    } catch {
      return {
        ready: false,
        status: "warn",
        baseUrl,
        model,
        english: "Ollama /api/tags response was not valid JSON.",
        chinese: "Ollama /api/tags 响应不是有效 JSON。",
      };
    }

    const modelNames = readOllamaModelNames(body);

    if (!modelNames.includes(model)) {
      return {
        ready: false,
        status: "warn",
        baseUrl,
        model,
        english: `Ollama is reachable, but ${model} is not pulled. Run: ollama pull ${model}`,
        chinese: `Ollama 可访问，但尚未拉取 ${model}。请运行：ollama pull ${model}`,
      };
    }

    return {
      ready: true,
      status: "pass",
      baseUrl,
      model,
      english: `Local Ollama model is available at ${baseUrl}: ${model}.`,
      chinese: `本地 Ollama 模型可用：${baseUrl} / ${model}。`,
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";

    return {
      ready: false,
      status: "warn",
      baseUrl,
      model,
      english: timedOut
        ? `Ollama local API timed out. Run: brew install --cask ollama-app && open -ga Ollama && ollama pull ${model}`
        : `Ollama local API is not reachable. Run: brew install --cask ollama-app && open -ga Ollama && ollama pull ${model}`,
      chinese: timedOut
        ? `Ollama 本地 API 超时。请运行：brew install --cask ollama-app && open -ga Ollama && ollama pull ${model}`
        : `Ollama 本地 API 不可访问。请运行：brew install --cask ollama-app && open -ga Ollama && ollama pull ${model}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.trim().length === 0) {
    return {};
  }

  return JSON.parse(text) as unknown;
}

function readOllamaModelNames(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.models)) {
    return [];
  }

  return value.models
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      return typeof item.name === "string"
        ? item.name
        : typeof item.model === "string"
          ? item.model
          : null;
    })
    .filter((item): item is string => item !== null);
}

function readModelAdapterCheckStatus(
  modelStatus: ModelStatus,
  ollamaStatus: OllamaStatus | null,
): ReadinessStatus {
  if (
    modelStatus.selectedProvider === "openai-compatible" &&
    !modelStatus.externalCallsEnabled
  ) {
    return "warn";
  }

  if (modelStatus.activeAdapter === OLLAMA_ADAPTER_ID) {
    return ollamaStatus?.status ?? "warn";
  }

  return modelStatus.selectedProvider === "unknown" ? "warn" : "pass";
}

function readModelAdapterCheckEnglish(
  modelStatus: ModelStatus,
  ollamaStatus: OllamaStatus | null,
): string {
  if (modelStatus.activeAdapter === OLLAMA_ADAPTER_ID && ollamaStatus) {
    return ollamaStatus.english;
  }

  if (modelStatus.externalCallsEnabled || modelStatus.selectedProvider === "mock") {
    return "Model adapter configuration is runnable.";
  }

  if (modelStatus.selectedProvider === "openai-compatible") {
    return "External expert/fallback model adapter is selected but missing environment variables.";
  }

  return "Configured model adapter is not available.";
}

function readModelAdapterCheckChinese(
  modelStatus: ModelStatus,
  ollamaStatus: OllamaStatus | null,
): string {
  if (modelStatus.activeAdapter === OLLAMA_ADAPTER_ID && ollamaStatus) {
    return ollamaStatus.chinese;
  }

  if (modelStatus.externalCallsEnabled || modelStatus.selectedProvider === "mock") {
    return "模型 adapter 配置可运行。";
  }

  if (modelStatus.selectedProvider === "openai-compatible") {
    return "已选择外部专家/回退模型 adapter，但缺少环境变量。";
  }

  return "已配置的模型 adapter 不可用。";
}

function readLiveModelEnglish(
  modelStatus: ModelStatus,
  ollamaStatus: OllamaStatus | null,
): string {
  if (ollamaStatus?.ready) {
    return `Local model calls are ready through Ollama (${ollamaStatus.model}).`;
  }

  if (modelStatus.externalCallsEnabled) {
    return "Optional external expert/fallback model calls are configured.";
  }

  if (modelStatus.activeAdapter === OLLAMA_ADAPTER_ID && ollamaStatus) {
    return `${ollamaStatus.english} Set RIN_MODEL_ADAPTER=rin-ollama-local, RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434, and RIN_OLLAMA_MODEL=qwen3:4b.`;
  }

  return "Live model calls are not active; the safe local mock adapter remains selected.";
}

function readLiveModelChinese(
  modelStatus: ModelStatus,
  ollamaStatus: OllamaStatus | null,
): string {
  if (ollamaStatus?.ready) {
    return `本地模型调用已通过 Ollama 就绪（${ollamaStatus.model}）。`;
  }

  if (modelStatus.externalCallsEnabled) {
    return "可选外部专家/回退模型调用已配置。";
  }

  if (modelStatus.activeAdapter === OLLAMA_ADAPTER_ID && ollamaStatus) {
    return `${ollamaStatus.chinese} 请设置 RIN_MODEL_ADAPTER=rin-ollama-local、RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434、RIN_OLLAMA_MODEL=qwen3:4b。`;
  }

  return "真实模型调用尚未启用；当前仍选择安全的本地 mock adapter。";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
