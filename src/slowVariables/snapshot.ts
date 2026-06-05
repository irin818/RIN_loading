import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { appendAuditEvent, type RinDatabase } from "../database";
import type { RinDataLayout } from "../storage";

const SLOW_VARIABLE_FILES = [
  "config/user_model.json",
  "config/ai_identity.json",
  "config/ai_state.json",
  "config/policy_config.json",
  "config/model_config.json",
  "config/rin_profile.json",
  "config/owner_profile.json",
] as const;

export async function snapshotSlowVariables(
  database: RinDatabase,
  layout: RinDataLayout,
  reason: string,
  now: Date,
): Promise<number> {
  let count = 0;

  for (const relativePath of SLOW_VARIABLE_FILES) {
    const snapshot = await readFile(join(layout.rootDir, relativePath), "utf8");
    const id = randomUUID();

    database
      .prepare(
        `
          INSERT INTO slow_variable_versions (
            id,
            variable_key,
            snapshot_json,
            reason,
            created_at
          )
          VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run(id, relativePath, snapshot, reason, now.toISOString());
    count += 1;
  }

  appendAuditEvent(database, {
    eventType: "slow_variables.snapshotted",
    payload: { reason, count },
    now,
  });

  return count;
}
