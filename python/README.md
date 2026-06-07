# RIN Python Core

This directory contains the Python runtime for RIN, the local-first personal
agent system. It is the active production runtime as of the Python cutover.

## Scope

The Python package covers:

- FastAPI web server with Jinja2 console UI
- Local Ollama model adapter (Qwen3 4B recommended)
- SQLite conversation and memory storage
- Profile validation, diagnostics, and readiness checks
- Data safety checks, diagnostics, and provider-neutral runtime tooling
- Provider-neutral model abstraction layer

## Dependencies

- FastAPI + Uvicorn: local web API and console server
- Jinja2: server-side HTML templates
- httpx: HTTP client for local model adapter and API tests
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

# Optional local-model checks (requires Ollama + qwen3:4b)
RIN_PYTHON_CHECK_LOCAL_MODEL=1 rin-python-production-check
RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_MODEL=qwen3:4b RIN_OLLAMA_TIMEOUT_MS=180000 rin-python-local-chat-smoke
```

All base checks are provider-free and do not require Ollama or external API
credentials.

## Data Safety

The Python runtime only writes to the production `.rin-data` directory
through gated safety checks. Temporary write tests use `/tmp/rin-python-*`
paths only.

## Production Launch

Use the root launcher from the repository root:

```sh
./Start_RIN.command
```

It starts the FastAPI server on `http://127.0.0.1:8765/` with local Ollama.
