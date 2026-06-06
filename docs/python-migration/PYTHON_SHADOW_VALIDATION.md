# Python Copied-Data Shadow Validation

Status: Package C copied-data validation.

## Purpose

`rin-python-copy-data-shadow-report` validates the Python candidate against a
temporary copy of the owner's current `.rin-data` without modifying the original.

## Safety Behavior

- Source defaults to `/Users/irin/Documents/RIN_loading/.rin-data`.
- Destination is created under `/tmp/rin-python-shadow-*`.
- The source SQLite DB hash is recorded before and after all operations.
- Python read-only inspection runs against the copy.
- Write simulation runs only on the copy.
- The copy is removed by default.
- Reports include counts and status only, not private conversation text or full
  profile contents.

## Command

```sh
cd /Users/irin/Documents/RIN_loading_python
npm run rin-python-copy-data-shadow-report
```

Retain the copied temp directory only for manual debugging:

```sh
RIN_SHADOW_RETAIN_COPY=1 npm run rin-python-copy-data-shadow-report
```

## Required Result

- `Source DB hash unchanged: yes`
- `Private text included: no`
- `Full profile included: no`
- `Write simulation: passed_on_copy`

If the source hash changes, stop immediately. That would violate the migration
safety boundary.
