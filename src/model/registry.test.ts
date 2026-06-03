import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { initializeRinStorage } from "../storage";
import {
  getConfiguredModelAdapter,
  OLLAMA_ADAPTER_ID,
  OPENAI_COMPATIBLE_ADAPTER_ID,
} from "./index";
import { MOCK_MODEL_ADAPTER_ID } from "./mockAdapter";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("getConfiguredModelAdapter", () => {
  it("uses the local mock adapter by default", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const adapter = await getConfiguredModelAdapter(storage.layout, {});

    expect(adapter.id).toBe(MOCK_MODEL_ADAPTER_ID);
    expect(adapter.provider).toBe("mock");
  });

  it("creates the OpenAI-compatible adapter only with explicit environment", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const adapter = await getConfiguredModelAdapter(storage.layout, {
      RIN_MODEL_ADAPTER: OPENAI_COMPATIBLE_ADAPTER_ID,
      RIN_OPENAI_COMPATIBLE_BASE_URL: "https://provider.example/v1",
      RIN_OPENAI_COMPATIBLE_MODEL: "provider-model",
      RIN_OPENAI_COMPATIBLE_API_KEY: "test-key",
    });

    expect(adapter.id).toBe(OPENAI_COMPATIBLE_ADAPTER_ID);
    expect(adapter.provider).toBe("openai-compatible");
  });

  it("creates the Ollama local adapter with explicit environment selection", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const adapter = await getConfiguredModelAdapter(storage.layout, {
      RIN_MODEL_ADAPTER: OLLAMA_ADAPTER_ID,
    });

    expect(adapter.id).toBe(OLLAMA_ADAPTER_ID);
    expect(adapter.provider).toBe("local");
  });

  it("rejects the OpenAI-compatible adapter when secrets are missing", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });

    await expect(
      getConfiguredModelAdapter(storage.layout, {
        RIN_MODEL_ADAPTER: OPENAI_COMPATIBLE_ADAPTER_ID,
        RIN_OPENAI_COMPATIBLE_BASE_URL: "https://provider.example/v1",
        RIN_OPENAI_COMPATIBLE_MODEL: "provider-model",
      }),
    ).rejects.toThrow("RIN_OPENAI_COMPATIBLE_API_KEY");
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-model-registry-"));
  tempRoots.push(root);
  return root;
}
