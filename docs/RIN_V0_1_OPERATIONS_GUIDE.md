# RIN v0.1 Operations Guide

Status: Package 5 stabilization document.

## Standard Checks

Use the aggregate check during ordinary development:

```sh
npm run rin:check
```

Use the full v0.1 smoke suite before release or after package merges:

```sh
npm run rin:full-check
```

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

Default semantic report commands should remain disabled/refused unless explicit
owner opt-in is supplied.

## Planner And Permissions

```sh
npm run rin:planner-smoke
```

The planner smoke command is a deterministic fixture report. A blocked status is
safe and expected when mutation/destructive dry-run actions require confirmation
or are blocked.

## Backup And Restore Dry-Runs

```sh
npm run rin:backup-dry-run
npm run rin:restore-dry-run
```

Backup dry-run reports safe relative file entries and hashes. Restore dry-run
reports validation or missing-manifest status and does not mutate data.

## Optional Local Model Readiness

```sh
RIN_MODEL_ADAPTER=rin-ollama-local \
RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434 \
RIN_OLLAMA_MODEL=qwen3:4b \
npm run rin:readiness
```

Qwen3 via Ollama is an optional local model target, not an identity source.
