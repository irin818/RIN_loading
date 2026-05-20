import { randomUUID } from "node:crypto";
import type { RinDatabase } from "./connection";

export type AuditEventInput = {
  eventType: string;
  payload: Record<string, unknown>;
  now?: Date;
};

export function appendAuditEvent(
  database: RinDatabase,
  input: AuditEventInput,
): string {
  const id = randomUUID();
  const createdAt = (input.now ?? new Date()).toISOString();

  database
    .prepare(
      `
        INSERT INTO audit_events (id, event_type, payload_json, created_at)
        VALUES (?, ?, ?, ?)
      `,
    )
    .run(id, input.eventType, JSON.stringify(input.payload), createdAt);

  return id;
}
