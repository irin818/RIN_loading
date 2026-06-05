# RIN v2.0 Stabilization Notes

Status: active v2.0 stabilization reference.

This document records the final v2.0 stabilization boundary after Packages 0-8.
It is not a new product roadmap.

## Current Release Gate

Use the provider-free v2 release gate:

```sh
npm run rin:v2-check
```

`rin:v2-check` runs the default local check plus v2-specific reports:

- conversation runtime report
- profile validation and report
- Memory V2 schema report
- short-term memory report
- Memory V2 deterministic evaluation
- Memory V2 legacy migration dry-run and status
- Context V2 deterministic evaluation and report
- semantic retrieval evaluation

It does not run `rin:memory-v2-migration-apply`. Applying a legacy-memory
migration to a real local data directory remains an explicit owner action.

## Historical Document Boundary

Historical v0.x/v1 documents remain in `docs/` for audit context and migration
history. They may mention actions, planners, tools/MCP, task autonomy, L0-L5
permissions, or older smoke scripts as historical behavior.

Active RIN v2 behavior is defined by:

- `PROJECT_CHARTER.md`
- `AGENTS.md`
- `DEVELOPMENT_PROTOCOL.md`
- `ARCHITECTURE.md`
- `README.md`
- `docs/RIN_V2_MASTER_PLAN.md`
- `docs/RIN_V2_PROGRESS.md`
- `docs/RIN_V2_DECISIONS.md`
- this stabilization note

Active v2 does not include general-purpose Agent execution, tools/MCP, planner
execution, task autonomy, or an L0-L5 runtime permission hierarchy.

## Release Tag Rule

Create and push `v2.0.0` only after:

- Package 8 is merged to `main`.
- `main` is synchronized with `origin/main`.
- the working tree is clean.
- `npm run rin:v2-check` passes on `main`.
- `npm run rin:check` passes on `main`.
- `npm run rin:v1-check` passes if v1 compatibility is still intentionally
  supported.
- `git diff --check` passes.

Do not tag from a package branch.
