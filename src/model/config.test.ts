import { describe, expect, it } from "vitest";
import {
  createDefaultModelRuntimeConfig,
  getModelRuntimeStatus,
  normalizeModelRuntimeConfig,
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
    expect(status.missingEnvironment).toEqual([]);
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
    expect(config.apiKeysStoredHere).toBe(false);
  });
});
