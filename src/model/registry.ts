import { loadEnvironmentSource } from "../config/loadEnvironment";
import type { RinDataLayout } from "../storage";
import { mockModelAdapter } from "./mockAdapter";
import {
  getActiveModelAdapterId,
  getOpenAiCompatibleRuntimeOptions,
  loadModelRuntimeConfig,
  OPENAI_COMPATIBLE_ADAPTER_ID,
  OPENAI_COMPATIBLE_BASE_URL_ENV,
  OPENAI_COMPATIBLE_MODEL_ENV,
  type ModelEnvironmentSource,
} from "./config";
import { createOpenAiCompatibleAdapter } from "./openAiCompatibleAdapter";
import type { ModelAdapter } from "./types";

const adapters = new Map<string, ModelAdapter>([
  [mockModelAdapter.id, mockModelAdapter],
]);

export function getModelAdapter(adapterId: string): ModelAdapter {
  const adapter = adapters.get(adapterId);

  if (!adapter) {
    throw new Error(`Unknown model adapter: ${adapterId}`);
  }

  return adapter;
}

export function getDefaultModelAdapter(): ModelAdapter {
  return mockModelAdapter;
}

export function listModelAdapters(): ModelAdapter[] {
  return Array.from(adapters.values());
}

export async function getConfiguredModelAdapter(
  layout: RinDataLayout,
  source: ModelEnvironmentSource = loadEnvironmentSource(),
): Promise<ModelAdapter> {
  const config = await loadModelRuntimeConfig(layout);
  const activeAdapterId = getActiveModelAdapterId(config, source);

  if (activeAdapterId === mockModelAdapter.id) {
    return mockModelAdapter;
  }

  const adapterConfig = config.adapters.find(
    (adapter) => adapter.id === activeAdapterId,
  );

  if (!adapterConfig) {
    throw new Error(`Unknown configured model adapter: ${activeAdapterId}`);
  }

  if (adapterConfig.provider !== "openai-compatible") {
    throw new Error(
      `Configured model adapter is not implemented yet: ${activeAdapterId}`,
    );
  }

  if (
    activeAdapterId !== OPENAI_COMPATIBLE_ADAPTER_ID ||
    (!adapterConfig.enabled && source.RIN_MODEL_ADAPTER !== activeAdapterId)
  ) {
    throw new Error(`Configured model adapter is disabled: ${activeAdapterId}`);
  }

  const options = getOpenAiCompatibleRuntimeOptions(adapterConfig, source);
  const missing = [
    options.baseUrl ? null : OPENAI_COMPATIBLE_BASE_URL_ENV,
    options.model ? null : OPENAI_COMPATIBLE_MODEL_ENV,
    options.apiKey ? null : options.apiKeyEnv,
  ].filter((item): item is string => item !== null);

  if (missing.length > 0) {
    throw new Error(
      `Configured model adapter is missing environment: ${missing.join(", ")}`,
    );
  }

  const { baseUrl, model, apiKey } = options;

  if (!baseUrl || !model || !apiKey) {
    throw new Error("Configured model adapter is missing required runtime options.");
  }

  return createOpenAiCompatibleAdapter({
    id: adapterConfig.id,
    displayName: adapterConfig.displayName,
    baseUrl,
    model,
    apiKey,
    timeoutMs: options.timeoutMs,
  });
}
