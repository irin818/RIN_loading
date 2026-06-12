# RIN Python Core

This directory contains the Python runtime for RIN, the local-first personal
agent system. It is the active Python runtime for the current RIN project.

## Scope

The Python package covers:

- FastAPI web server with Jinja2 console UI
- Provider-neutral model adapter layer (external API chat only)
- SQLite conversation and memory storage
- Profile validation and readiness checks
- Data safety checks, diagnostics, and provider-neutral runtime tooling
- Provider-neutral model abstraction layer

## Dependencies

- FastAPI + Uvicorn: local web API and console server
- Jinja2: server-side HTML templates
- httpx: HTTP client for external API provider adapters and API tests
- Pydantic v2: data contracts and validation
- pytest + pytest-asyncio: test runner
- Ruff: lint and format
- mypy: static type checking

No cloud service, vector database, heavy ORM, or external provider SDK is
required.

## Install For Development

```sh
cd python
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -e ".[dev]"
```

If `python3.12` is not installed, use another Python 3.12+ executable.

## Checks

From `python/` after activating `.venv`:

```sh
# Aggregate checks
python -m pytest
python -m ruff check .
python -m ruff format --check .
python -m mypy src
rin-python-candidate-check
rin-python-production-check
```

All base checks are provider-free and do not require external API
credentials.

Local model checks are reserved for future non-chat features (OCR, vision,
speech, classification, local preprocessing, offline utilities). They are
not part of the current active chat path.

## Data Safety

The Python runtime only writes to the production `.rin-data` directory
through gated safety checks. Temporary write tests use `/tmp/rin-python-*`
paths only.

## Production Launch

Use the root launcher from the repository root:

```sh
./Start_RIN.command
```

It starts the FastAPI server on `http://127.0.0.1:8765/`.

Chat dialogue will require external API configuration in a future implementation step. RIN does not currently use a local model for chat.
