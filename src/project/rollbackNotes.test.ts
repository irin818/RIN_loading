import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { appendAuditEvent, openRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";
import {
  buildRollbackNotesReport,
  formatRollbackNotesReport,
} from "./rollbackNotes";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("buildRollbackNotesReport", () => {
  it("summarizes rollback guidance from audit event counts only", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);

    try {
      appendAuditEvent(database, {
        eventType: "action.completed",
        payload: { secret: "do-not-print" },
      });
      appendAuditEvent(database, {
        eventType: "planner.execution.blocked",
        payload: { detail: "private planner detail" },
      });
      appendAuditEvent(database, {
        eventType: "backup.encrypted.created",
        payload: { path: "/private/path/backup.rinbackup" },
      });

      const report = buildRollbackNotesReport(database);
      const summary = formatRollbackNotesReport(report);

      expect(report.notes.find((note) => note.area === "actions")?.eventCount).toBe(
        1,
      );
      expect(report.notes.find((note) => note.area === "planner")?.eventCount).toBe(
        1,
      );
      expect(report.notes.find((note) => note.area === "backup")?.eventCount).toBe(
        1,
      );
      expect(report.providerCallCount).toBe(0);
      expect(report.externalNetworkUsed).toBe(false);
      expect(report.dataMutated).toBe(false);
      expect(report.fullTextIncluded).toBe(false);
      expect(summary).not.toContain("do-not-print");
      expect(summary).not.toContain("/private/path");
    } finally {
      database.close();
    }
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-rollback-notes-"));
  tempRoots.push(root);
  return root;
}
