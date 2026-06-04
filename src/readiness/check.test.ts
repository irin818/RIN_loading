import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { initializeRinStorage } from "../storage";
import { readRinReadiness } from "./check";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("readRinReadiness", () => {
  it("passes local readiness while external model calls remain optional", async () => {
    const cwd = await createTempRoot();
    await initializeRinStorage(defaultEnvironment, { cwd });
    const report = await readRinReadiness(cwd, {});

    expect(report.ok).toBe(true);
    expect(report.readyForExternalModel).toBe(false);
    expect(report.readyForLocalModel).toBe(false);
    expect(report.readyForLiveModel).toBe(false);
    expect(report.checks.find((check) => check.key === "manifest")?.status).toBe(
      "pass",
    );
    expect(
      report.checks.find((check) => check.key === "live-model")?.status,
    ).toBe("warn");
  });

  it("reports missing provider environment when the external adapter is selected", async () => {
    const cwd = await createTempRoot();
    await initializeRinStorage(defaultEnvironment, { cwd });
    const report = await readRinReadiness(cwd, {
      RIN_MODEL_ADAPTER: "rin-openai-compatible",
    });

    expect(report.ok).toBe(true);
    expect(report.readyForExternalModel).toBe(false);
    expect(report.readyForLocalModel).toBe(false);
    expect(report.readyForLiveModel).toBe(false);
    expect(report.missingEnvironment).toContain("RIN_OPENAI_COMPATIBLE_API_KEY");
  });

  it("reports the Ollama local adapter as ready when the model is present", async () => {
    const cwd = await createTempRoot();
    await initializeRinStorage(defaultEnvironment, { cwd });
    const report = await readRinReadiness(
      cwd,
      {
        RIN_MODEL_ADAPTER: "rin-ollama-local",
        RIN_OLLAMA_BASE_URL: "http://127.0.0.1:11434",
        RIN_OLLAMA_MODEL: "qwen3:4b",
        RIN_OLLAMA_TIMEOUT_MS: "120000",
        RIN_OLLAMA_NUM_PREDICT: "256",
        RIN_OLLAMA_TEMPERATURE: "0.5",
        RIN_OLLAMA_TOP_P: "0.85",
      },
      {
        fetchFn: async () =>
          new Response(
            JSON.stringify({ models: [{ name: "qwen3:4b" }] }),
            { status: 200 },
          ),
      },
    );

    expect(report.ok).toBe(true);
    expect(report.readyForExternalModel).toBe(false);
    expect(report.readyForLocalModel).toBe(true);
    expect(report.readyForLiveModel).toBe(true);
    expect(report.checks.find((check) => check.key === "model-adapter")?.status).toBe(
      "pass",
    );
    const runtimeCheck = report.checks.find(
      (check) => check.key === "ollama-runtime",
    );
    expect(runtimeCheck?.status).toBe("pass");
    expect(runtimeCheck?.english).toContain("timeout=120000ms");
    expect(runtimeCheck?.english).toContain("num_predict=256");
    expect(report.checks.find((check) => check.key === "live-model")?.status).toBe(
      "pass",
    );
  });

  it("warns about invalid Ollama runtime control environment", async () => {
    const cwd = await createTempRoot();
    await initializeRinStorage(defaultEnvironment, { cwd });
    const report = await readRinReadiness(
      cwd,
      {
        RIN_MODEL_ADAPTER: "rin-ollama-local",
        RIN_OLLAMA_TIMEOUT_MS: "fast",
        RIN_OLLAMA_NUM_PREDICT: "0",
        RIN_OLLAMA_TEMPERATURE: "9",
        RIN_OLLAMA_TOP_P: "-1",
      },
      {
        fetchFn: async () =>
          new Response(
            JSON.stringify({ models: [{ name: "qwen3:4b" }] }),
            { status: 200 },
          ),
      },
    );
    const runtimeCheck = report.checks.find(
      (check) => check.key === "ollama-runtime",
    );

    expect(report.ok).toBe(true);
    expect(report.readyForLocalModel).toBe(true);
    expect(runtimeCheck?.status).toBe("warn");
    expect(runtimeCheck?.english).toContain("Invalid RIN_OLLAMA_TIMEOUT_MS");
    expect(runtimeCheck?.english).toContain("num_predict=1024");
  });

  it("reports actionable Ollama guidance when the selected model is missing", async () => {
    const cwd = await createTempRoot();
    await initializeRinStorage(defaultEnvironment, { cwd });
    const report = await readRinReadiness(
      cwd,
      {
        RIN_MODEL_ADAPTER: "rin-ollama-local",
      },
      {
        fetchFn: async () =>
          new Response(JSON.stringify({ models: [] }), { status: 200 }),
      },
    );
    const modelCheck = report.checks.find((check) => check.key === "model-adapter");

    expect(report.ok).toBe(true);
    expect(report.readyForLocalModel).toBe(false);
    expect(modelCheck?.status).toBe("warn");
    expect(modelCheck?.english).toContain("ollama pull qwen3:4b");
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-readiness-"));
  tempRoots.push(root);
  return root;
}
