import { mkdir } from "node:fs/promises";
import type { RinDataLayout } from "../storage";
import { appendAuditEvent } from "./audit";
import { databasePathFor, openRinDatabase } from "./connection";
import { RIN_DATABASE_MIGRATIONS } from "./migrations";
import {
  RIN_DATABASE_SCHEMA_VERSION,
  RIN_DATABASE_TABLES,
  type RinDatabaseTableName,
} from "./schema";

export type DatabaseTableStatus = {
  name: RinDatabaseTableName;
  exists: boolean;
  rowCount: number;
};

export type DatabaseStatus = {
  path: string;
  schemaVersion: number;
  appliedMigrations: number[];
  tables: DatabaseTableStatus[];
  counts: {
    auditEvents: number;
    rawEvents: number;
    conversations: number;
    messages: number;
    memoryItems: number;
    messageMemoryContexts: number;
    slowVariableVersions: number;
    stateHistory: number;
    toolInvocations: number;
    exportBundles: number;
  };
};

export async function initializeRinDatabase(
  layout: RinDataLayout,
  now: Date = new Date(),
): Promise<DatabaseStatus> {
  await mkdir(layout.directories.databases, { recursive: true });

  const database = openRinDatabase(layout);

  try {
    ensureMigrationTable(database);

    for (const migration of RIN_DATABASE_MIGRATIONS) {
      const alreadyApplied = database
        .prepare("SELECT version FROM schema_migrations WHERE version = ?")
        .get(migration.version);

      if (!alreadyApplied) {
        database.exec("BEGIN;");
        try {
          database.exec(migration.sql);
          database
            .prepare(
              `
                INSERT INTO schema_migrations (version, name, applied_at)
                VALUES (?, ?, ?)
              `,
            )
            .run(migration.version, migration.name, now.toISOString());
          database.exec("COMMIT;");
        } catch (error) {
          database.exec("ROLLBACK;");
          throw error;
        }
      }
    }

    appendAuditEvent(database, {
      eventType: "database.initialized",
      payload: {
        schemaVersion: RIN_DATABASE_SCHEMA_VERSION,
        databasePath: databasePathFor(layout),
      },
      now,
    });

    return inspectRinDatabase(layout, database);
  } finally {
    database.close();
  }
}

export function inspectRinDatabase(
  layout: RinDataLayout,
  existingDatabase?: ReturnType<typeof openRinDatabase>,
): DatabaseStatus {
  const database = existingDatabase ?? openRinDatabase(layout);

  try {
    ensureMigrationTable(database);
    const appliedMigrations = database
      .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
      .all()
      .map((row) => Number((row as { version: number }).version));
    const tables = RIN_DATABASE_TABLES.map((name) => ({
      name,
      exists: tableExists(database, name),
      rowCount: tableExists(database, name) ? countRows(database, name) : 0,
    }));

    return {
      path: databasePathFor(layout),
      schemaVersion: Math.max(0, ...appliedMigrations),
      appliedMigrations,
      tables,
      counts: {
        auditEvents: countRowsIfExists(database, "audit_events"),
        rawEvents: countRowsIfExists(database, "raw_events"),
        conversations: countRowsIfExists(database, "conversations"),
        messages: countRowsIfExists(database, "messages"),
        messageMemoryContexts: countRowsIfExists(
          database,
          "message_memory_contexts",
        ),
        memoryItems: countRowsIfExists(database, "memory_items"),
        slowVariableVersions: countRowsIfExists(database, "slow_variable_versions"),
        stateHistory: countRowsIfExists(database, "state_history"),
        toolInvocations: countRowsIfExists(database, "tool_invocations"),
        exportBundles: countRowsIfExists(database, "export_bundles"),
      },
    };
  } finally {
    if (!existingDatabase) {
      database.close();
    }
  }
}

function ensureMigrationTable(database: ReturnType<typeof openRinDatabase>): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

function tableExists(
  database: ReturnType<typeof openRinDatabase>,
  tableName: string,
): boolean {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);

  return row !== undefined;
}

function countRows(
  database: ReturnType<typeof openRinDatabase>,
  tableName: string,
): number {
  const row = database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get();
  return Number((row as { count: number }).count);
}

function countRowsIfExists(
  database: ReturnType<typeof openRinDatabase>,
  tableName: string,
): number {
  return tableExists(database, tableName) ? countRows(database, tableName) : 0;
}
