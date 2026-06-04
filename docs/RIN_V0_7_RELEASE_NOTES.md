# RIN v0.7 Release Notes

Status: v0.7 stabilization document.

## Highlights

- Adds `npm run rin:device-report`.
- Adds `npm run rin:sync-dry-run`.
- Adds `npm run rin:migration-check`.
- Adds `npm run rin:v0-7-check`.
- Establishes a local-first, dry-run-only device continuity and sync reporting
  foundation.

## Standard Verification

```sh
npm run rin:v0-7-check
```

The v0.7 check includes v0.6 checks plus device identity, sync dry-run, and
migration check reports.

## Known Limitations

- No cloud sync is implemented.
- No plaintext sync is enabled.
- No conflict merge or overwrite happens automatically.
- Sync dry-run reports use local backup dry-run manifest metadata and do not
  upload or mutate data.
