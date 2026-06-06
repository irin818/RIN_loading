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
./scripts/typescript-fallback/Start_RIN_TypeScript_Local_Model_Fallback.command
./scripts/typescript-fallback/Start_RIN_TypeScript_Fallback.command
```

## Not Done

- TypeScript Core has not been deleted.
- TypeScript fallback launchers have moved out of the root active launcher path.
- Long-running production soak has not yet completed.
