# Python Real-Data Migration Apply

Status: Package C apply implemented and run once.

## Result

Real-data migration apply was executed with:

```sh
cd python
RIN_PYTHON_REAL_DATA_MIGRATION=allow .venv/bin/rin-python-real-data-migration-apply
```

Result:

- status: passed
- marker: `.rin-data/config/python_cutover_marker.json`
- backup: `.rin-python-backups/rin-data-backup-20260606T173720Z`
- pre-apply DB hash: `56b4f8e2345389676ec9da6a381b5895246bf4ceba49f0d498018d1730e076cc`
- post-apply composite DB hash:
  `45a2ed6287bf900eb008351904fd1856779f346e6f5c1a2a54567a0ea1042875`
- raw messages preserved: yes
- legacy memories preserved: yes
- Python readable after apply: yes
- Python write verified: yes
- TypeScript fallback readable: yes
- full text included: no

The apply command is idempotent. A second run returned `already_applied`.

## What Changed

The apply wrote only:

- a Python cutover marker file under production `.rin-data/config/`;
- a sanitized audit event in the production SQLite database.

It did not delete raw messages, delete legacy memories, mutate profile content,
or remove TypeScript fallback.

## Known Note

During Package C verification, two empty synthetic conversations were created by
legacy tests after the migration marker enabled production writes. The tests were
fixed to use markerless fake production paths. No raw message text was added by
those test artifacts.

## Rollback

Use the verified backup at:

```text
.rin-python-backups/rin-data-backup-20260606T173720Z
```

TypeScript Core and TypeScript launchers remain in place as fallback.
