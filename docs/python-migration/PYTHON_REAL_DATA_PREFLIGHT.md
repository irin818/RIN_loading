# Python Real-Data Preflight

Status: Package B cutover gate.

## Purpose

`rin-python-real-data-preflight` inspects the real production `.rin-data`
read-only before any migration apply is allowed.

## Safety Behavior

- Reads `/Users/irin/Documents/RIN_loading/.rin-data`.
- Opens SQLite through read-only inspection paths.
- Verifies manifest, database schema, and profile files.
- Computes the production database hash.
- Reports counts and status only.
- Writes a gate artifact under `.rin-python-cutover-state/`.
- Does not print raw conversation text or full profile contents.

## Command

```sh
npm run rin-python-real-data-preflight
```

Required result before migration apply:

- `Status: passed`
- `Manifest valid: yes`
- `Database readable: yes`
- `Python readable: yes`
- `TypeScript fallback readable: yes`
- `Full text included: no`
