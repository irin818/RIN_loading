# Local Planner Policy

Status: v0.2-C policy lock.

The local planner is a finite planning, self-check, and owner-confirmed
execution scaffold. It is not an autonomous background agent and it must not
execute tools or actions without the permission layer.

## Allowed Behavior

- Build deterministic local fixture plans.
- Track plan step IDs, statuses, and safe reason codes.
- Run a bounded self-check loop with a configured maximum step count.
- Produce a report suitable for local smoke checks.
- Stay provider-free by default.
- Run a bounded owner-confirmed execution flow for low-risk local actions.
- Perform permission/dry-run preview, including action input and path
  validation, before execution.
- Require `RIN_PLANNER_EXECUTE_LOW_RISK_ACTIONS` before executing allowed
  low-risk local actions.
- Route execution through the local action envelope so blocked actions are
  audited and high-risk actions cannot bypass policy.
- Write safe planner execution audit summaries.

## Forbidden Behavior

- No infinite or background loops.
- No hidden tool execution.
- No provider or network calls by default.
- No real action execution without explicit confirmation.
- No destructive, external, or high-risk action execution.
- No action execution outside the local action permission envelope.
- No automatic memory mutation.
- No bypassing action permissions.
- No secrets, raw prompts, full memory text, model context snippets, or local
  paths in reports.

## Initial Step Statuses

- `pending`
- `ready`
- `blocked`
- `completed`

The original planner smoke command remains deterministic and dry-run-only.
v0.2-C adds a separate planner execution smoke command that uses temporary
fixture data and explicit confirmation to exercise low-risk local action
execution.

## Commands

```sh
npm run rin:planner-smoke
npm run rin:planner-execution-smoke
npm run rin:planner-audit-report
```

`rin:planner-execution-smoke` uses a temporary workspace, supplies the explicit
test confirmation token, executes only allowed low-risk fixture actions, and
confirms destructive actions remain blocked.

## Chinese Summary

v0.2-C 保留原有 dry-run planner smoke，同时新增 owner-confirmed planner execution
smoke。执行前必须先做 permission/dry-run preview；只有提供
`RIN_PLANNER_EXECUTE_LOW_RISK_ACTIONS` 后，才会通过本地 action envelope 执行低风险
本地动作。未知、高风险、删除、外部网络和越权动作仍会被阻断并记录 audit，不会启动后台循环，
不会调用 provider，也不会自动修改记忆。
