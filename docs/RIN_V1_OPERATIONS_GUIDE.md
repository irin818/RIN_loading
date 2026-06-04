# RIN v1.0 Operations Guide

Status: local operations guide.

## Daily Local Checks

```sh
npm run rin:readiness
npm run rin:ops-health-report
npm run rin:local-chat-smoke
```

## Full Verification

```sh
npm run rin:v1-check
```

`rin:v1-check` runs the full package chain through v0.9, including typecheck,
tests, lint, build, readiness, memory evaluation, semantic reports, planner and
action reports, backup/restore dry-runs, tool/MCP reports, task reports,
continuity reports, body reports, and reliability reports.

## Recovery Workflow

1. Run `npm run rin:integrity-check`.
2. Run `npm run rin:recovery-smoke`.
3. Run `npm run rin:backup-dry-run`.
4. Use restore apply only with explicit owner intent and a non-conflicting
   target.

No v1.0 operations command automatically repairs, deletes, overwrites, uploads,
or restores local state.

## Local Model Chat Smoke

`npm run rin:local-chat-smoke` skips by default unless
`RIN_MODEL_ADAPTER=rin-ollama-local` is explicitly selected. In local mode it
tests a normal Qwen3 chat path, reports success/failure, content length, error
code, and retryability, but does not print model output, chain-of-thought,
secrets, or raw provider responses.

For local chat, the Ollama adapter sends `think: false` so Qwen3 returns final
assistant text rather than `message.thinking`. If Qwen3 still returns
`MODEL_RESPONSE_INVALID`, use the local launcher defaults
(`RIN_OLLAMA_NUM_PREDICT=1024`, `RIN_OLLAMA_TIMEOUT_MS=180000`), shorten the
prompt, or try a non-reasoning local model if available.
