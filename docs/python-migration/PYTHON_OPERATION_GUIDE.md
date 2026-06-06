# Python Operation Guide

Status: Python primary operation.

## Recommended Start

Use the local-model Python launcher:

```sh
./Start_RIN_Python_Local_Model.command
```

Use provider-free mock mode when testing without Ollama:

```sh
./Start_RIN_Python.command
```

Both launchers bind to `127.0.0.1:8765` and require the production migration
marker at `.rin-data/config/python_cutover_marker.json`.

## Checks

Production readiness:

```sh
npm run rin-python-production-check
```

Include local Ollama readiness:

```sh
RIN_PYTHON_CHECK_LOCAL_MODEL=1 npm run rin-python-production-check
```

## Data Safety

- Production `.rin-data` is local and private.
- Backups live under `.rin-python-backups/` and must not be deleted casually.
- Python sandbox data lives under `.rin-python-preview-data/`.
- Cutover artifacts live under `.rin-python-cutover-state/`.
- All of these local data directories are ignored by Git.
