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

## Decision P0008: Memory V2 algorithms remain pure until write packages

Decision:

- Package 4 implements only pure deterministic analysis and tokenization.
- It does not persist Memory V2 traces, apply migrations, delete raw messages,
  mutate accepted memories, or call providers.
- Built-in TypeScript fixture decisions are treated as parity targets.

Implications:

- Memory V2 trace writes remain deferred to Package 7/8.
- Any future differences from TypeScript scoring must be documented before merge.

## Decision P0009: Context V2 remains pure until runtime packages

Decision:

- Package 5 implements pure deterministic context report assembly only.
- It does not read database state, call model providers, or alter TypeScript
  production context injection.
- Protected system/profile/current-owner segments are allowed to exceed the soft
  budget, matching the TypeScript reference behavior.

Implications:

- Storage-backed Context V2 assembly is deferred to later runtime/API packages.
- Any future difference in budget or deduplication behavior must be documented
  before merge.

## Decision P0010: Ollama live calls are explicit only

Decision:

- Package 6 default checks and smoke commands remain provider-free and
  `skipped_not_selected` unless `RIN_MODEL_ADAPTER=rin-ollama-local`.
- The Python Ollama adapter sends `think: false` and never treats reasoning-only
  output as assistant content.
- Error details may include safe metadata such as field names, but not raw
  provider responses or thinking text.

Implications:

- Optional live Qwen3/Ollama checks are outside default aggregate gates.
- Conversation runtime packages must preserve the same no-thinking-leak behavior.

## Decision P0011: Python writes are temp-only with no override

Decision:

- Package 7 introduces write helpers only for `/tmp/rin-python-*` layouts.
- Every write entry point calls the production-data safety guard before opening
  a writable SQLite connection.
- No environment variable, CLI flag, or code-level override exists during the
  migration.

Implications:

- Runtime candidate work can persist synthetic conversations without touching
  real owner data.
- Any future production migration must be a separate reviewed cutover task.

## Decision P0012: Runtime candidate preserves failure state

Decision:

- Package 8 persists the owner message before the model call.
- If the model fails or returns empty/reasoning-only content, the runtime records
  a failed turn and writes no RIN reply.
- Successful turns persist sanitized final content and a Memory V2 trace summary
  with no raw owner text.

Implications:

- The Python candidate can be tested with deterministic mock adapters without
  hiding model failures.
- Production runtime replacement remains out of scope until final cutover review.

## Decision P0013: FastAPI compatibility is app-factory only

Decision:

- Package 9 exposes a FastAPI app factory for local compatibility testing.
- It is not wired into the macOS launcher, TypeScript Console, or production
  runtime.
- Write routes reject layouts outside `/tmp/rin-python-*` and default to a mock
  local adapter.

Implications:

- API contract tests can validate candidate behavior without opening a server or
  touching real data.
- Binding, deployment, launcher replacement, and production routing remain
  explicit cutover tasks.
