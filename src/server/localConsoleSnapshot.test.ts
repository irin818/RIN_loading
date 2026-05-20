import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { initializeRinStorage } from "../storage";
import { readLocalConsoleSnapshot } from "./localConsoleSnapshot";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("readLocalConsoleSnapshot", () => {
  it("summarizes initialized local data while keeping high-risk features disabled", async () => {
    const cwd = await createTempRoot();
    await initializeRinStorage(defaultEnvironment, {
      cwd,
      now: () => new Date("2026-05-19T00:00:00.000Z"),
    });

    const snapshot = await readLocalConsoleSnapshot(cwd);

    expect(snapshot.ok).toBe(true);
    expect(snapshot.manifestStatus).toBe("ok");
    expect(snapshot.identity.name).toBe("RIN");
    expect(snapshot.ownerModel.status).toBe("placeholder");
    expect(snapshot.toolRegistry.toolCount).toBe(2);
    expect(snapshot.modelConfig.apiKeysStoredHere).toBe(false);
    expect(
      snapshot.featureGates.find((gate) => gate.key === "chat-runtime")?.enabled,
    ).toBe(true);
    expect(
      snapshot.featureGates.find((gate) => gate.key === "memory-writes")?.enabled,
    ).toBe(true);
    expect(
      snapshot.featureGates.find((gate) => gate.key === "tool-execution")?.enabled,
    ).toBe(true);
    expect(
      snapshot.featureGates.find((gate) => gate.key === "body-shell")?.enabled,
    ).toBe(true);
    expect(
      snapshot.featureGates
        .filter(
          (gate) =>
            ![
              "chat-runtime",
              "memory-writes",
              "tool-execution",
              "body-shell",
            ].includes(gate.key),
        )
        .every((gate) => !gate.enabled),
    ).toBe(true);
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-console-"));
  tempRoots.push(root);
  return root;
}
