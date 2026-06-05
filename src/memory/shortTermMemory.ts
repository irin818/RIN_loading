import type { RinDatabase } from "../database";

export type ShortTermMemoryRoleCounts = {
  owner: number;
  rin: number;
  system: number;
};

export type ShortTermMemoryMessageRef = {
  messageId: string;
  conversationId: string;
  role: "owner" | "rin" | "system";
  createdAt: string;
  contentCharacterCount: number;
  modelAdapterPresent: boolean;
};

export type ShortTermMemoryReport = {
  mode: "short-term-memory-report";
  status: "ready";
  sourceOfTruth: "raw_conversation_messages";
  windowHours: 5;
  windowStartedAt: string;
  windowEndedAt: string;
  sourceMessageCount: number;
  includedMessageCount: number;
  truncated: boolean;
  conversationCount: number;
  roleCounts: ShortTermMemoryRoleCounts;
  traceSourceCount: number;
  traceCount: number;
  traceSignalCount: number;
  retrievalEventCount: number;
  mutatedMemoryCount: 0;
  providerCallCount: 0;
  productionRetrievalChanged: false;
  fullTextIncluded: false;
  messages: ShortTermMemoryMessageRef[];
};

export type ShortTermMemoryReportOptions = {
  now?: Date;
  limit?: number;
};

type MessageRefRow = {
  id: string;
  conversation_id: string;
  role: "owner" | "rin" | "system";
  created_at: string;
  content_character_count: number;
  model_adapter: string | null;
};

const SHORT_TERM_WINDOW_HOURS = 5;
const DEFAULT_MESSAGE_REF_LIMIT = 50;

export function buildShortTermMemoryReport(
  database: RinDatabase,
  options: ShortTermMemoryReportOptions = {},
): ShortTermMemoryReport {
  const now = options.now ?? new Date();
  const windowStartedAt = new Date(
    now.getTime() - SHORT_TERM_WINDOW_HOURS * 60 * 60 * 1000,
  );
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_MESSAGE_REF_LIMIT, 200));
  const startedAtIso = windowStartedAt.toISOString();
  const endedAtIso = now.toISOString();
  const sourceMessageCount = countWindowMessages(
    database,
    startedAtIso,
    endedAtIso,
  );
  const rows = database
    .prepare(
      `
        SELECT
          id,
          conversation_id,
          role,
          created_at,
          LENGTH(content) AS content_character_count,
          model_adapter
        FROM messages
        WHERE created_at >= ? AND created_at <= ?
        ORDER BY created_at ASC, id ASC
        LIMIT ?
      `,
    )
    .all(startedAtIso, endedAtIso, limit)
    .map((row) => row as MessageRefRow);
  const messages = rows.map(mapMessageRef);

  return {
    mode: "short-term-memory-report",
    status: "ready",
    sourceOfTruth: "raw_conversation_messages",
    windowHours: SHORT_TERM_WINDOW_HOURS,
    windowStartedAt: startedAtIso,
    windowEndedAt: endedAtIso,
    sourceMessageCount,
    includedMessageCount: messages.length,
    truncated: sourceMessageCount > messages.length,
    conversationCount: new Set(
      messages.map((message) => message.conversationId),
    ).size,
    roleCounts: countRoles(messages),
    traceSourceCount: countRowsIfExists(database, "memory_v2_trace_sources"),
    traceCount: countRowsIfExists(database, "memory_v2_traces"),
    traceSignalCount: countRowsIfExists(database, "memory_v2_trace_signals"),
    retrievalEventCount: countRowsIfExists(
      database,
      "memory_v2_retrieval_events",
    ),
    mutatedMemoryCount: 0,
    providerCallCount: 0,
    productionRetrievalChanged: false,
    fullTextIncluded: false,
    messages,
  };
}

export function formatShortTermMemoryReport(
  report: ShortTermMemoryReport,
): string {
  return [
    "RIN short-term memory report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Source of truth: ${report.sourceOfTruth}`,
    `Window hours: ${report.windowHours}`,
    `Window started at: ${report.windowStartedAt}`,
    `Window ended at: ${report.windowEndedAt}`,
    `Source messages: ${report.sourceMessageCount}`,
    `Included messages: ${report.includedMessageCount}`,
    `Truncated: ${report.truncated ? "yes" : "no"}`,
    `Conversations: ${report.conversationCount}`,
    `Role counts: owner=${report.roleCounts.owner} rin=${report.roleCounts.rin} system=${report.roleCounts.system}`,
    `Memory V2 trace sources: ${report.traceSourceCount}`,
    `Memory V2 traces: ${report.traceCount}`,
    `Memory V2 trace signals: ${report.traceSignalCount}`,
    `Memory V2 retrieval events: ${report.retrievalEventCount}`,
    `Mutated memories: ${report.mutatedMemoryCount}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Production retrieval changed: ${
      report.productionRetrievalChanged ? "yes" : "no"
    }`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Message refs:",
    ...formatMessageRefs(report.messages),
  ].join("\n");
}

function mapMessageRef(row: MessageRefRow): ShortTermMemoryMessageRef {
  return {
    messageId: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    createdAt: row.created_at,
    contentCharacterCount: Number(row.content_character_count),
    modelAdapterPresent: row.model_adapter !== null,
  };
}

function countRoles(
  messages: readonly ShortTermMemoryMessageRef[],
): ShortTermMemoryRoleCounts {
  return {
    owner: messages.filter((message) => message.role === "owner").length,
    rin: messages.filter((message) => message.role === "rin").length,
    system: messages.filter((message) => message.role === "system").length,
  };
}

function formatMessageRefs(
  messages: readonly ShortTermMemoryMessageRef[],
): string[] {
  if (messages.length === 0) {
    return ["none"];
  }

  return messages.map(
    (message) =>
      `- ${message.createdAt} ${message.role} message=${message.messageId} conversation=${message.conversationId} chars=${message.contentCharacterCount}`,
  );
}

function countWindowMessages(
  database: RinDatabase,
  windowStartedAt: string,
  windowEndedAt: string,
): number {
  const row = database
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM messages
        WHERE created_at >= ? AND created_at <= ?
      `,
    )
    .get(windowStartedAt, windowEndedAt);
  return Number((row as { count: number }).count);
}

function countRowsIfExists(database: RinDatabase, tableName: string): number {
  const exists = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);

  if (!exists) {
    return 0;
  }

  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get();
  return Number((row as { count: number }).count);
}
