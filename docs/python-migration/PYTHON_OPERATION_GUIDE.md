# Python Operation Guide

Status: Python primary operation.

## Recommended Start

Use the single owner-facing Python launcher:

```sh
./Start_RIN.command
```

It binds to `127.0.0.1:8765`, uses local Ollama `qwen3:4b` by default, keeps
external APIs disabled, and requires the production migration marker at
`.rin-data/config/python_cutover_marker.json`. The old
`Start_RIN_Python.command` and `Start_RIN_Python_Local_Model.command` names were
removed later and are historical only.

## Checks

Production readiness:

```sh
cd python
. .venv/bin/activate
rin-python-production-check
```

Include local Ollama readiness:

```sh
cd python
. .venv/bin/activate
RIN_PYTHON_CHECK_LOCAL_MODEL=1 rin-python-production-check
```

## Data Safety

- Production `.rin-data` is local and private.
- Backups live under `.rin-python-backups/` and must not be deleted casually.
- Python sandbox data lives under `.rin-python-preview-data/`.
- Cutover artifacts live under `.rin-python-cutover-state/`.
- All of these local data directories are ignored by Git.
