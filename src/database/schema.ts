export const RIN_DATABASE_FILENAME = "rin.sqlite";

export const RIN_DATABASE_SCHEMA_VERSION = 6;

export const RIN_DATABASE_TABLES = [
  "schema_migrations",
  "audit_events",
  "raw_events",
  "conversations",
  "conversation_turns",
  "messages",
  "message_memory_contexts",
  "memory_metadata",
  "memory_items",
  "memory_v2_trace_sources",
  "memory_v2_traces",
  "memory_v2_trace_signals",
  "memory_v2_retrieval_events",
  "slow_variable_versions",
  "state_history",
  "tool_invocations",
  "export_bundles",
] as const;

export type RinDatabaseTableName = (typeof RIN_DATABASE_TABLES)[number];
