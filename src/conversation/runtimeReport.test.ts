import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { initializeRinStorage } from "../storage";
import { processOwnerMessage } from "./runtime";
import {
  buildConversationRuntimeReport,
  formatConversationRuntimeReport,
} from "./runtimeReport";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("conversation runtime report", () => {
  it("reports turn status and timing without message text", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });

    await processOwnerMessage(storage.layout, {
      ownerId: defaultEnvironment.ownerId,
      content: "private owner wording for runtime report",
      now: new Date("2026-05-19T00:00:00.000Z"),
    });

    const report = buildConversationRuntimeReport(storage.layout);
    const summary = formatConversationRuntimeReport(report);

    expect(report.status).toBe("ready");
    expect(report.conversationTurns).toBe(1);
    expect(report.turnStatusCounts.completed).toBe(1);
    expect(report.pendingTurnsWithoutReply).toBe(0);
    expect(report.completedTurnsWithoutReply).toBe(0);
    expect(report.responseBeforePersistence).toBe("disabled");
    expect(report.duplicateReplyPrevention).toBe("conversation_turn_id");
    expect(report.providerCallCount).toBe(0);
    expect(report.fullTextIncluded).toBe(false);
    expect(report.timing.events).toBeGreaterThan(0);
    expect(summary).not.toContain("private owner wording");
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-conversation-report-"));
  tempRoots.push(root);
  return root;
}
