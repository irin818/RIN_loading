# Backup And Migration Policy

Status: Package 4 design lock.

Backup and migration are continuity slow variables. They must be local-first,
explicit, dry-run capable, and conservative about overwrite risk.

## Allowed Behavior

- Report what a local backup would include before creating or copying anything.
- Include a manifest schema version, source storage schema version, safe relative
  file names, sizes, and hashes.
- Validate a local backup manifest in restore dry-run mode.
- Report overwrite risk before any restore.
- Exclude dependency folders, build outputs, temporary files, logs, secrets, and
  environment files.

## Forbidden Behavior

- No default cloud sync.
- No remote export.
- No plaintext secret export.
- No automatic overwrite.
- No destructive import.
- No inclusion of `node_modules`, `dist`, `.env`, `.env.*`, caches, temporary
  directories, or local logs.

Package 4 dry-run commands do not create archives and do not mutate data. Real
bundle export/import remains separate and explicit.
