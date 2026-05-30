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
    expect(report.checks.find((check) => check.key === "manifest")?.status).toBe(
      "pass",
    );
    expect(
      report.checks.find((check) => check.key === "external-model")?.status,
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
    expect(report.missingEnvironment).toContain("RIN_OPENAI_COMPATIBLE_API_KEY");
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-readiness-"));
  tempRoots.push(root);
  return root;
}
