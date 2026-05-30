import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvironment, loadEnvironmentSource } from "./loadEnvironment";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("loadEnvironment", () => {
  it("loads untracked local .env values while allowing process overrides", async () => {
    const cwd = await createTempRoot();

    await writeFile(
      join(cwd, ".env"),
      [
        "RIN_OWNER_ID=env-owner",
        "RIN_DEVICE_ID='env-device'",
        "RIN_DATA_DIR=.rin-env-data",
        "RIN_MODEL_ADAPTER=rin-openai-compatible",
      ].join("\n"),
      "utf8",
    );

    const source = loadEnvironmentSource(cwd, {
      RIN_DEVICE_ID: "process-device",
    });
    const environment = loadEnvironment(source);

    expect(environment.ownerId).toBe("env-owner");
    expect(environment.deviceId).toBe("process-device");
    expect(environment.dataDir).toBe(".rin-env-data");
    expect(source.RIN_MODEL_ADAPTER).toBe("rin-openai-compatible");
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-env-"));
  tempRoots.push(root);
  return root;
}
