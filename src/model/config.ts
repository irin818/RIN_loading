import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RinDataLayout } from "../storage";
import { MOCK_MODEL_ADAPTER_ID, mockModelAdapter } from "./mockAdapter";
import type { ModelAdapter } from "./types";

export const OPENAI_COMPATIBLE_ADAPTER_ID = "rin-openai-compatible";
export const OPENAI_COMPATIBLE_API_KEY_ENV = "RIN_OPENAI_COMPATIBLE_API_KEY";
export const OPENAI_COMPATIBLE_BASE_URL_ENV = "RIN_OPENAI_COMPATIBLE_BASE_URL";
export const OPENAI_COMPATIBLE_MODEL_ENV = "RIN_OPENAI_COMPATIBLE_MODEL";
export const MODEL_ADAPTER_ENV = "RIN_MODEL_ADAPTER";

export type ModelEnvironmentSource = Record<string, string | undefined>;

export type ModelAdapterConfig = {
  id: string;
  displayName: string;
  provider: ModelAdapter["provider"];
  enabled: boolean;
  model: string | null;
  baseUrl: string | null;
  apiKeyEnv: string | null;
  timeoutMs: number;
};

export type ModelRuntimeConfig = {
  schemaVersion: 1;
  kind: "model_config";
  updatedAt: string;
  activeAdapter: string;
  adapters: ModelAdapterConfig[];
  apiKeysStoredHere: boolean;
  note: {
    english: string;
    chinese: string;
  };
};

export type ModelRuntimeStatus = {
  activeAdapter: string;
  selectedProvider: ModelAdapter["provider"] | "unknown";
  adapterCount: number;
  apiKeysStoredHere: boolean;
  externalCallsEnabled: boolean;
  missingEnvironment: string[];
};

const DEFAULT_TIMEOUT_MS = 30_000;

export function createDefaultModelRuntimeConfig(
  now: Date = new Date(),
): ModelRuntimeConfig {
  return {
    schemaVersion: 1,
    kind: "model_config",
    updatedAt: now.toISOString(),
    activeAdapter: MOCK_MODEL_ADAPTER_ID,
    adapters: createDefaultAdapterConfigs(),
    apiKeysStoredHere: false,
    note: {
      english:
        "API keys must stay outside source control. Select external adapters with environment variables or local config only.",
      chinese:
        "API Key 必须留在源码版本控制之外。外部 adapter 只能通过环境变量或本地配置显式选择。",
    },
  };
}

export async function loadModelRuntimeConfig(
  layout: RinDataLayout,
): Promise<ModelRuntimeConfig> {
  const configPath = join(layout.rootDir, "config/model_config.json");

  try {
    return normalizeModelRuntimeConfig(
      JSON.parse(await readFile(configPath, "utf8")) as unknown,
    );
  } catch {
    return createDefaultModelRuntimeConfig();
  }
}

export function normalizeModelRuntimeConfig(
  value: unknown,
): ModelRuntimeConfig {
  const fallback = createDefaultModelRuntimeConfig();

  if (!isRecord(value)) {
    return fallback;
  }

  const adapters = readAdapters(value.adapters);

  return {
    schemaVersion: 1,
    kind: "model_config",
    updatedAt: readString(value.updatedAt) ?? fallback.updatedAt,
    activeAdapter: readString(value.activeAdapter) ?? fallback.activeAdapter,
    adapters,
    apiKeysStoredHere: value.apiKeysStoredHere === true,
    note: readNote(value.note) ?? fallback.note,
  };
}

export function getActiveModelAdapterId(
  config: ModelRuntimeConfig,
  source: ModelEnvironmentSource = process.env,
): string {
  return readString(source[MODEL_ADAPTER_ENV]) ?? config.activeAdapter;
}

