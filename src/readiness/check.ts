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
  OLLAMA_NUM_PREDICT_ENV,
  OLLAMA_TEMPERATURE_ENV,
  OLLAMA_TIMEOUT_MS_ENV,
  OLLAMA_TOP_P_ENV,
  type OllamaGenerationOptions,
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
  if (ollamaStatus) {
    checks.push({
      key: "ollama-runtime",
      status: ollamaStatus.configurationWarnings.length > 0 ? "warn" : "pass",
      english: readOllamaRuntimeEnglish(ollamaStatus),
      chinese: readOllamaRuntimeChinese(ollamaStatus),
    });
  }
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
  timeoutMs: number | null;
  generationOptions: OllamaGenerationOptions | null;
  invalidEnvironment: string[];
  configurationWarnings: string[];
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
      timeoutMs: null,
      generationOptions: null,
      invalidEnvironment: [],
      configurationWarnings: [],
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
      timeoutMs: runtimeOptions.timeoutMs,
      generationOptions: runtimeOptions.generationOptions,
      invalidEnvironment: runtimeOptions.invalidEnvironment,
      configurationWarnings: readOllamaConfigurationWarnings(runtimeOptions),
      english: `Ollama adapter is missing ${OLLAMA_BASE_URL_ENV} or ${OLLAMA_MODEL_ENV}.`,
      chinese: `Ollama adapter 缺少 ${OLLAMA_BASE_URL_ENV} 或 ${OLLAMA_MODEL_ENV}。`,
    };
  }

  return checkOllamaTags(
    runtimeOptions.baseUrl,
    runtimeOptions.model,
    runtimeOptions.timeoutMs,
    runtimeOptions.generationOptions,
    runtimeOptions.invalidEnvironment,
    readOllamaConfigurationWarnings(runtimeOptions),
    options.fetchFn ?? fetch,
    options.ollamaTimeoutMs ?? 3_000,
  );
}

async function checkOllamaTags(
  baseUrl: string,
  model: string,
  timeoutMs: number,
  generationOptions: OllamaGenerationOptions,
  invalidEnvironment: string[],
  configurationWarnings: string[],
  fetchFn: typeof fetch,
  readinessTimeoutMs: number,
): Promise<OllamaStatus> {
  const endpoint = `${trimTrailingSlash(baseUrl)}/api/tags`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), readinessTimeoutMs);

  try {
    const response = await fetchFn(endpoint, { signal: controller.signal });

    if (!response.ok) {
      return {
        ready: false,
        status: "warn",
        baseUrl,
        model,
        timeoutMs,
        generationOptions,
        invalidEnvironment,
        configurationWarnings,
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
        timeoutMs,
        generationOptions,
        invalidEnvironment,
        configurationWarnings,
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
        timeoutMs,
        generationOptions,
        invalidEnvironment,
        configurationWarnings,
        english: `Ollama is reachable, but ${model} is not pulled. Run: ollama pull ${model}`,
        chinese: `Ollama 可访问，但尚未拉取 ${model}。请运行：ollama pull ${model}`,
      };
    }

    return {
      ready: true,
      status: "pass",
      baseUrl,
      model,
      timeoutMs,
      generationOptions,
      invalidEnvironment,
      configurationWarnings,
      english: `Local Ollama model is available at ${baseUrl}: ${model}. ${formatOllamaSettings(timeoutMs, generationOptions)}`,
      chinese: `本地 Ollama 模型可用：${baseUrl} / ${model}。${formatOllamaSettings(timeoutMs, generationOptions)}`,
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";

    return {
      ready: false,
      status: "warn",
      baseUrl,
      model,
      timeoutMs,
      generationOptions,
      invalidEnvironment,
      configurationWarnings,
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

function readOllamaRuntimeEnglish(status: OllamaStatus): string {
  const base = status.baseUrl ?? "missing base URL";
  const model = status.model ?? "missing model";
  const settings =
    status.timeoutMs && status.generationOptions
      ? formatOllamaSettings(status.timeoutMs, status.generationOptions)
      : "Runtime settings are incomplete.";
  const warnings = status.configurationWarnings.join(" ");

  return warnings.length > 0
    ? `Ollama runtime config: baseUrl=${base}, model=${model}. ${settings} ${warnings}`
    : `Ollama runtime config: baseUrl=${base}, model=${model}. ${settings}`;
}

function readOllamaRuntimeChinese(status: OllamaStatus): string {
  const base = status.baseUrl ?? "缺少 base URL";
  const model = status.model ?? "缺少 model";
  const settings =
    status.timeoutMs && status.generationOptions
      ? formatOllamaSettings(status.timeoutMs, status.generationOptions)
      : "运行设置不完整。";
  const warnings = status.configurationWarnings.join(" ");

  return warnings.length > 0
    ? `Ollama 运行配置：baseUrl=${base}，model=${model}。${settings} ${warnings}`
    : `Ollama 运行配置：baseUrl=${base}，model=${model}。${settings}`;
}

function formatOllamaSettings(
  timeoutMs: number,
  options: OllamaGenerationOptions,
): string {
  return `timeout=${timeoutMs}ms, num_predict=${options.numPredict}, temperature=${options.temperature}, top_p=${options.topP}.`;
}

function readOllamaConfigurationWarnings(options: {
  timeoutMs: number;
  generationOptions: OllamaGenerationOptions;
  invalidEnvironment: string[];
}): string[] {
  const warnings = options.invalidEnvironment.map(
    (envName) =>
      `Invalid ${envName}; using a safe fallback. Check ${OLLAMA_TIMEOUT_MS_ENV}, ${OLLAMA_NUM_PREDICT_ENV}, ${OLLAMA_TEMPERATURE_ENV}, and ${OLLAMA_TOP_P_ENV}.`,
  );

  if (options.timeoutMs < 30_000) {
    warnings.push(
      `${OLLAMA_TIMEOUT_MS_ENV} is below 30000ms and may timeout local generation too aggressively.`,
    );
  }

  if (options.generationOptions.numPredict > 2_048) {
    warnings.push(
      `${OLLAMA_NUM_PREDICT_ENV} is high and may slow local generation.`,
    );
  }

  if (options.generationOptions.temperature > 1.2) {
    warnings.push(
      `${OLLAMA_TEMPERATURE_ENV} is high and may reduce local response stability.`,
    );
  }

  if (options.generationOptions.topP > 0.98) {
    warnings.push(`${OLLAMA_TOP_P_ENV} is high and may broaden sampling.`);
  }

  return warnings;
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
