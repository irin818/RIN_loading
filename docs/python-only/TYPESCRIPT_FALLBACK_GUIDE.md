# TypeScript Fallback Guide

Status: Package C rollback guide.

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

Fallback launchers are preserved under:

```sh
./scripts/typescript-fallback/Start_RIN_TypeScript_Fallback.command
./scripts/typescript-fallback/Start_RIN_TypeScript_Local_Model_Fallback.command
```

These are rollback-only launchers. The active root launchers are Python-only.

## Temporary Data Verification

Verify TypeScript fallback on temporary data:

```sh
TS_FALLBACK="$(mktemp -d /tmp/rin-ts-fallback.XXXXXX)"
RIN_DATA_DIR="$TS_FALLBACK" npm run rin:init
RIN_DATA_DIR="$TS_FALLBACK" npm run rin:v2-check
```

## Safety

- Do not delete `.rin-data`.
- Do not delete `.rin-python-backups/`.
- Do not commit temporary fallback data.
- Prefer Python launchers unless performing rollback or fallback validation.
