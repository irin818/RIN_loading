# TypeScript Fallback Guide

Status: fallback retained after Python cutover.

## Launchers

TypeScript fallback remains available:

```sh
./Start_RIN.command
./Start_RIN_Local_Model.command
```

## When To Use

Use TypeScript fallback if:

- Python production server fails to start.
- Python local model path is unavailable.
- A Python runtime regression is found.
- Manual rollback/restore from backup is required.

## Verification

Fallback checks should use temporary data unless deliberately validating a
restore:

```sh
TS_FALLBACK="$(mktemp -d /tmp/rin-ts-fallback.XXXXXX)"
RIN_DATA_DIR="$TS_FALLBACK" npm run rin:init
RIN_DATA_DIR="$TS_FALLBACK" npm run rin:v2-check
```

## Safety

- TypeScript Core has not been deleted.
- TypeScript tests have not been removed.
- TypeScript fallback launchers have not been removed.
- Production backup bundles must remain preserved.
