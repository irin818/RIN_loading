import type { RinDatabase } from "../database";

export type RollbackNote = {
  area: "actions" | "planner" | "backup" | "restore" | "external-provider";
  eventCount: number;
  note: string;
};

export type RollbackNotesReport = {
  mode: "rollback-notes-report";
  status: "ready";
  notes: RollbackNote[];
  providerCallCount: 0;
  externalNetworkUsed: false;
  dataMutated: false;
  fullTextIncluded: false;
};

const ROLLBACK_AREAS: Array<{
  area: RollbackNote["area"];
  eventPrefixes: string[];
  note: string;
}> = [
  {
    area: "actions",
    eventPrefixes: ["action."],
    note:
      "Review action audit events, remove generated draft reports/notes if needed, and keep destructive or external actions blocked.",
  },
  {
    area: "planner",
    eventPrefixes: ["planner."],
    note:
      "Review planner execution audit events; planner runs should remain finite, owner-confirmed, and provider-free.",
  },
  {
    area: "backup",
    eventPrefixes: ["backup."],
    note:
      "Verify or discard local backup artifacts explicitly; never upload or restore without owner intent.",
  },
  {
    area: "restore",
    eventPrefixes: ["restore."],
    note:
      "Restore apply must target non-conflicting local files only; preserve dry-run conflict reports for review.",
  },
  {
    area: "external-provider",
    eventPrefixes: ["external_model."],
    note:
      "External provider smoke remains diagnostic only; remove provider env vars to return to local defaults.",
  },
];

export function buildRollbackNotesReport(
  database: RinDatabase,
): RollbackNotesReport {
  const eventCounts = countAuditEventsByType(database);

  return {
    mode: "rollback-notes-report",
    status: "ready",
    notes: ROLLBACK_AREAS.map((area) => ({
      area: area.area,
      eventCount: countMatchingEvents(eventCounts, area.eventPrefixes),
      note: area.note,
    })),
    providerCallCount: 0,
    externalNetworkUsed: false,
    dataMutated: false,
    fullTextIncluded: false,
  };
}

export function formatRollbackNotesReport(report: RollbackNotesReport): string {
  return [
    "RIN rollback notes report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `providerCallCount: ${report.providerCallCount}`,
    `External network used: ${report.externalNetworkUsed ? "yes" : "no"}`,
    `Data mutated: ${report.dataMutated ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Rollback notes:",
    ...report.notes.map(
      (note) => `- ${note.area} events=${note.eventCount} note=${note.note}`,
    ),
  ].join("\n");
}

function countAuditEventsByType(database: RinDatabase): Map<string, number> {
  const rows = database
    .prepare(
      `
        SELECT event_type, COUNT(*) AS count
        FROM audit_events
        GROUP BY event_type
      `,
    )
    .all() as { event_type: string; count: number }[];

  return new Map(rows.map((row) => [row.event_type, row.count]));
}

function countMatchingEvents(
  eventCounts: ReadonlyMap<string, number>,
  prefixes: readonly string[],
): number {
  let count = 0;

  for (const [eventType, eventCount] of eventCounts.entries()) {
    if (prefixes.some((prefix) => eventType.startsWith(prefix))) {
      count += eventCount;
    }
  }

  return count;
}
