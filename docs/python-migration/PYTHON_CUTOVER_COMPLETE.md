# Python Cutover Complete

Status: Python is the recommended primary launch path.

## Completed

- Persistent Python sandbox established.
- Real-data preflight passed.
- Verified real-data backup created.
- Real-data migration dry-run passed.
- Real-data migration apply completed with marker and audit record.
- Python production launcher added.
- TypeScript fallback is now Git-tag based.
- `rin-python-production-check` added.

## Current Recommendation

Current recommended launcher:

```sh
./Start_RIN.command
```

It starts Python RIN with local Ollama `qwen3:4b` by default. The old
`Start_RIN_Python.command` and `Start_RIN_Python_Local_Model.command` names were
removed later as part of single-launcher simplification.

Fallback:

```sh
git checkout typescript-final-fallback
```

## Not Done

- TypeScript Core was later removed from the active Python-only tree.
- TypeScript fallback remains available through the `typescript-final-fallback`
  tag.
- Long-running production soak has not yet completed.
