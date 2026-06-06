# Python Real-Data Backup

Status: Package B cutover gate.

## Purpose

`rin-python-real-data-backup` creates a timestamped local backup of real
production `.rin-data` before any migration apply can be considered.

## Safety Behavior

- Runs real-data preflight first.
- Copies `.rin-data` into `.rin-python-backups/rin-data-backup-*`.
- Never overwrites an existing backup directory.
- Verifies the copied SQLite database hash matches the source hash.
- Verifies the backup database can be inspected.
- Writes a gate artifact under `.rin-python-cutover-state/`.
- Reports paths, hashes, and status only.

## Command

```sh
npm run rin-python-real-data-backup
```

Required result before migration apply:

- `Status: passed`
- `Backup verified: yes`
- `Dry-run restore inspectable: yes`

Backup directories are local private data and must not be committed.
