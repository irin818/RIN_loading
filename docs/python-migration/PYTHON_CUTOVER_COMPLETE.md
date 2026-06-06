# Python Cutover Complete

Status: Python is the recommended primary launch path.

## Completed

- Persistent Python sandbox established.
- Real-data preflight passed.
- Verified real-data backup created.
- Real-data migration dry-run passed.
- Real-data migration apply completed with marker and audit record.
- Python production launchers added.
- TypeScript fallback launchers and source remain intact.
- `rin-python-production-check` added.

## Current Recommendation

Recommended:

```sh
./Start_RIN_Python_Local_Model.command
```

Provider-free Python mode:

```sh
./Start_RIN_Python.command
```

Fallback:

```sh
git checkout typescript-final-fallback
```

## Not Done

- TypeScript Core was later removed from the active Python-only tree.
- TypeScript fallback remains available through the `typescript-final-fallback`
  tag.
- Long-running production soak has not yet completed.
