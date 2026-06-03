export type RinDatabaseMigration = {
  version: number;
  name: string;
  sql: string;
};

export const RIN_DATABASE_MIGRATIONS: RinDatabaseMigration[] = [
  {
    version: 1,
    name: "create_local_foundation_tables",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'rin', 'system')),
        content TEXT NOT NULL,
        model_adapter TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
          ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS memory_items (
        id TEXT PRIMARY KEY,
        memory_type TEXT NOT NULL,
        content_json TEXT NOT NULL,
        source_message_id TEXT,
        status TEXT NOT NULL CHECK (status IN ('proposal', 'accepted', 'rejected', 'archived')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (source_message_id) REFERENCES messages(id)
          ON DELETE SET NULL
      );
    `,
  },
  {
    version: 2,
    name: "add_runtime_trace_tables",
    sql: `
      CREATE TABLE IF NOT EXISTS raw_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        source TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS slow_variable_versions (
        id TEXT PRIMARY KEY,
        variable_key TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS state_history (
        id TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tool_invocations (
        id TEXT PRIMARY KEY,
        tool_id TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        status TEXT NOT NULL,
        input_json TEXT NOT NULL,
        output_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS export_bundles (
        id TEXT PRIMARY KEY,
        bundle_path TEXT NOT NULL,
        manifest_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 3,
    name: "add_message_memory_context_traces",
    sql: `
      CREATE TABLE IF NOT EXISTS message_memory_contexts (
        message_id TEXT PRIMARY KEY,
        trace_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (message_id) REFERENCES messages(id)
          ON DELETE CASCADE
      );
    `,
  },
];
