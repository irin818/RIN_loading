# RIN v0.2 Release Notes

Status: v0.2-D stabilization document.

## Highlights

- Encrypted local backup archives with `scrypt` key derivation and
  `aes-256-gcm` encryption.
- Guarded restore dry-run and restore apply, including target conflict refusal,
  explicit confirmation, and manifest path rewriting for the target device.
- Permission-gated local action envelope for safe project status reads, safe
  file listing, package/docs metadata reads, and local draft note/report writes.
- Non-mutating local action preview for input and path validation before planner
  execution.
- Owner-confirmed finite planner execution smoke for low-risk local actions.
- Planner, action, backup, restore, memory, semantic, and readiness checks are
  covered by the v0.2 aggregate gate.

## Standard Verification

```sh
npm run rin:v0-2-check
```

`rin:v0-2-check` currently runs `rin:full-check`, including typecheck, tests,
lint, build, readiness, memory and semantic reports, planner/action smoke
checks, backup dry-run, encrypted backup smoke, and restore dry-run.

## Safety Boundaries

- No live model call is enabled by default.
- No external API is required for verification.
- No provider call, cloud sync, background autonomous loop, or memory mutation is
  introduced by the v0.2 planner/action/backup checks.
- Restore apply requires `RIN_RESTORE_APPLY_EMPTY_TARGET` and refuses target
  conflicts.
- Planner execution requires `RIN_PLANNER_EXECUTE_LOW_RISK_ACTIONS` and still
  blocks destructive, external, secret-path, overwrite, and out-of-workspace
  actions.

## Known Limitations

- No multi-device cloud sync is implemented.
- No default live local model is enabled.
- Semantic retrieval remains report-only and disabled by default.
- The planner is still a bounded smoke scaffold, not an autonomous agent loop.
- High-risk actions remain forbidden.
- Real Cubism `.moc3` model loading is not implemented.

## Tagging

After final verification on `main`, `v0.2.0` is the suggested tag name. Do not
create the tag until the owner explicitly approves tagging.
