# RIN v2 Package 1 Decommission Inventory

Status: Package 1 implementation inventory.

This document records the decommission scope for obsolete general-purpose Agent
complexity in RIN v2. It is the audit trail for removing active
actions/planner/tasks/tools/MCP scaffolds and the L0-L5 runtime permission
hierarchy without weakening retained data-integrity protections.

本文档记录 RIN v2 中退役旧通用 Agent 复杂度的范围。它用于审计 active
actions/planner/tasks/tools/MCP scaffold 与 L0-L5 runtime 权限体系的移除，同时确认
保留的数据完整性保护没有被削弱。

## Inventory Categories

## 清单分类

- Remove: active implementation, tests, CLI commands, npm scripts, or UI/server
  surfaces that implement the obsolete Agent runtime.
- Retain for compatibility: old schema, historical records, import/export names,
  or read-only counts needed so old data can still initialize and inspect safely.
- Frozen dependency: modules outside Package 1 scope that may receive only
  minimal compatibility or compile fixes.
- Historical only: documentation that describes prior v0.x/v1 behavior and is
  not presented as active v2 capability.
- Blocker: any unresolved reference that would keep the old Agent runtime active.

## Removed Active Source

## 已移除的 active source

Actions:

- `src/actions/dryRunRegistry.ts`
- `src/actions/index.ts`
- `src/actions/localActions.test.ts`
- `src/actions/localActions.ts`
- `src/actions/permissions.test.ts`
- `src/actions/permissions.ts`

Planner:

- `src/planner/execution.test.ts`
- `src/planner/execution.ts`
- `src/planner/index.ts`
- `src/planner/planner.test.ts`
- `src/planner/planner.ts`

Tasks:

- `src/tasks/index.ts`
- `src/tasks/taskSystem.test.ts`
- `src/tasks/taskSystem.ts`

Tools and MCP boundary:

- `src/tools/builtin.ts`
- `src/tools/executor.test.ts`
- `src/tools/executor.ts`
- `src/tools/foundation.test.ts`
- `src/tools/foundation.ts`
- `src/tools/index.ts`
- `src/tools/registry.ts`

CLI surfaces:

- `src/cli/actionsAuditReport.ts`
- `src/cli/actionsSmoke.ts`
- `src/cli/mcpBoundarySmoke.ts`
- `src/cli/plannerAuditReport.ts`
- `src/cli/plannerExecutionSmoke.ts`
- `src/cli/plannerSmoke.ts`
- `src/cli/runTool.ts`
- `src/cli/taskAuditReport.ts`
- `src/cli/taskSmoke.ts`
- `src/cli/toolAuditReport.ts`
- `src/cli/toolRegistrySmoke.ts`

Npm scripts removed from `package.json`:

- `rin:planner-smoke`
- `rin:planner-execution-smoke`
- `rin:planner-audit-report`
- `rin:actions-smoke`
- `rin:actions-audit-report`
- `rin:tool`
- `rin:tool-registry-smoke`
- `rin:mcp-boundary-smoke`
- `rin:tool-audit-report`
- `rin:task-smoke`
- `rin:task-audit-report`

Aggregate script changes:

- `rin:full-check` no longer runs Agent/action/planner/task/tool/MCP commands.
- `rin:v0-3-check` no longer runs action audit reporting.
- `rin:v0-5-check` and `rin:v0-6-check` remain compatibility aliases without
  active tool/MCP/task scripts.

## Runtime and UI Changes

## runtime 与 UI 变更

- `src/server/localConsoleServer.ts` no longer exposes `/api/tools/:id`.
- `src/server/localConsoleSnapshot.ts` no longer imports or registers
  actions/planner/tools, no longer reads generated permission/tool registry
  files, and reports Agent runtime as decommissioned.
- `src/console/types.ts` removes active permissions/tool registry fields and
  replaces planner/permission operational status with inactive Agent runtime
  flags plus a legacy tool invocation count.
- `src/ui/App.tsx` removes registered tools, dry-run actions, planner smoke, and
  auto-execution status from the Console UI. It keeps a read-only legacy tool
  record count.
- `src/storage/coreFiles.ts` stops generating `config/tool_registry.json` and
  `config/permissions.json` for new data directories.
- `src/slowVariables/snapshot.ts` stops snapshotting `config/permissions.json`
  because new v2 data directories no longer generate it.
- `src/policy/runtime.ts` retains model-response data-integrity checks for direct
  memory writes and direct external side-effect requests; it no longer exposes
  Agent risk-level helpers.
- `src/runtime/index.ts` documents retained data-integrity guards instead of a
  tool permission gateway.

## Retained for Compatibility

## 为兼容保留

- SQLite table `tool_invocations` remains in migrations and schema.
- `DatabaseStatus.counts.toolInvocations` remains so old records can be counted
  and displayed without breaking initialization.
- Old historical tool/action/planner/task audit records are not deleted.
- Existing v1 databases can still open; no destructive migration drops old
  tables or records.
- `Agent State Bundle` naming remains in export/import surfaces for now as
  portability compatibility. This name does not imply active Agent execution in
  v2.
- Historical v0.x/v1 docs remain when they clearly describe prior behavior.

## Frozen Dependencies

## 冻结依赖

Package 1 does not add new features to these areas:

- `src/backup`
- `src/sync`
- `src/reliability`
- `src/body`
- `src/server`
- `src/ui`
- `src/console`

Changes in frozen areas are limited to compile compatibility, read-only status
wording, and removal of dangling references to deleted Agent modules.

## Historical Only

## 仅历史保留

The following documents may still mention old actions, planner, tools, MCP, task
autonomy, or L0-L5 behavior as historical v0.x/v1 material:

- `docs/ACTION_PERMISSION_POLICY.md`
- `docs/LOCAL_PLANNER_POLICY.md`
- `docs/RIN_V0_1_*`
- `docs/RIN_V0_2_*`
- `docs/RIN_V0_3_*`
- `docs/RIN_V0_5_*`
- `docs/RIN_V0_6_*`
- `docs/RIN_V1_*`
- `docs/development/CODEX_DEVICE_HANDOFF_2026-05-22.md`

These documents are not active v2 architecture sources. Current v2 status is
defined by `PROJECT_CHARTER.md`, `ARCHITECTURE.md`, `README.md`,
`docs/RIN_V2_MASTER_PLAN.md`, `docs/RIN_V2_PROGRESS.md`,
`docs/RIN_V2_DECISIONS.md`, and this inventory.

## Blockers

## 阻塞项

No known blockers remain if the Package 1 verification commands pass:

- no active imports from `src/actions`, `src/planner`, `src/tasks`, or
  `src/tools`
- no active `/api/tools/:id` route
- no new `config/tool_registry.json` or `config/permissions.json` generation
- no active L0-L5 helper exports
- no destructive schema migration
- no committed `.rin-data`, `node_modules`, `dist`, logs, local databases,
  tokens, API keys, or Codex authentication/conversation files
