import { inspectRinDatabase, openRinDatabase, type RinDatabase } from "../database";
import type { RinDataLayout } from "../storage";

type TurnStatusCounts = {
  started: number;
  completed: number;
  failed: number;
};

type TimingSummary = {
  events: number;
  latestTotalMs: number | null;
  maxTotalMs: number | null;
};

export type ConversationRuntimeReport = {
  mode: "conversation-runtime-report";
  status: "ready" | "legacy-missing-turn-table";
  schemaVersion: number;
  conversations: number;
  messages: number;
  conversationTurns: number;
  turnStatusCounts: TurnStatusCounts;
  pendingTurnsWithoutReply: number;
  completedTurnsWithoutReply: number;
  timing: TimingSummary;
  responseBeforePersistence: "disabled";
  duplicateReplyPrevention: "conversation_turn_id";
  providerCallCount: 0;
  fullTextIncluded: false;
};

export function buildConversationRuntimeReport(
  layout: RinDataLayout,
): ConversationRuntimeReport {
  const database = openRinDatabase(layout);

  try {
    const status = inspectRinDatabase(layout, database);
    const hasTurnTable = tableExists(database, "conversation_turns");
    const turnStatusCounts = hasTurnTable
      ? readTurnStatusCounts(database)
      : { started: 0, completed: 0, failed: 0 };

    return {
      mode: "conversation-runtime-report",
      status: hasTurnTable ? "ready" : "legacy-missing-turn-table",
      schemaVersion: status.schemaVersion,
      conversations: status.counts.conversations,
      messages: status.counts.messages,
      conversationTurns: hasTurnTable ? status.counts.conversationTurns : 0,
      turnStatusCounts,
      pendingTurnsWithoutReply: hasTurnTable
        ? countTurnsWithoutReply(database, "started")
        : 0,
      completedTurnsWithoutReply: hasTurnTable
        ? countTurnsWithoutReply(database, "completed")
        : 0,
      timing: readTimingSummary(database),
      responseBeforePersistence: "disabled",
      duplicateReplyPrevention: "conversation_turn_id",
      providerCallCount: 0,
      fullTextIncluded: false,
    };
  } finally {
    database.close();
  }
}

export function formatConversationRuntimeReport(
  report: ConversationRuntimeReport,
): string {
  return [
    "RIN conversation runtime report.",
    "Mode: conversation-runtime-report",
    `Status: ${report.status}`,
    `Schema version: ${report.schemaVersion}`,
    `Conversations: ${report.conversations}`,
    `Messages: ${report.messages}`,
    `Conversation turns: ${report.conversationTurns}`,
    `Started turns: ${report.turnStatusCounts.started}`,
    `Completed turns: ${report.turnStatusCounts.completed}`,
    `Failed turns: ${report.turnStatusCounts.failed}`,
    `Pending turns without reply: ${report.pendingTurnsWithoutReply}`,
    `Completed turns without reply: ${report.completedTurnsWithoutReply}`,
    `Timing events: ${report.timing.events}`,
    `Latest total ms: ${report.timing.latestTotalMs ?? "none"}`,
    `Max total ms: ${report.timing.maxTotalMs ?? "none"}`,
    `Response before persistence: ${report.responseBeforePersistence}`,
    `Duplicate reply prevention: ${report.duplicateReplyPrevention}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
  ].join("\n");
}

function readTurnStatusCounts(database: RinDatabase): TurnStatusCounts {
  const rows = database
    .prepare(
      `
        SELECT status, COUNT(*) AS count
        FROM conversation_turns
        GROUP BY status
      `,
    )
    .all() as Array<{ status: keyof TurnStatusCounts; count: number }>;
  const counts: TurnStatusCounts = { started: 0, completed: 0, failed: 0 };

  for (const row of rows) {
    counts[row.status] = Number(row.count);
  }

  return counts;
}

function countTurnsWithoutReply(
  database: RinDatabase,
  status: "started" | "completed",
): number {
  const row = database
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM conversation_turns
        WHERE status = ? AND rin_message_id IS NULL
      `,
    )
    .get(status) as { count: number };

  return Number(row.count);
}

function readTimingSummary(database: RinDatabase): TimingSummary {
  const rows = database
    .prepare(
      `
        SELECT payload_json
        FROM audit_events
        WHERE event_type IN ('conversation.turn_completed', 'conversation.turn_failed')
        ORDER BY created_at ASC
      `,
    )
    .all() as Array<{ payload_json: string }>;
  const totals = rows
    .map((row) => readTotalTimingMs(row.payload_json))
    .filter((value): value is number => value !== null);

  return {
    events: totals.length,
    latestTotalMs: totals.at(-1) ?? null,
    maxTotalMs: totals.length > 0 ? Math.max(...totals) : null,
  };
}

function readTotalTimingMs(payloadJson: string): number | null {
  try {
    const payload = JSON.parse(payloadJson) as {
      timingMs?: { totalMs?: unknown };
    };
    const totalMs = payload.timingMs?.totalMs;
    return typeof totalMs === "number" && Number.isFinite(totalMs)
      ? totalMs
      : null;
  } catch {
    return null;
  }
}

function tableExists(database: RinDatabase, tableName: string): boolean {
  return (
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName) !== undefined
  );
}
