# RIN v0.2 Privacy And Safety Audit

Status: v0.2-D stabilization document.

## Local-First Boundaries

- RIN data stays under the configured local data directory.
- Default model behavior uses the safe local mock adapter.
- Ollama/Qwen3 local calls are optional and explicit.
- External model adapters remain optional and configuration-gated.
- Browser UI does not call model providers directly.

## Backup And Restore

- Backup dry-run creates no archive and performs no cloud sync.
- Encrypted backup archive creation is local-only and passphrase-gated.
- Encrypted archives exclude logs, generated folders, dependency folders,
  environment files, and secret-like paths.
- Archive verification decrypts locally and prints summary metadata only.
- Restore dry-run mutates no data.
- Restore apply requires `RIN_RESTORE_APPLY_EMPTY_TARGET`, refuses any target
  conflict, rewrites manifest paths for the target layout, and performs no cloud
  sync.
- `rin:backup-encrypted-smoke` uses temporary directories only and does not
  print its fixture passphrase, full file text, or temp absolute paths.

## Actions And Planner

- Local actions are limited to safe read and draft-write workflows.
- Local action preview validates input and path policy without writes or audit
  events.
- Completed and blocked local action executions are audited with safe summaries.
- Unknown, destructive, external, secret-path, overwrite, and out-of-workspace
  actions are blocked.
- Planner execution is finite, owner-confirmed, previewed before execution, and
  routed through the local action envelope.
- Planner smoke commands start no background loop and call no providers.

## Memory And Semantic Retrieval

- Accepted memories remain owner-reviewed slow variables.
- Deterministic accepted-memory retrieval remains the production baseline.
- Semantic index, live semantic index, and hybrid retrieval reports are disabled
  by default and report-only.
- Semantic traces store sanitized IDs, counts, modes, statuses, and safety flags
  only.
- Memory maintenance remains suggestion-only and mutates no memory.

## Known Limitations

- No cloud sync or multi-device sync is implemented.
- No autonomous background planner loop is implemented.
- No high-risk action execution is enabled.
- No production vector database or persistent embedding store is enabled.
- Real Cubism `.moc3` loading is still deferred.
