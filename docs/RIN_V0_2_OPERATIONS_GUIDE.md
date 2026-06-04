# RIN v0.2 Operations Guide

Status: v0.2-D stabilization document.

## Standard Checks

Use the aggregate v0.2 gate before release or after package merges:

```sh
npm run rin:v0-2-check
```

For ordinary development, `npm run rin:check` is still the faster baseline.

## Backup And Restore

Safe non-mutating checks:

```sh
npm run rin:backup-dry-run
npm run rin:backup-encrypted-smoke
npm run rin:restore-dry-run
```

Manual encrypted archive workflow:

```sh
RIN_BACKUP_PASSPHRASE="local passphrase" npm run rin:backup-create -- /tmp/rin.rinbackup
RIN_BACKUP_PASSPHRASE="local passphrase" npm run rin:backup-verify -- /tmp/rin.rinbackup
RIN_BACKUP_PASSPHRASE="local passphrase" npm run rin:restore-dry-run -- /tmp/rin.rinbackup
RIN_BACKUP_PASSPHRASE="local passphrase" npm run rin:restore-apply -- /tmp/rin.rinbackup RIN_RESTORE_APPLY_EMPTY_TARGET
```

Do not commit or print the real passphrase. Restore apply should be used only
against an intentionally empty target data directory.

## Actions And Planner

```sh
npm run rin:actions-smoke
npm run rin:actions-audit-report
npm run rin:planner-smoke
npm run rin:planner-execution-smoke
npm run rin:planner-audit-report
```

`rin:planner-smoke` remains dry-run-only. `rin:planner-execution-smoke` uses a
temporary workspace, supplies the explicit fixture confirmation token, executes
only allowed low-risk local actions, and confirms destructive actions remain
blocked.

## Memory And Semantic Reports

```sh
npm run rin:memory-eval
npm run rin:memory-maintenance-report
npm run rin:semantic-eval
npm run rin:semantic-readiness
npm run rin:semantic-index-report
npm run rin:semantic-live-index-report
npm run rin:hybrid-retrieval-report
npm run rin:semantic-trace-list
npm run rin:semantic-trace-read
```

Semantic report commands remain report-only and disabled by default unless
explicit owner opt-in is supplied.

## Optional Local Model Readiness

```sh
RIN_MODEL_ADAPTER=rin-ollama-local \
RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434 \
RIN_OLLAMA_MODEL=qwen3:4b \
npm run rin:readiness
```

Qwen3 via Ollama is an optional local model target, not an identity source and
not a default verification requirement.
