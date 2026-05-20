import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { appendAuditEvent, type RinDatabase } from "../database";
import type { RinDataLayout } from "../storage";

type AiStateFile = Record<string, unknown>;

export async function updateStateAfterConversation(
  database: RinDatabase,
  layout: RinDataLayout,
  now: Date,
): Promise<AiStateFile> {
  const statePath = join(layout.rootDir, "config/ai_state.json");
  const current = JSON.parse(await readFile(statePath, "utf8")) as AiStateFile;
  const next: AiStateFile = {
    ...current,
    updatedAt: now.toISOString(),
    attention: "active",
    engagement: "medium",
    initiative: "owner-led",
    expression: "attentive",
  };

  await writeFile(statePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  database
    .prepare(
      `
        INSERT INTO state_history (id, state_json, reason, created_at)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(
      randomUUID(),
      JSON.stringify(next),
      "conversation.turn_completed",
      now.toISOString(),
    );

  appendAuditEvent(database, {
    eventType: "state.updated",
    payload: { reason: "conversation.turn_completed" },
    now,
  });

  return next;
}
