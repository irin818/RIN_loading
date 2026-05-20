export const RIN_DATABASE_FILENAME = "rin.sqlite";

export const RIN_DATABASE_SCHEMA_VERSION = 2;

export const RIN_DATABASE_TABLES = [
  "schema_migrations",
  "audit_events",
  "raw_events",
  "conversations",
  "messages",
  "memory_items",
  "slow_variable_versions",
  "state_history",
  "tool_invocations",
  "export_bundles",
] as const;

export type RinDatabaseTableName = (typeof RIN_DATABASE_TABLES)[number];
