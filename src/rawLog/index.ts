import { randomUUID } from "node:crypto";
import type { RinDatabase } from "../database";

export type RawEventInput = {
  eventType: string;
  source: string;
  payload: Record<string, unknown>;
  now?: Date;
};

export function appendRawEvent(
  database: RinDatabase,
  input: RawEventInput,
): string {
  const id = randomUUID();
  const createdAt = (input.now ?? new Date()).toISOString();

  database
    .prepare(
      `
        INSERT INTO raw_events (id, event_type, source, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      id,
      input.eventType,
      input.source,
      JSON.stringify(input.payload),
      createdAt,
    );

  return id;
}
