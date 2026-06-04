# RIN v1.0 Release Notes

Status: stable local-first Personal Agent OS foundation.

## Highlights

- Local runtime, storage, SQLite persistence, and readiness checks.
- Owner-reviewed memory proposals and accepted-memory retrieval.
- Report-only semantic retrieval evaluation and readiness scaffolds.
- Permission-gated local actions and bounded planner execution smoke checks.
- Project assistant reports, rollback notes, and audit summaries.
- Suggestion-only memory governance reports.
- Default-deny tool/MCP foundation.
- Bounded task system reports.
- Device continuity and sync dry-run foundation.
- Replaceable body/Live2D interface boundary.
- Report-only reliability, recovery, integrity, and ops health checks.

## Standard Verification

```sh
npm run rin:v1-check
npm run rin:full-check
```

## Known Limitations

- The safe local mock adapter remains the default unless local model settings are
  explicitly configured.
- External providers are optional diagnostics/fallback adapters only and are not
  part of default runtime behavior.
- Semantic retrieval production integration remains disabled by default.
- Memory governance reports do not automatically merge, archive, delete, or
  downgrade memory.
- MCP and external-network tools remain disabled by default.
- Task execution is bounded and report-first; no background autonomy is added.
- Sync is dry-run only; no cloud sync or automatic conflict merge is added.
- Real Cubism `.moc3` loading is not implemented.
- Reliability reports do not perform automatic repair or restore apply.
