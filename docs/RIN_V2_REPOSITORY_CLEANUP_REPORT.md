# RIN v2.0 Repository Cleanup Report

Status: Package 8 stabilization report.

Date: 2026-06-06.

## Scope

This report records the repository cleanup state for the RIN v2.0
conversation-centered core. It documents what was removed from active behavior,
what remains for compatibility, and what must stay out of commits.

本报告记录 RIN v2.0 会话核心的仓库清理状态，说明哪些内容已从 active behavior
退役，哪些内容因兼容性保留，以及哪些文件不得提交。

## Active v2 Core

The active v2 core is:

- local-first conversation runtime
- local SQLite persistence
- provider-neutral model adapter boundary
- manual local RIN and Owner profiles
- deterministic accepted-memory retrieval
- Memory V2 schema, reports, evaluations, and legacy migration path
- Context V2 report/evaluation path
- provider-free v2 release gate

当前 active v2 core 包括本地对话 runtime、本地 SQLite 持久化、模型 adapter
边界、手动 profile、确定性记忆检索、Memory V2、Context V2 报告/eval，以及
provider-free 的 v2 release gate。

## Removed From Active v2

The earlier general-purpose Agent runtime direction is decommissioned in active
v2:

- active actions implementation
- active planner implementation
- active task autonomy implementation
- active tools/MCP execution implementation
- active L0-L5 runtime permission hierarchy
- package scripts for removed Agent/action/planner/task/tool runtime commands

The old SQLite compatibility table `tool_invocations` is intentionally retained
for old local data readability.

## Compatibility And Frozen Areas

The following remain in the repository, but they do not expand active v2 scope:

- backup and restore commands: local, explicit, guarded, and non-cloud by
  default
- device/sync reports: report-only or dry-run, no cloud sync
- reliability reports: report-only, no automatic repair
- body/Live2D shell: current body adapter and visual shell only, no real Cubism
  `.moc3` runtime loading
- historical v0.x/v1 documents: audit and migration context only
- v0.x/v1 aggregate check aliases: compatibility gates, not new Agent behavior

以上内容可以保留，但不代表 v2 重新启用通用 Agent、工具执行、planner、task
autonomy 或 L0-L5 权限体系。

## Package 8 Cleanup Actions

- Added `npm run rin:v2-check` as the provider-free v2 release gate.
- Marked stale planner/action/Console policy documents as historical or
  superseded by active v2 behavior.
- Added final v2 reference documents for operations, memory model, context
  policy, release notes, known limitations, and stabilization.
- Updated governance and public docs so the current release gate is
  `rin:v2-check`, not an older v0.x package gate.
- Updated Memory V2 schema report semantics after Package 7 so it no longer
  claims Memory V2 is shadow-only for production retrieval.

## Files That Must Stay Untracked

Do not commit:

- `.rin-data/`
- `node_modules/`
- `dist/`
- `.env` or `.env.*`
- API keys, tokens, credentials, private keys, or certificates
- local SQLite/database files
- logs containing private data
- temporary files and local caches

## Remaining Cleanup Limits

No destructive cleanup was performed. Old local databases, old audit records,
legacy memory records, backup bundles, and owner files must not be deleted by
Package 8.

Historical documents may still describe old behavior in their original version
context. When they mention decommissioned Agent behavior, active v2 docs take
precedence.
