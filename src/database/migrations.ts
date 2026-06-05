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
  {
    version: 4,
    name: "add_memory_metadata",
    sql: `
      CREATE TABLE IF NOT EXISTS memory_metadata (
        memory_id TEXT PRIMARY KEY,
        metadata_json TEXT NOT NULL,
        reviewed_at TEXT,
        accepted_at TEXT,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (memory_id) REFERENCES memory_items(id)
          ON DELETE CASCADE
      );
    `,
  },
  {
    version: 5,
    name: "add_conversation_turn_status",
    sql: `
      CREATE TABLE IF NOT EXISTS conversation_turns (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        owner_message_id TEXT NOT NULL UNIQUE,
        rin_message_id TEXT,
        status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
        attempt_count INTEGER NOT NULL DEFAULT 1,
        error_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        failed_at TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
          ON DELETE CASCADE,
        FOREIGN KEY (owner_message_id) REFERENCES messages(id)
          ON DELETE CASCADE,
        FOREIGN KEY (rin_message_id) REFERENCES messages(id)
          ON DELETE SET NULL
      );
    `,
  },
  {
    version: 6,
    name: "add_memory_v2_shadow_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS memory_v2_trace_sources (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL CHECK (
          source_type IN (
            'conversation_message',
            'legacy_memory_item',
            'profile_file',
            'manual'
          )
        ),
        source_table TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_created_at TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (source_type, source_id)
      );

      CREATE TABLE IF NOT EXISTS memory_v2_traces (
        id TEXT PRIMARY KEY,
        source_ref_id TEXT NOT NULL,
        trace_kind TEXT NOT NULL CHECK (
          trace_kind IN (
            'short_term_window',
            'long_term_candidate',
            'reinforcement',
            'decay',
            'retrieval_candidate'
          )
        ),
        status TEXT NOT NULL CHECK (
          status IN ('shadow', 'promoted', 'ignored', 'archived')
        ),
        signal_summary_json TEXT NOT NULL,
        salience_score REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (source_ref_id) REFERENCES memory_v2_trace_sources(id)
          ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS memory_v2_trace_signals (
        id TEXT PRIMARY KEY,
        trace_id TEXT NOT NULL,
        signal_type TEXT NOT NULL CHECK (
          signal_type IN (
            'recency',
            'preference',
            'project',
            'salience',
            'reinforcement',
            'decay',
            'conflict',
            'low_signal'
          )
        ),
        signal_key TEXT NOT NULL,
        signal_weight REAL NOT NULL DEFAULT 0,
        evidence_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (trace_id) REFERENCES memory_v2_traces(id)
          ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS memory_v2_retrieval_events (
        id TEXT PRIMARY KEY,
        query_source_type TEXT NOT NULL CHECK (
          query_source_type IN ('owner_message', 'report', 'manual')
        ),
        query_source_id TEXT,
        window_started_at TEXT NOT NULL,
        window_ended_at TEXT NOT NULL,
        candidate_trace_count INTEGER NOT NULL DEFAULT 0,
        returned_trace_count INTEGER NOT NULL DEFAULT 0,
        retrieval_summary_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memory_v2_sources_source
        ON memory_v2_trace_sources (source_type, source_id);

      CREATE INDEX IF NOT EXISTS idx_memory_v2_traces_source
        ON memory_v2_traces (source_ref_id, trace_kind, status);

      CREATE INDEX IF NOT EXISTS idx_memory_v2_signals_trace
        ON memory_v2_trace_signals (trace_id, signal_type);

      CREATE INDEX IF NOT EXISTS idx_memory_v2_retrieval_window
        ON memory_v2_retrieval_events (window_started_at, window_ended_at);
    `,
  },
];
