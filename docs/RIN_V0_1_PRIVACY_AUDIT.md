# RIN v0.1 Privacy And Safety Audit

Status: Package 5 stabilization document.

## Local-First Boundaries

- RIN data is stored locally under the configured data directory.
- Default model behavior uses the safe local mock adapter.
- Ollama/Qwen3 local calls are optional and explicit.
- External model adapters remain optional and configuration-gated.
- Browser UI does not call model providers directly.

## Memory And Semantic Retrieval

- Accepted memories are slow variables and remain owner-reviewed.
- Deterministic accepted-memory retrieval remains the production baseline.
- Semantic index, live semantic index, and hybrid retrieval reports are disabled
  by default and report-only.
- Semantic trace persistence stores sanitized IDs, counts, modes, statuses, and
  safety flags only.
- Semantic context expansion is disabled by default and requires explicit
  `RIN_SEMANTIC_CONTEXT=candidate-expansion` opt-in.
- Persisted semantic traces do not store full memory text, raw prompts, context
  snippets, or vectors.

## Actions, Planner, And Console

- Memory maintenance is suggestion-only and mutates no memory.
- Action permission scaffolding is dry-run-only in v0.1.
- Unknown, destructive, and external actions are blocked by default.
- Planner smoke runs a finite fixture plan, starts no background loop, and
  executes zero actions.
- Console operational status is read-only and derived from local configuration,
  local counts, and deterministic scaffolds.

## Backup And Continuity

- Backup dry-run creates no archive and performs no cloud sync.
- Restore dry-run copies no files and performs no overwrite.
- Backup dry-run excludes logs, generated folders, dependency folders,
  environment files, and secret-like paths.
- Real bundle export/import remains explicit and separate from dry-run checks.

## Known Limitations

- No encrypted backup archive is implemented in v0.1.
- No multi-device sync is implemented in v0.1.
- No production vector database or persistent embedding store exists.
- No autonomous planner/action execution is enabled.
- Real Cubism `.moc3` loading is still deferred.
