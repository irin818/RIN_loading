# RIN v0.1 Release Notes

Status: Package 5 stabilization document.

## Highlights

- Local-first runtime foundation with configurable model adapters.
- Owner-reviewed memory proposals, metadata, deterministic accepted-memory
  retrieval, and memory evaluation reporting.
- Report-only semantic retrieval readiness, accepted-memory semantic index,
  live semantic index, hybrid retrieval report, and sanitized semantic trace
  persistence.
- Explicit opt-in semantic context candidate expansion with deterministic
  retrieval preserved as the baseline.
- Suggestion-only memory maintenance report.
- Dry-run action permission scaffold and finite planner smoke report.
- Read-only Console operational status for model, memory, semantic, planner,
  permissions, and backup readiness.
- Backup and restore dry-run continuity reports.

## Standard Verification

```sh
npm run rin:full-check
```

The full check includes aggregate build/test/lint/readiness, memory and semantic
reports, trace inspection, memory maintenance, planner smoke, and backup/restore
dry-runs.

## Known Limitations

- No default live model call is enabled.
- Semantic retrieval is not a default production retrieval path.
- Semantic context expansion is explicit opt-in only.
- Backup archive creation, encryption, and multi-device sync are not implemented.
- Planner/action execution remains dry-run-only.
- Real Cubism `.moc3` model loading is not implemented.

## Tagging

After final verification on `main`, `v0.1.0` is the suggested tag name. Do not
create the tag until the owner explicitly approves tagging.
