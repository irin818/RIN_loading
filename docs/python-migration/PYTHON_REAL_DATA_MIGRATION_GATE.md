# Python Real-Data Migration Gate

Status: Package B dry-run gate; no apply command yet.

## Purpose

`rin-python-real-data-migration-dry-run` rehearses the production migration on a
temporary copy of real `.rin-data`.

## Safety Behavior

- Runs real-data preflight first.
- Copies real `.rin-data` to `/tmp/rin-python-cutover-dry-run-*`.
- Simulates Python writes on the copy only.
- Records the production DB hash before and after the dry-run.
- Fails if the production DB hash changes.
- Verifies the copied state remains Python-readable and TypeScript-fallback
  readable.
- Writes a gate artifact under `.rin-python-cutover-state/`.
- Reports planned writes and rollback path.
- Does not expose private raw text.
- Does not implement production migration apply.

## Command

```sh
npm run rin-python-real-data-migration-dry-run
```

Required result before a future apply package:

- `Status: passed`
- `Source hash unchanged: yes`
- `Python readable after simulation: yes`
- `TypeScript fallback readable after simulation: yes`
- `Production apply available: no`
