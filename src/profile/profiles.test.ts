import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { buildModelContext } from "../context";
import type { ModelAdapter, ModelMessage } from "../model";
import { initializeRinStorage } from "../storage";
import { processOwnerMessage } from "../conversation";
import {
  buildProfileContextMessage,
  buildProfileReport,
  formatProfileReport,
  loadProfileContext,
} from "./profiles";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("local profiles", () => {
  it("loads default profile files and formats compact context", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const context = await loadProfileContext(storage.layout);
    const message = buildProfileContextMessage(context);

    expect(context.issues).toEqual([]);
    expect(message?.role).toBe("system");
    expect(message?.content).toContain("Local owner-reviewed profile context");
    expect(message?.content).toContain("Owner display name");
    expect((message?.content.length ?? 0)).toBeLessThanOrEqual(1200);
  });

  it("reports profile summaries without full private text", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    await writeFile(
      join(storage.layout.directories.config, "owner_profile.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          kind: "owner_profile",
          ownerId: defaultEnvironment.ownerId,
          updatedAt: "2026-06-05T00:00:00.000Z",
          displayName: "Private Owner Name",
          communicationPreferences: ["private communication preference"],
          stablePreferences: ["private stable preference"],
          activeProjects: ["private project codename"],
          contextNotes: ["private note that must not appear in reports"],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const report = await buildProfileReport(storage.layout);
    const summary = formatProfileReport(report);

    expect(report.status).toBe("valid");
    expect(report.fullTextIncluded).toBe(false);
    expect(summary).not.toContain("Private Owner Name");
    expect(summary).not.toContain("private stable preference");
    expect(summary).not.toContain("private project codename");
    expect(summary).not.toContain("private note");
  });

  it("detects invalid profile files without throwing away local data", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    await writeFile(
      join(storage.layout.directories.config, "rin_profile.json"),
      `${JSON.stringify({ schemaVersion: 1, kind: "rin_profile" })}\n`,
      "utf8",
    );

    const report = await buildProfileReport(storage.layout);

    expect(report.status).toBe("invalid");
    expect(report.issues.map((issue) => issue.code)).toContain(
      "invalid_displayName",
    );
  });

  it("places profile context after system prompt and before memory context", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const profileContext = buildProfileContextMessage(
      await loadProfileContext(storage.layout),
    );
    const context = buildModelContext(
      [{ role: "owner", content: "hello" }],
      undefined,
      {
        profileContext,
        memories: [{ id: "m1", text: "accepted memory" }],
      },
    );

    expect(context.messages.map((message) => message.role)).toEqual([
      "system",
      "system",
      "system",
      "owner",
    ]);
    expect(context.messages[1]?.content).toContain("Local owner-reviewed profile");
    expect(context.messages[2]?.content).toContain("Relevant accepted owner memories");
    expect(context.stats.profileContextIncluded).toBe(true);
    expect(context.stats.profileContextCharacterCount).toBe(
      profileContext?.content.length,
    );
  });

  it("passes compact profile context to the model adapter", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    let capturedMessages: ModelMessage[] = [];
    const adapter: ModelAdapter = {
      id: "profile-capture",
      displayName: "Profile capture",
      provider: "mock",
      generate: async (request) => {
        capturedMessages = request.messages;
        return {
          content: "profile context captured",
          adapterId: "profile-capture",
          metadata: {
            externalProvider: false,
            memoryWriteRequested: false,
            toolCallRequested: false,
          },
        };
      },
    };

    await processOwnerMessage(
      storage.layout,
      {
        ownerId: defaultEnvironment.ownerId,
        content: "confirm profile context",
        now: new Date("2026-06-05T00:00:00.000Z"),
      },
      { resolveAdapter: async () => adapter },
    );

    expect(
      capturedMessages.some((message) =>
        message.content.includes("Local owner-reviewed profile context"),
      ),
    ).toBe(true);
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-profile-"));
  tempRoots.push(root);
  return root;
}
