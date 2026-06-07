# RIN Loading

RIN is a local-first, single-owner personal agent system. This repository is now
Python-first for active runtime and development.

## Active Runtime

Use the default launcher from the repository root:

```sh
./Start_RIN.command
```

It starts local Ollama/Qwen3 mode and opens the local FastAPI web UI at:

```text
http://127.0.0.1:8765/
```

`Start_RIN.command` is the only normal owner-facing root launcher. It checks the
Python venv, verifies Ollama and `qwen3:4b`, starts the server, opens the
browser once, and keeps the terminal open so Ctrl-C stops the server. The old
`Start_RIN_Python.command`, `Start_RIN_Python_Local_Model.command`, and
`打开RIN项目.command` aliases were removed intentionally to reduce launcher
confusion.

## Python Console UI

The active local console uses FastAPI, Jinja2 templates, static CSS, and minimal
vanilla JavaScript. It has no TypeScript, React, Vite, Node, npm, or frontend
build chain.

The console uses a character-centered black-green glass HUD layout: a central
static RIN presence, a translucent left message terminal with attached composer,
and a translucent right status/memory/profile panel with compact live metrics
and local visualizations.

## Install

Create the Python environment:

```sh
cd python
python3.12 -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
```

No external API key is required for the active runtime.

## Production Safety

Python production launchers require the migration marker:

```text
.rin-data/config/python_cutover_marker.json
```

Do not delete:

- `.rin-data/`
- `.rin-python-backups/`
- `.rin-python-cutover-state/`

These local data and backup directories are ignored by Git.

## Checks

Run active Python checks:

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

Optional local-model readiness:

```sh
RIN_PYTHON_CHECK_LOCAL_MODEL=1 rin-python-production-check
RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_MODEL=qwen3:4b RIN_OLLAMA_TIMEOUT_MS=180000 rin-python-local-chat-smoke
```

## Rollback

The final TypeScript fallback tag is:

```text
typescript-final-fallback
```

Rollback requires checking out that tag:

```sh
git checkout typescript-final-fallback
```

The current tree no longer keeps runnable TypeScript fallback scripts because the
TypeScript source and Node configuration have been removed.

## Documentation

Important Python-only transition docs:

- `docs/python-only/TYPESCRIPT_DELETION_BLOCKER_INVENTORY.md`
- `docs/python-only/PYTHON_UI_COMPLETION_REPORT.md`
- `docs/python-only/BODY_LIVE2D_RETIREMENT_OR_REPLACEMENT.md`
- `docs/python-only/OPERATIONAL_SURFACE_RETIREMENT_REPORT.md`
- `docs/python-only/TYPESCRIPT_FALLBACK_GUIDE.md`
- `docs/python-only/PYTHON_CONSOLE_UI_REBUILD.md`
