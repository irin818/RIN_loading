# RIN Python Migration Decisions

Status: active Python migration decision log.

## Decision P0001: TypeScript v2.0 remains the reference implementation

Decision:

- The Python core is a candidate implementation until a later owner-approved
  production cutover.
- The existing TypeScript RIN v2.0 core remains the behavioral reference and
  rollback path.

Implications:

- Python packages must inspect TypeScript source and tests before implementing
  migrated behavior.
- Normal Python migration PRs target `python-rewrite/main`, not `main`.
- TypeScript core deletion or launcher cutover is out of scope for normal
  migration packages.

## Decision P0002: Python write tests are temp-data only

Decision:

- Python write-capable commands and tests must reject the owner's production
  `.rin-data`.
- During this program, allowed write-test data lives under `/tmp/rin-python-*`.
- There is no override for production writes.

Implications:

- Package 0 provides the reusable safety guard.
- Later database and runtime packages must use this guard before adding writes.

## Decision P0003: Provider-free defaults

Decision:

- Python checks and readiness commands are provider-free by default.
- Ollama/Qwen3 checks remain explicit live commands in later packages.

Implications:

- Package 0 readiness reports `providerCallCount: 0`.
- No external API dependency or credential is required for default checks.

## Decision P0004: Dependencies are explicit and minimal

Decision:

- Package 0 introduces Pydantic v2, FastAPI, Uvicorn, httpx, pytest,
  pytest-asyncio, Ruff, and mypy for the planned migration surface.
- No heavy ORM, vector database, cloud SDK, or hidden dependency injection
  framework is introduced.

Implications:

- SQLite access will begin with the Python standard library.
- Dependency additions must remain justified in `python/README.md`.
