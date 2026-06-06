# TypeScript Fallback Guide

Status: Package D4 rollback guide.

## Fallback Tag

The final TypeScript fallback tag is:

```text
typescript-final-fallback
```

Use this tag if a full code rollback is needed:

```sh
git checkout typescript-final-fallback
```

## Fallback Launchers

Fallback launchers are no longer preserved in the active tree because the
TypeScript source and Node configuration have been removed. Use the fallback tag
for any TypeScript rollback.

## Temporary Data Verification

Verify TypeScript fallback only after checking out the fallback tag:

```sh
git checkout typescript-final-fallback
TS_FALLBACK="$(mktemp -d /tmp/rin-ts-fallback.XXXXXX)"
RIN_DATA_DIR="$TS_FALLBACK" npm run rin:init
RIN_DATA_DIR="$TS_FALLBACK" npm run rin:v2-check
```

## Safety

- Do not delete `.rin-data`.
- Do not delete `.rin-python-backups/`.
- Do not commit temporary fallback data.
- Prefer Python launchers unless performing rollback or fallback validation.
