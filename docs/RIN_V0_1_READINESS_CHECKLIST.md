# RIN v0.1 Readiness Checklist

Status: Package 5 stabilization document.

## Required Local Checks

- `npm run rin:check`
- `npm run rin:memory-eval`
- `npm run rin:semantic-eval`
- `npm run rin:semantic-readiness`
- `npm run rin:semantic-index-report`
- `npm run rin:semantic-live-index-report`
- `npm run rin:hybrid-retrieval-report`
- `npm run rin:semantic-trace-list`
- `npm run rin:semantic-trace-read`
- `npm run rin:memory-maintenance-report`
- `npm run rin:planner-smoke`
- `npm run rin:backup-dry-run`
- `npm run rin:restore-dry-run`
- `npm run rin:full-check`

## v0.1 Gate Summary

- Local model adapters remain configurable fast variables.
- Deterministic accepted-memory retrieval remains the baseline.
- Semantic retrieval remains report-only by default.
- Semantic context expansion is explicit opt-in candidate expansion only.
- Memory maintenance is suggestion-only.
- Actions and planner smoke are dry-run-only and finite.
- Console operational status is read-only.
- Backup and restore continuity checks are dry-run by default.
- No cloud sync, vector database, background autonomous loop, or default provider
  call is required.

## Release Status

RIN v0.1 is ready when all required local checks pass on `main`, the working tree
is clean, and the final safety audit has no unresolved findings.
