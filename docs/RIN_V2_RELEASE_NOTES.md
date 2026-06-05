# RIN v2.0 Release Notes

Status: Package 8 stabilization notes.

Date: 2026-06-06.

## Summary

RIN v2.0 stabilizes the repository around a local-first,
conversation-centered, memory-centered personal AI core. The release narrows the
active architecture away from general-purpose Agent execution and toward safe
local conversation persistence, manually governed profiles, and deterministic
memory/context reporting.

RIN v2.0 将当前仓库收敛为本地优先、以对话和记忆为中心的个人 AI 核心。此版本
不再扩展通用 Agent 执行，而是优先保证本地持久化、手动 profile、记忆与上下文边界。

## Highlights

- Owner messages are persisted before model calls.
- Model generation runs outside long database write transactions.
- Failed model turns preserve the Owner message and do not create fake RIN
  replies.
- Local RIN and Owner profiles are manually editable, schema validated, and not
  model-editable.
- Memory V2 adds trace/source/signal schema, deterministic formation reports,
  short-term memory reporting, and legacy accepted-memory migration.
- Production accepted-memory candidate sourcing uses Memory V2 migrated legacy
  traces once migration is complete, with a legacy fallback until then.
- Context V2 provides report/evaluation coverage for ordering, budget,
  deduplication, provenance, and latest-owner-message preservation.
- `npm run rin:v2-check` is the provider-free release gate.

## Decommissioned Active Behavior

Active v2 does not include:

- general-purpose Agent execution
- active actions/planner/tasks/tools/MCP runtime
- L0-L5 runtime permission hierarchy
- UI-direct provider calls
- API-first core assumptions

Data-integrity protections remain active: schema validation, migration safety,
profile protection, provider abstraction, audit records, and secret/local-data
exclusions.

## Migration Notes

Real local legacy accepted-memory migration is explicit:

```sh
npm run rin:memory-v2-migration-dry-run
npm run rin:memory-v2-migration-status
npm run rin:memory-v2-migration-apply
```

The release gate does not run `rin:memory-v2-migration-apply`. Apply should only
be run intentionally against the chosen local data directory.

## Verification Gate

Use:

```sh
npm run rin:v2-check
```

This gate is deterministic, provider-free by default, and does not require
Ollama or external API credentials.

Optional local Ollama/Qwen3 live checks remain separate and should be run only
when local live model behavior is in scope.
