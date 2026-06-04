# RIN v0.4 Release Notes

Status: v0.4 stabilization document.

## Highlights

- Adds `npm run rin:memory-health-report`.
- Adds `npm run rin:memory-conflict-report`.
- Adds `npm run rin:memory-governance-smoke`.
- Adds `npm run rin:v0-4-check`.
- Extends memory maintenance into suggestion-only governance reports for stale
  review, possible conflicts, duplicate merge candidates, and archive review
  candidates.

## Standard Verification

```sh
npm run rin:v0-4-check
```

The v0.4 check includes v0.3 checks plus memory health, conflict, and governance
smoke reports.

## Known Limitations

- No memory is automatically deleted, archived, merged, or downgraded.
- Conflict detection is deterministic and conservative; owner review remains
  required.
- Reports intentionally avoid full memory text by default.
- No semantic/vector/provider behavior is added.
