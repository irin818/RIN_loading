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

## Decision P0005: Python contracts preserve TypeScript JSON field names

Decision:

- Package 1 Pydantic contracts preserve compatibility-required TypeScript JSON
  field names, including camelCase names.
- Unknown fields are rejected with `extra="forbid"`.
- Required TypeScript `null` fields remain nullable in Python.
- Optional TypeScript fields are represented as `None` in Python and should be
  serialized with `exclude_none=True` when matching JavaScript `undefined`
  omission semantics.

Implications:

- Later API and runtime packages must choose serialization intentionally instead
  of relying on Pydantic defaults for optional fields.
- Data-contract tests use synthetic fixtures only and do not imply storage,
  database, provider, or runtime behavior parity yet.

## Decision P0006: Python npm wrappers use the project venv

Decision:

- Root `rin-python-*` npm wrappers call `python/.venv/bin/python` explicitly.
- This avoids accidentally running macOS system Python 3.9 during the migration.
- Read-only storage/profile CLI commands may display local diagnostic paths but
  must not print private profile full text.

Implications:

- Developers must create `python/.venv` before using root Python npm wrappers.
- Package 2 profile reports expose counts and validation issues only.

## Decision P0007: Read-only database access uses SQLite mode=ro

Decision:

- Package 3 opens SQLite files with `file:<path>?mode=ro`.
- The Python read-only repository does not create migration tables, apply
  migrations, or initialize databases.
- Audit summaries expose event types and payload keys only, not payload values.

Implications:

- Missing or malformed databases fail instead of being repaired in read-only
  packages.
- Write-capable behavior is deferred to Package 7 and must use the production
  data safety guard before every write entry point.
