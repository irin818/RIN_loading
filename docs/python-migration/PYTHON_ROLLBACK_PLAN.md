# Python Rollback Plan

Status: rehearsal-only, not production cutover approval.

## Current Rollback Path

The TypeScript v2.0 core remains the production reference and rollback backend.
No production launcher is switched to Python in the current candidate.

## Rehearsed Guarantees

- Python dry-run commands copy data to `/tmp/rin-python-shadow-*` before
  inspection or write simulation.
- Source DB hash is checked before and after rehearsal.
- Python write simulation uses copied data only.
- Existing TypeScript launchers remain unchanged.
- TypeScript Core remains in the repository.

## Limits

- This does not prove a future production cutover is safe.
- This does not apply a real data migration.
- This does not replace owner-reviewed backups.
- This does not approve TypeScript Core removal.

## Command

```sh
cd /Users/irin/Documents/RIN_loading_python
npm run rin-python-rollback-rehearsal
```

Required result:

- `Source DB hash unchanged: yes`
- `Python write session: passed_on_copy`
- `TypeScript readable state: compatible_schema_no_launcher_change`
- `Production apply available: no`

Stop immediately if the source DB hash changes or if any command needs to write
to production `.rin-data`.
