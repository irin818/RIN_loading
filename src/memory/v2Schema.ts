import type { RinDatabase } from "../database";

export type MemoryV2TableName =
  | "memory_v2_trace_sources"
  | "memory_v2_traces"
  | "memory_v2_trace_signals"
  | "memory_v2_retrieval_events";

export type MemoryV2TableStatus = {
  name: MemoryV2TableName;
  exists: boolean;
  rowCount: number;
};

export type MemoryV2SchemaReport = {
  mode: "memory-v2-schema-report";
  status: "ready" | "missing_tables";
  migrationVersion: 6;
  shadowOnly: true;
  productionRetrievalChanged: false;
  providerCallCount: 0;
  fullTextIncluded: false;
  tables: MemoryV2TableStatus[];
};

export const MEMORY_V2_TABLES: MemoryV2TableName[] = [
  "memory_v2_trace_sources",
  "memory_v2_traces",
  "memory_v2_trace_signals",
  "memory_v2_retrieval_events",
];

export function buildMemoryV2SchemaReport(
  database: RinDatabase,
): MemoryV2SchemaReport {
  const tables = MEMORY_V2_TABLES.map((name) => ({
    name,
    exists: tableExists(database, name),
    rowCount: tableExists(database, name) ? countRows(database, name) : 0,
  }));

  return {
    mode: "memory-v2-schema-report",
    status: tables.every((table) => table.exists) ? "ready" : "missing_tables",
    migrationVersion: 6,
    shadowOnly: true,
    productionRetrievalChanged: false,
    providerCallCount: 0,
    fullTextIncluded: false,
    tables,
  };
}

export function formatMemoryV2SchemaReport(
  report: MemoryV2SchemaReport,
): string {
  return [
    "RIN Memory V2 schema report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Migration version: ${report.migrationVersion}`,
    `Shadow only: ${report.shadowOnly ? "yes" : "no"}`,
    `Production retrieval changed: ${
      report.productionRetrievalChanged ? "yes" : "no"
    }`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Tables:",
    ...report.tables.map(
      (table) =>
        `- ${table.name} exists=${table.exists ? "yes" : "no"} rows=${
          table.rowCount
        }`,
    ),
  ].join("\n");
}

function tableExists(database: RinDatabase, tableName: string): boolean {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);

  return row !== undefined;
}

function countRows(database: RinDatabase, tableName: string): number {
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get();
  return Number((row as { count: number }).count);
}
