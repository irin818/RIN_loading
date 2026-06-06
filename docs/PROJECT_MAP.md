# RIN Project Map

This document explains the current active project shape after the Python-only
transition.

## Current State

RIN is a local-first Python runtime for a single-owner personal agent system.

Current active pieces:

- Python runtime package under `python/src/rin`.
- Python tests under `python/tests`.
- FastAPI local web UI at `http://127.0.0.1:8765/`.
- Local SQLite-backed `.rin-data/`.
- Production cutover marker under `.rin-data/config/python_cutover_marker.json`.
- Preserved backup bundles under `.rin-python-backups/`.
- Local-model support through the default `Start_RIN.command` launcher, using
  Ollama/Qwen3.
- TypeScript rollback through the `typescript-final-fallback` Git tag.

Retired from active tree:

- TypeScript Core.
- React/Vite UI.
- Node package configuration.
- TypeScript fallback scripts.

## Useful Commands

Install Python dependencies:

```sh
cd python
python3.12 -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
```

Start the owner-facing Python local-model UI:

```sh
./Start_RIN.command
```

Run checks:

```sh
cd python
. .venv/bin/activate
python -m pytest
python -m ruff check .
python -m ruff format --check .
python -m mypy src
rin-python-candidate-check
rin-python-production-check
```

Run optional local-model checks:

```sh
cd python
. .venv/bin/activate
RIN_PYTHON_CHECK_LOCAL_MODEL=1 rin-python-production-check
RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_MODEL=qwen3:4b RIN_OLLAMA_TIMEOUT_MS=180000 rin-python-local-chat-smoke
```

Rollback to TypeScript:

```sh
git checkout typescript-final-fallback
```

## Key Directories

- `python/`: active Python package, tests, and tooling.
- `docs/python-only/`: Python-only transition records.
- `docs/python-migration/`: historical and safety migration records.
- `public/live2d/`: retained static Live2D assets.
- `live2d-development/`: retained Live2D development materials.

## Safety

Do not commit or delete:

- `.rin-data/`
- `.rin-python-backups/`
- `.env`
- local databases
- logs
- secrets
