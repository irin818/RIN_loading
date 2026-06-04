# RIN v1.0 Operations Guide

Status: local operations guide.

## Daily Local Checks

```sh
npm run rin:readiness
npm run rin:ops-health-report
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
