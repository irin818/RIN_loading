# TypeScript Fallback Guide

Status: historical fallback guide, superseded by Python-only D4.

## Launchers

TypeScript fallback is now available through the final rollback tag, not through
active-tree launchers:

```sh
git checkout typescript-final-fallback
```

The final fallback source tag is `typescript-final-fallback`.

## When To Use

Use TypeScript fallback if:

- Python production server fails to start.
- Python local model path is unavailable.
- A Python runtime regression is found.
- Manual rollback/restore from backup is required.

## Verification

After checking out the fallback tag, fallback checks should use temporary data
unless deliberately validating a restore:

```sh
TS_FALLBACK="$(mktemp -d /tmp/rin-ts-fallback.XXXXXX)"
RIN_DATA_DIR="$TS_FALLBACK" npm run rin:init
RIN_DATA_DIR="$TS_FALLBACK" npm run rin:v2-check
```

## Safety

- TypeScript Core has been removed from the active Python-only tree.
- TypeScript fallback remains available from `typescript-final-fallback`.
- Production backup bundles must remain preserved.
