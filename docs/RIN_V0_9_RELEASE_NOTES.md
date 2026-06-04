# RIN v0.9 Release Notes

Status: v0.9 stabilization document.

## Highlights

- Adds `npm run rin:integrity-check`.
- Adds `npm run rin:recovery-smoke`.
- Adds `npm run rin:ops-health-report`.
- Adds `npm run rin:v0-9-check`.
- Documents report-only reliability boundaries.

## Standard Verification

```sh
npm run rin:v0-9-check
```

The v0.9 check includes v0.8 checks plus local integrity, recovery, and ops
health reports.

## Known Limitations

- No automatic database repair is implemented.
- No automatic restore apply is performed.
- No log rotation or retention mutation is performed.
- Reports summarize health and degraded states without printing local paths,
  secrets, raw prompts, or full memory text.
