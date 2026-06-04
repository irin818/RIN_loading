import { describe, expect, it } from "vitest";
import {
  createDefaultModelRuntimeConfig,
  getOllamaRuntimeOptions,
  getModelRuntimeStatus,
  normalizeModelRuntimeConfig,
  OLLAMA_DEFAULT_NUM_PREDICT,
  OLLAMA_DEFAULT_TEMPERATURE,
  OLLAMA_DEFAULT_TIMEOUT_MS,
  OLLAMA_DEFAULT_TOP_P,
  OLLAMA_ADAPTER_ID,
  OPENAI_COMPATIBLE_ADAPTER_ID,
} from "./config";
import { MOCK_MODEL_ADAPTER_ID } from "./mockAdapter";

describe("model runtime config", () => {
  it("defaults to the local mock adapter and keeps external calls inactive", () => {
    const config = createDefaultModelRuntimeConfig(
      new Date("2026-05-31T00:00:00.000Z"),
    );
    const status = getModelRuntimeStatus(config, {});

    expect(config.activeAdapter).toBe(MOCK_MODEL_ADAPTER_ID);
    expect(config.apiKeysStoredHere).toBe(false);
    expect(status.activeAdapter).toBe(MOCK_MODEL_ADAPTER_ID);
    expect(status.selectedProvider).toBe("mock");
    expect(status.externalCallsEnabled).toBe(false);
    expect(status.localCallsConfigured).toBe(false);
    expect(status.missingEnvironment).toEqual([]);
  });

  it("accepts environment-only selection for the external adapter", () => {
    const config = createDefaultModelRuntimeConfig(
      new Date("2026-05-31T00:00:00.000Z"),
    );
    const status = getModelRuntimeStatus(config, {
      RIN_MODEL_ADAPTER: OPENAI_COMPATIBLE_ADAPTER_ID,
      RIN_OPENAI_COMPATIBLE_BASE_URL: "https://provider.example/v1",
      RIN_OPENAI_COMPATIBLE_MODEL: "provider-model",
      RIN_OPENAI_COMPATIBLE_API_KEY: "test-key",
    });

    expect(status.activeAdapter).toBe(OPENAI_COMPATIBLE_ADAPTER_ID);
    expect(status.selectedProvider).toBe("openai-compatible");
    expect(status.externalCallsEnabled).toBe(true);
    expect(status.localCallsConfigured).toBe(false);
    expect(status.missingEnvironment).toEqual([]);
  });

  it("accepts environment-only selection for the Ollama local adapter", () => {
    const config = createDefaultModelRuntimeConfig(
      new Date("2026-05-31T00:00:00.000Z"),
    );
    const status = getModelRuntimeStatus(config, {
      RIN_MODEL_ADAPTER: OLLAMA_ADAPTER_ID,
    });

    expect(status.activeAdapter).toBe(OLLAMA_ADAPTER_ID);
    expect(status.selectedProvider).toBe("local");
    expect(status.externalCallsEnabled).toBe(false);
    expect(status.localCallsConfigured).toBe(true);
    expect(status.missingEnvironment).toEqual([]);
  });

  it("reads Ollama runtime control environment with safe defaults", () => {
    const config = createDefaultModelRuntimeConfig(
      new Date("2026-05-31T00:00:00.000Z"),
    );
    const adapter = config.adapters.find((item) => item.id === OLLAMA_ADAPTER_ID);

    expect(adapter).toBeDefined();
    expect(adapter?.timeoutMs).toBe(OLLAMA_DEFAULT_TIMEOUT_MS);
    expect(OLLAMA_DEFAULT_TIMEOUT_MS).toBe(180_000);
    expect(OLLAMA_DEFAULT_NUM_PREDICT).toBe(1024);
    expect(OLLAMA_DEFAULT_TEMPERATURE).toBe(0.5);
    expect(OLLAMA_DEFAULT_TOP_P).toBe(0.9);

    const options = getOllamaRuntimeOptions(adapter!, {
      RIN_OLLAMA_TIMEOUT_MS: "90000",
      RIN_OLLAMA_NUM_PREDICT: "256",
      RIN_OLLAMA_TEMPERATURE: "0.4",
      RIN_OLLAMA_TOP_P: "0.8",
    });

    expect(options.timeoutMs).toBe(90_000);
    expect(options.generationOptions).toEqual({
      numPredict: 256,
      temperature: 0.4,
      topP: 0.8,
    });
    expect(options.invalidEnvironment).toEqual([]);
  });

  it("falls back clearly for invalid Ollama runtime control environment", () => {
    const config = createDefaultModelRuntimeConfig(
      new Date("2026-05-31T00:00:00.000Z"),
    );
    const adapter = config.adapters.find((item) => item.id === OLLAMA_ADAPTER_ID);
    const options = getOllamaRuntimeOptions(adapter!, {
      RIN_OLLAMA_TIMEOUT_MS: "fast",
      RIN_OLLAMA_NUM_PREDICT: "0",
      RIN_OLLAMA_TEMPERATURE: "9",
      RIN_OLLAMA_TOP_P: "-1",
    });

    expect(options.timeoutMs).toBe(OLLAMA_DEFAULT_TIMEOUT_MS);
    expect(options.generationOptions).toEqual({
      numPredict: OLLAMA_DEFAULT_NUM_PREDICT,
      temperature: OLLAMA_DEFAULT_TEMPERATURE,
      topP: OLLAMA_DEFAULT_TOP_P,
    });
    expect(options.invalidEnvironment).toEqual([
      "RIN_OLLAMA_TIMEOUT_MS",
      "RIN_OLLAMA_NUM_PREDICT",
      "RIN_OLLAMA_TEMPERATURE",
      "RIN_OLLAMA_TOP_P",
    ]);
  });

  it("normalizes legacy empty model config files without storing keys", () => {
    const config = normalizeModelRuntimeConfig({
      schemaVersion: 1,
      kind: "model_config",
      updatedAt: "2026-05-31T00:00:00.000Z",
      activeAdapter: null,
      adapters: [],
      apiKeysStoredHere: false,
    });

    expect(config.activeAdapter).toBe(MOCK_MODEL_ADAPTER_ID);
    expect(config.adapters.map((adapter) => adapter.id)).toContain(
      OPENAI_COMPATIBLE_ADAPTER_ID,
    );
    expect(config.adapters.map((adapter) => adapter.id)).toContain(OLLAMA_ADAPTER_ID);
    expect(config.apiKeysStoredHere).toBe(false);
  });
});