export function getModelRuntimeStatus(
  config: ModelRuntimeConfig,
  source: ModelEnvironmentSource = process.env,
): ModelRuntimeStatus {
  const activeAdapter = getActiveModelAdapterId(config, source);
  const selected = config.adapters.find((adapter) => adapter.id === activeAdapter);
  const missingEnvironment =
    selected?.provider === "openai-compatible"
      ? getMissingOpenAiCompatibleEnvironment(selected, source)
      : [];

  return {
    activeAdapter,
    selectedProvider: selected?.provider ?? "unknown",
    adapterCount: config.adapters.length,
    apiKeysStoredHere: config.apiKeysStoredHere,
    externalCallsEnabled:
      selected?.provider === "openai-compatible" &&
      missingEnvironment.length === 0 &&
      (selected.enabled || source[MODEL_ADAPTER_ENV] === selected.id),
    missingEnvironment,
  };
}

export function getOpenAiCompatibleRuntimeOptions(
  adapter: ModelAdapterConfig,
  source: ModelEnvironmentSource = process.env,
): {
  baseUrl: string | null;
  model: string | null;
  apiKey: string | null;
  apiKeyEnv: string;
  timeoutMs: number;
} {
  const apiKeyEnv = adapter.apiKeyEnv ?? OPENAI_COMPATIBLE_API_KEY_ENV;

  return {
    baseUrl: readString(source[OPENAI_COMPATIBLE_BASE_URL_ENV]) ?? adapter.baseUrl,
    model: readString(source[OPENAI_COMPATIBLE_MODEL_ENV]) ?? adapter.model,
    apiKey: readString(source[apiKeyEnv]),
    apiKeyEnv,
    timeoutMs: adapter.timeoutMs,
  };
}

function getMissingOpenAiCompatibleEnvironment(
  adapter: ModelAdapterConfig,
  source: ModelEnvironmentSource,
): string[] {
  const options = getOpenAiCompatibleRuntimeOptions(adapter, source);
  const missing: string[] = [];

  if (!options.baseUrl) {
    missing.push(OPENAI_COMPATIBLE_BASE_URL_ENV);
  }

  if (!options.model) {
    missing.push(OPENAI_COMPATIBLE_MODEL_ENV);
  }

  if (!options.apiKey) {
    missing.push(options.apiKeyEnv);
  }

  return missing;
}

function createDefaultAdapterConfigs(): ModelAdapterConfig[] {
  return [
    {
      id: MOCK_MODEL_ADAPTER_ID,
      displayName: mockModelAdapter.displayName,
      provider: "mock",
      enabled: true,
      model: null,
      baseUrl: null,
      apiKeyEnv: null,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
    {
      id: OPENAI_COMPATIBLE_ADAPTER_ID,
      displayName: "OpenAI-compatible chat completions adapter",
      provider: "openai-compatible",
      enabled: false,
      model: null,
      baseUrl: null,
      apiKeyEnv: OPENAI_COMPATIBLE_API_KEY_ENV,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
  ];
}

function readAdapters(value: unknown): ModelAdapterConfig[] {
  const parsed = Array.isArray(value)
    ? value.map(readAdapter).filter((adapter): adapter is ModelAdapterConfig => adapter !== null)
    : [];
  const byId = new Map<string, ModelAdapterConfig>();

  for (const adapter of [...createDefaultAdapterConfigs(), ...parsed]) {
    byId.set(adapter.id, adapter);
  }

  return Array.from(byId.values());
}

function readAdapter(value: unknown): ModelAdapterConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const provider = readProvider(value.provider);

  if (!id || !provider) {
    return null;
  }

  return {
    id,
    provider,
    displayName: readString(value.displayName) ?? id,
    enabled: value.enabled === true,
    model: readString(value.model),
    baseUrl: readString(value.baseUrl),
    apiKeyEnv: readString(value.apiKeyEnv),
    timeoutMs: readPositiveInteger(value.timeoutMs) ?? DEFAULT_TIMEOUT_MS,
  };
}

function readNote(value: unknown): ModelRuntimeConfig["note"] | null {
  if (!isRecord(value)) {
    return null;
  }

  const english = readString(value.english);
  const chinese = readString(value.chinese);

  return english && chinese ? { english, chinese } : null;
}

function readProvider(value: unknown): ModelAdapter["provider"] | null {
  return value === "mock" ||
    value === "openai-compatible" ||
    value === "local" ||
    value === "custom"
    ? value
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readPositiveInteger(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === "number" && value > 0
    ? value
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
