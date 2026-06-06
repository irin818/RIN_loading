# RIN Python Core Candidate

Status: Package 0 foundation.

This directory contains the isolated Python candidate for the RIN core
migration. The TypeScript RIN v2.0 implementation remains the production
reference and rollback path until a later owner-approved cutover.

## Scope

Package 0 creates only:

- Python project configuration
- package/module skeleton
- provider-free check commands
- temporary data safety helpers
- migration control documentation
- initial tests for imports, readiness, and path safety

It does not replace the TypeScript runtime, switch launchers, modify production
`.rin-data`, or apply database migrations.

## Dependencies

- Pydantic v2: future explicit JSON/data contracts.
- FastAPI and Uvicorn: future local API compatibility candidate.
- httpx: future Ollama/Qwen3 adapter and API tests.
- pytest and pytest-asyncio: test runner and future async API/model tests.
- Ruff: lint and format checks.
- mypy: static typing check.

No cloud service, vector database, heavy ORM, or external provider SDK is added.

## Install For Development

```sh
cd python
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -e ".[dev]"
```

If `python3.12` is not installed, use another Python 3.12+ executable.

## Checks

From `python/` after installing development dependencies:

```sh
rin-python-check
rin-python-parity-check
rin-python-readiness
rin-python-candidate-check
```

Equivalent module form:

```sh
PYTHONPATH=src python -m rin.cli.check
PYTHONPATH=src python -m rin.cli.parity_check
PYTHONPATH=src python -m rin.cli.readiness
PYTHONPATH=src python -m rin.cli.candidate_check
```

All Package 0 checks are provider-free and do not require Ollama or external
API credentials.

## Data Safety

Python migration write tests must use `/tmp/rin-python-*`.

The safety guard rejects:

- `/Users/irin/Documents/RIN_loading/.rin-data`
- any child path inside that production `.rin-data`
- non-temporary write-test paths

There is intentionally no override for real production writes during this
migration program.
