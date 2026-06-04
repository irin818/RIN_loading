# RIN v1.0 Migration Guide

Status: conservative local migration guide.

## Current Migration Boundary

RIN v1.0 supports local inspection and dry-run migration checks. It does not
perform automatic cloud sync, automatic overwrite, or automatic conflict merge.

## Recommended Flow

1. Run `npm run rin:migration-check`.
2. Run `npm run rin:backup-dry-run`.
3. Run `npm run rin:backup-encrypted-smoke`.
4. Review generated reports before moving any local state.
5. Use restore apply only with explicit confirmation and a non-conflicting
   target.

## Sync Boundary

`npm run rin:sync-dry-run` reports local sync readiness only. It does not upload
data, enable cloud sync, perform plaintext sync, mutate state, or merge
conflicts.
