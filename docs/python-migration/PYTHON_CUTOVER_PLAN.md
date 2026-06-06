# RIN Python Cutover Plan

Status: skeleton, not approved for execution.

## Current Position

The Python implementation is a migration candidate only. Production remains on
the TypeScript RIN v2.0 core.

## Cutover Preconditions

Before any production cutover can be proposed:

- Packages 0-10 must be complete.
- Python full checks, parity checks, readiness, and candidate checks must pass.
- TypeScript `npm run rin:v2-check` and `npm run rin:check` must still pass.
- Synthetic, temporary-data, and copied-data validation must be complete.
- Real `.rin-data` must remain untouched by migration development.
- A candidate report must document exact parity, approved differences, missing
  functionality, data safety, rollback steps, and performance differences.

## Actions Explicitly Not Authorized In This Program

- Switching production launchers to Python.
- Modifying the owner's real `.rin-data`.
- Applying Python migrations to real production data.
- Deleting TypeScript core source.
- Merging production cutover into `main`.

## Future Owner Review Required

The owner must explicitly review and approve:

1. production launcher switch;
2. real data migration or copied-data promotion;
3. final TypeScript core removal;
4. any destructive schema cleanup;
5. final merge from Python candidate into production `main`.

## Rollback Principle

Until final cutover is approved and complete, rollback means continuing to use
the TypeScript RIN v2.0 implementation on `main`.
