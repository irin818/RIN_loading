# RIN Python Migration Progress

Status: active handoff document.

## Current State

- Current package: Package F — Post-Merge Preview Usage Finalization.
- Current checkpoint: PR #72 merged into `main` as preview-only; post-merge
  checks passed.
- Active branch: `python-preview/post-merge-docs-if-needed`.
- Target integration branch: `main`.
- Worktree: `/Users/irin/Documents/RIN_loading_python`.
- TypeScript reference branch: `main`.
- TypeScript reference tag: `v2.0.0`.
- Latest verified TypeScript reference commit:
  `48bcb13 Merge pull request #60 from irin818/codex/v2-progress-complete`.
- Latest verified migration integration commit:
  `22520df Merge pull request #81 from irin818/python-rewrite/19-update-pr72-preview`.
- Candidate PR: #72, merged to `main` as preview-only.
- Final preview-only main merge commit:
  `13ed047 Merge pull request #72 from irin818/python-rewrite/main`.

## Completed Work

- Verified stable TypeScript `main` is clean, matches `origin/main`, and has
  tag `v2.0.0`.
- Created migration worktree `/Users/irin/Documents/RIN_loading_python`.
- Created and pushed integration branch `python-rewrite/main`.
- Created package branch `python-rewrite/00-foundation`.
- Read governance docs, package scripts, and all active `docs/RIN_V2_*.md`
  reference documents.
- Created Python foundation under `python/`.
- Added migration control documents under `docs/python-migration/`.
- Added Python safety guard for production `.rin-data` and `/tmp/rin-python-*`
  test data.
- Added provider-free Python readiness and check command entry points.
- Added root npm wrappers for Python migration checks.
- Installed Homebrew `python@3.12` as Python 3.12.13 without replacing macOS
  system Python.
- Created isolated Python virtual environment at `python/.venv`.
- Fixed Package 0 temp-data guard test to account for macOS `/tmp` resolving to
  `/private/tmp`.
- Merged Package 0 PR #61 into `python-rewrite/main`.
- Started Package 1 branch `python-rewrite/01-data-contracts`.
- Inspected TypeScript data contracts in storage, profiles, conversation,
  memory retrieval/Memory V2, Context V2, model config/types/errors, and
  readiness.
- Added `python/src/rin/contracts.py` with Pydantic data contracts.
- Added synthetic round-trip and invalid-input contract tests in
  `python/tests/unit/test_contracts.py`.
- Added `docs/python-migration/PYTHON_DATA_CONTRACTS.md`.
- Merged Package 1 PR #62 into `python-rewrite/main`.
- Started Package 2 branch `python-rewrite/02-storage-profiles-readonly`.
- Implemented read-only Python storage layout, manifest parsing, and core-file
  inspection.
- Implemented read-only Python profile loaders, validators, compact safe profile
  reports, and profile formatting.
- Added Python CLI entry points and root npm wrappers:
  `rin-python-storage-report`, `rin-python-profile-validate`, and
  `rin-python-profile-report`.
- Updated root npm Python wrappers to use `python/.venv/bin/python` explicitly
  instead of plain `python`.
- Merged Package 2 PR #63 into `python-rewrite/main`.
- Started Package 3 branch `python-rewrite/03-database-readonly`.
- Implemented read-only SQLite repository support with `mode=ro` connections.
- Added schema/table inspection, conversation/message reads, legacy memory reads,
  Memory V2 trace reads, and safe audit summaries.
- Added synthetic `/tmp/rin-python-*` SQLite fixture tests, including database
  hash stability after inspection and read-only write rejection.
- Merged Package 3 PR #64 into `python-rewrite/main`.
- Started Package 4 branch `python-rewrite/04-memory-v2-algorithms`.
- Implemented pure deterministic Memory V2 source-message analysis in Python,
  including signal extraction, decay/retention scoring, reinforcement, CJK/Latin
  token normalization, and deterministic decision output.
- Added Python Memory V2 tests matching TypeScript built-in fixtures, repeated
  deterministic checks, and CJK/token normalization checks.
- Merged Package 4 PR #65 into `python-rewrite/main`.
- Started Package 5 branch `python-rewrite/05-context-v2-algorithms`.
- Implemented pure deterministic Context V2 ordering, deduplication, budget
  handling, protected segment preservation, provenance, and dropped-item
  reporting.
- Added Python Context V2 tests matching TypeScript built-in fixtures and
  repeated deterministic checks.
- Merged Package 5 PR #66 into `python-rewrite/main`.
- Started Package 6 branch `python-rewrite/06-ollama-adapter`.
- Implemented Python Ollama/Qwen3 adapter with `think: false`, local defaults,
  structured safe errors, empty-content classification, thinking stripping, and
  no raw provider response exposure.
- Added default-skipped Python local chat smoke command.
- Added mocked adapter tests and default-skipped smoke tests.
- Merged Package 6 PR #67 into `python-rewrite/main`.
- Started Package 7 branch `python-rewrite/07-database-writes-temp-only`.
- Added temp-only database write helpers for synthetic conversation creation,
  message append, failed-turn records, safe audits, Memory V2 trace writes, and
  synthetic schema initialization.
- Added write tests proving production `.rin-data` rejection, transactional temp
  writes, duplicate failure without overwrite, and privacy-preserving audit
  summaries.
- Merged Package 7 PR #68 into `python-rewrite/main`.
- Started Package 8 branch `python-rewrite/08-conversation-runtime`.
- Added temp-only Python conversation runtime candidate:
  owner persistence, Context V2 report assembly, model adapter call, response
  sanitization, RIN reply persistence, completed/failed turn records, and Memory
  V2 trace write.
- Added deterministic mock runtime tests for success, model failure, thinking
  stripping, and empty-after-thinking rejection.
- Merged Package 8 PR #69 into `python-rewrite/main`.
- Started Package 9 branch `python-rewrite/09-fastapi-compatibility`.
- Added local-only FastAPI app factory with readiness, state, profile status,
  conversation create/list/history/send, and memory/context trace status.
- Added API contract tests for provider-free readiness/state, temp
  create/send/history, trace status, and production-path write rejection.
- Merged Package 9 PR #70 into `python-rewrite/main`.
- Started Package 10 branch `python-rewrite/10-candidate-validation`.
- Added candidate validation tests for synthetic API/runtime behavior and copied
  temp database read/hash safety.
- Created candidate review documents:
  - `PYTHON_CANDIDATE_REPORT.md`
  - `PYTHON_PRODUCTION_CUTOVER_CHECKLIST.md`
  - `TYPESCRIPT_CORE_REMOVAL_PLAN.md`
- Merged Package 10 PR #71 into `python-rewrite/main`.
- Created draft review-only candidate PR #72 from `python-rewrite/main` to
  `main`; it remains unmerged.
- Started Package A branch `python-rewrite/11-candidate-audit-gap-closure`.
- Added `PYTHON_CANDIDATE_AUDIT.md`.
- Added safe `elapsedMs` timing to Python runtime/API results.
- Merged Package A PR #73 into `python-rewrite/main`.
- Started Package B branch `python-rewrite/12-python-preview-launcher`.
- Added safe Python preview helpers, server command, provider-free preview smoke,
  optional local-model preview smoke, and manual preview launcher under
  `scripts/python-preview/`.
- Added `PYTHON_PREVIEW_GUIDE.md`.
- Merged Package B PR #74 into `python-rewrite/main`.
- Started Package C branch `python-rewrite/13-copied-data-shadow-validation`.
- Added copied-data shadow validation command
  `rin-python-copy-data-shadow-report`.
- Added `PYTHON_SHADOW_VALIDATION.md`.
- Merged Package C PR #75 into `python-rewrite/main`.
- Started Package D branch `python-rewrite/14-migration-dry-run-rollback`.
- Added dry-run and rollback rehearsal commands:
  - `rin-python-production-migration-dry-run`
  - `rin-python-rollback-rehearsal`
- Added `PYTHON_ROLLBACK_PLAN.md`.
- Merged Package D PR #76 into `python-rewrite/main`.
- Started Package E branch `python-rewrite/15-console-api-compatibility`.
- Added preview-compatible Console API aliases and `rin-python-api-contract-check`.
- Added `PYTHON_CONSOLE_COMPATIBILITY_REPORT.md`.
- Merged Package E PR #77 into `python-rewrite/main`.
- Started Package F branch `python-rewrite/16-final-candidate-revalidation`.
- Merged Package F PR #78 into `python-rewrite/main`.
- Started Package A branch `python-rewrite/17-final-main-integration-audit`.
- Added `PYTHON_MAIN_INTEGRATION_AUDIT.md`.
- Merged Package A PR #79 into `python-rewrite/main`.
- Started Package B branch `python-rewrite/18-preview-main-prep`.
- Added top-level README and architecture notes for Python preview/candidate
  mode while preserving TypeScript default launch behavior.
- Merged Package B PR #80 into `python-rewrite/main`.
- Started Package C branch `python-rewrite/19-update-pr72-preview`.
- Updated PR #72 title and description to clearly mark the merge as
  preview-only, list non-goals, and require separate owner-approved cutover.
- Reviewed PR #72 diff scope: no production launcher changes, no TypeScript
  `src/` changes, no package-lock churn, and no obvious data/env/log files.
- Merged Package C PR #81 into `python-rewrite/main`.
- Started Package D branch `python-rewrite/20-pr72-final-verification`.
- Ran final pre-merge verification for PR #72.
- Marked PR #72 ready for review and merged it into `main` as preview-only.
- Pulled `main` in `/Users/irin/Documents/RIN_loading`.
- Verified post-merge that `Start_RIN.command`,
  `Start_RIN_Local_Model.command`, and TypeScript `src/` had no diff from
  pre-merge `main`.
- Created Python venv under `/Users/irin/Documents/RIN_loading/python/.venv`
  for local post-merge preview checks.

## Tests Run

- Homebrew check: `command -v brew && brew --version` passed; Homebrew 5.1.15.
- Python install: `brew install python@3.12` passed; Python 3.12.13 available at
  `/opt/homebrew/opt/python@3.12/bin/python3.12`.
- Python venv setup:
  `cd python && python3.12 -m venv .venv && .venv/bin/python -m pip install --upgrade pip setuptools wheel && .venv/bin/python -m pip install -e ".[dev]"`
  passed.
- First Python check found a macOS `/tmp` path assertion issue in
  `tests/unit/test_safety.py`; fixed to compare against resolved temp root.
- Package 0 Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
- Package 1 focused Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
- Package 1 aggregate Python gates passed:
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
- Package 2 focused Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
- Package 2 aggregate Python gates passed:
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
  - `.venv/bin/rin-python-storage-report`
- Package 2 synthetic CLI smoke passed:
  - `RIN_DATA_DIR=/tmp/rin-python-* .venv/bin/rin-python-storage-report`
  - `RIN_DATA_DIR=/tmp/rin-python-* .venv/bin/rin-python-profile-validate`
  - `RIN_DATA_DIR=/tmp/rin-python-* .venv/bin/rin-python-profile-report`
- Package 3 focused Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
- Package 3 aggregate Python gates passed:
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
- Package 4 focused Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
- Package 4 aggregate Python gates passed:
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
- Package 4 repeated deterministic Python check passed:
  - `.venv/bin/python -m pytest tests/unit/test_memory_v2_algorithms.py tests/unit/test_memory_v2_algorithms.py`
- Package 5 focused Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
- Package 5 aggregate Python gates passed:
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
- Package 5 repeated deterministic Python check passed:
  - `.venv/bin/python -m pytest tests/unit/test_context_v2_algorithms.py tests/unit/test_context_v2_algorithms.py`
- Package 6 focused Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
- Package 6 aggregate Python gates passed:
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
  - `.venv/bin/rin-python-local-chat-smoke` passed with
    `skipped_not_selected`, `localModelCallCount: 0`, and external provider
    calls 0.
- Package 7 focused Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
- Package 7 aggregate Python gates passed:
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
- Package 8 focused Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
- Package 8 aggregate Python gates passed:
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
- Package 9 focused Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
- Package 9 aggregate Python gates passed:
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
  - Note: pytest reports a Starlette `TestClient` deprecation warning from
    installed FastAPI/Starlette dependencies.
- Package 10 focused Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
- Package 10 aggregate Python gates passed:
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
  - repeated `.venv/bin/rin-python-candidate-check`
- Package A Python and TypeScript gates passed; PR #73 merged.
- Package B focused Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
  - `.venv/bin/rin-python-preview-smoke` passed with temp preview data,
    production write rejection, cleanup, provider calls 0, and external provider
    calls 0.
  - `.venv/bin/rin-python-preview-local-model-smoke` default skipped with zero
    calls when local adapter was not selected.
  - `RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_TIMEOUT_MS=180000 .venv/bin/rin-python-preview-local-model-smoke`
    passed locally against `qwen3:4b`; external provider calls 0 and no raw
    provider response/thinking/full text included.
- Package C focused Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
  - `.venv/bin/rin-python-copy-data-shadow-report` passed.
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
- Package C copied-data shadow validation result:
  - Source: `/Users/irin/Documents/RIN_loading/.rin-data`.
  - Copy: `/private/tmp/rin-python-shadow-*`, removed after run.
  - Source DB hash unchanged: yes.
  - Schema version: 6.
  - Safe counts: conversations 11, messages 34, Memory V2 traces 0, profile
    files present 2.
  - Read compatibility: passed.
  - Write simulation: passed on copy only.
  - Private text included: no.
  - Full profile included: no.
- Package D focused Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
  - `.venv/bin/rin-python-production-migration-dry-run` passed.
  - `.venv/bin/rin-python-rollback-rehearsal` passed.
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
- Package D dry-run result:
  - Source DB hash unchanged: yes.
  - Copied-data result: passed.
  - Production apply available: no.
  - Private text included: no.
  - Planned operations are copy/inspect/simulate/verify only.
- Package D rollback rehearsal result:
  - Python write session: passed on copy.
  - TypeScript readable state: compatible schema, no launcher change.
  - Production apply available: no.
  - Private text included: no.
- Package E focused Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
  - `.venv/bin/rin-python-api-contract-check` passed.
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
- Package E API contract result:
  - `GET /api/local-state`: ok.
  - `POST /api/conversations`: ok.
  - `GET /api/conversations/{id}`: ok.
  - readiness: ok.
  - memory/context trace status: ok.
  - profile summary: ok.
  - structured errors: ok.
  - provider calls: 0.
  - external provider calls: 0.
  - UI changes required: no.
- Package F final Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
  - `.venv/bin/rin-python-preview-smoke`
  - `.venv/bin/rin-python-copy-data-shadow-report`
  - `.venv/bin/rin-python-production-migration-dry-run`
  - `.venv/bin/rin-python-rollback-rehearsal`
  - `.venv/bin/rin-python-api-contract-check`
  - repeated `.venv/bin/rin-python-candidate-check` three additional times.
- Package F optional local Ollama smoke passed:
  - `RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_TIMEOUT_MS=180000 .venv/bin/rin-python-preview-local-model-smoke`
  - local model calls: 1.
  - external provider calls: 0.
  - full text/raw provider response/thinking included: no.
- Main integration Package A Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
  - `.venv/bin/rin-python-preview-smoke`
  - `.venv/bin/rin-python-copy-data-shadow-report`
  - `.venv/bin/rin-python-production-migration-dry-run`
  - `.venv/bin/rin-python-rollback-rehearsal`
  - `.venv/bin/rin-python-api-contract-check`
- Main integration Package A optional local Ollama smoke passed:
  - `RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_TIMEOUT_MS=180000 .venv/bin/rin-python-preview-local-model-smoke`
  - external provider calls: 0.
  - full text/raw provider response/thinking included: no.
- Main integration Package B Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-candidate-check`
  - `.venv/bin/rin-python-preview-smoke`
  - `.venv/bin/rin-python-copy-data-shadow-report`
  - `.venv/bin/rin-python-production-migration-dry-run`
  - `.venv/bin/rin-python-rollback-rehearsal`
  - `.venv/bin/rin-python-api-contract-check`
- Main integration Package B optional local Ollama smoke passed:
  - `RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_TIMEOUT_MS=180000 .venv/bin/rin-python-preview-local-model-smoke`
  - external provider calls: 0.
  - full text/raw provider response/thinking included: no.
- Main integration Package D repeated candidate checks passed:
  - `.venv/bin/rin-python-candidate-check` passed three times.
- Main integration Package D full Python gates passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/python -m ruff check .`
  - `.venv/bin/python -m ruff format --check .`
  - `.venv/bin/python -m mypy src`
  - `.venv/bin/rin-python-check`
  - `.venv/bin/rin-python-parity-check`
  - `.venv/bin/rin-python-readiness`
  - `.venv/bin/rin-python-preview-smoke`
  - `.venv/bin/rin-python-copy-data-shadow-report`
  - `.venv/bin/rin-python-production-migration-dry-run`
  - `.venv/bin/rin-python-rollback-rehearsal`
  - `.venv/bin/rin-python-api-contract-check`
- Main integration Package D optional local Ollama smoke passed:
  - `RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_TIMEOUT_MS=180000 .venv/bin/rin-python-preview-local-model-smoke`
  - external provider calls: 0.
  - full text/raw provider response/thinking included: no.
- Optional Python local Ollama smoke:
  - default `rin-python-local-chat-smoke` skipped with zero model calls.
  - `RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_TIMEOUT_MS=60000`
    timed out locally.
  - `RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_TIMEOUT_MS=180000`
    succeeded against local `qwen3:4b`; external provider calls 0, full text not
    included, raw provider response not included, thinking not included.
- Initial TypeScript `npm run rin:check`: failed at readiness because the new
  migration worktree had no initialized local data directory.
- TypeScript temp-data setup:
  `RIN_DATA_DIR=/tmp/rin-python-ts-ref.HF8OPN npm run rin:init` passed.
- TypeScript reference check:
  `RIN_DATA_DIR=/tmp/rin-python-ts-ref.HF8OPN npm run rin:check` passed.
- TypeScript v2 gate:
  `RIN_DATA_DIR=/tmp/rin-python-ts-ref.HF8OPN npm run rin:v2-check` passed.
- Stable TypeScript reference recheck after Python 3.12 install:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-ref.Ad3SA4 npm run rin:init` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-ref.Ad3SA4 npm run rin:check` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-v2.bucssv npm run rin:init` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-v2.bucssv npm run rin:v2-check` passed.
- Stable TypeScript Package 1 reference check:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg1.0yVYOl npm run rin:init` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg1.0yVYOl npm run rin:check` passed.
- Stable TypeScript Package 2 reference checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg2.LdQzRL npm run rin:init` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg2.LdQzRL npm run rin:check` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg2.LdQzRL npm run rin:profile-validate`
    passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg2.LdQzRL npm run rin:profile-report`
    passed.
- Stable TypeScript Package 3 reference checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg3.XwglNK npm run rin:init` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg3.XwglNK npm run rin:check` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg3.XwglNK npm run rin:conversation-runtime-report`
    passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg3.XwglNK npm run rin:memory-v2-schema-report`
    passed.
- Stable TypeScript Package 4 reference checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg4.eDlsKT npm run rin:init` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg4.eDlsKT npm run rin:check` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg4.eDlsKT npm run rin:memory-v2-eval`
    passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg4.eDlsKT npm run rin:memory-eval`
    passed.
- Stable TypeScript Package 5 reference checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg5.mtmIuS npm run rin:init` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg5.mtmIuS npm run rin:check` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg5.mtmIuS npm run rin:context-v2-eval`
    passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg5.mtmIuS npm run rin:context-v2-report`
    passed.
- Stable TypeScript Package 6 reference checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg6.FWn0sT npm run rin:init` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg6.FWn0sT npm run rin:check` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg6.FWn0sT npm run rin:local-chat-smoke`
    passed with `skipped_not_selected`.
- Stable TypeScript Package 7 reference checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg7.fMoSo1 npm run rin:init` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg7.fMoSo1 npm run rin:v2-check`
    passed.
- Stable TypeScript Package 8 reference checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg8.eDr1Dl npm run rin:init` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg8.eDr1Dl npm run rin:conversation-runtime-report`
    passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg8.eDr1Dl npm run rin:v2-check`
    passed.
- Stable TypeScript Package 9 reference checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg9.wSzGId npm run rin:init` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg9.wSzGId npm run rin:v2-check`
    passed.
- Stable TypeScript Package 10 reference checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg10a.DtPkpl npm run rin:init` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg10a.DtPkpl npm run rin:v2-check`
    passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg10a.DtPkpl npm run rin:local-chat-smoke`
    passed with default skipped behavior.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-pkg10b.* npm run rin:v2-check` passed.
- Stable TypeScript Package B reference checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-ref.pULKhq npm run rin:check` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-v2.TIxFFz npm run rin:v2-check` passed.
- Stable TypeScript Package C reference checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-ref.VCITYY npm run rin:check` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-v2.16Rndm npm run rin:v2-check` passed.
- Stable TypeScript Package D reference checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-ref.3P0p2o npm run rin:check` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-v2.fHq2cD npm run rin:v2-check` passed.
- Stable TypeScript Package E reference checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-ref.RXhMdO npm run rin:check` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-v2.dmdvXI npm run rin:v2-check` passed.
- Stable TypeScript Package F final reference checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-final1.ToshF8 npm run rin:v2-check` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-final2.* npm run rin:v2-check` passed.
  - `npm run rin:daily-chat-eval` passed.
  - `git diff --check` passed.
- Main integration Package A TypeScript audit checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-audit1.RRc7D9 npm run rin:v2-check` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-audit2.J5mrcM npm run rin:check` passed.
  - `npm run rin:daily-chat-eval` passed.
  - `git diff --check` passed.
- Main integration Package B TypeScript checks:
  - `RIN_DATA_DIR=/tmp/rin-python-ts-audit1.PJmPGG npm run rin:v2-check` passed.
  - `RIN_DATA_DIR=/tmp/rin-python-ts-audit2.Kb104W npm run rin:check` passed.
  - `npm run rin:daily-chat-eval` passed.
  - `git diff --check` passed.
- Main integration Package D TypeScript checks passed:
  - temp-data `npm run rin:v2-check` passed twice.
  - temp-data `npm run rin:check` passed once.
  - `npm run rin:daily-chat-eval` passed.
  - `git diff --check` passed.
- Main integration Package D safety scans passed:
  - no production launcher, TypeScript `src/`, package-lock, data/env/log files
    in PR #72 diff.
  - no tracked forbidden data/secret file paths, excluding allowed
    `.env.example`.
  - no hidden control or bidi characters.
  - secret-like assignment scan found existing placeholders/config validation
    examples only, including README `your-api-key`; no real secret values.
- Post-merge TypeScript checks on `main` passed:
  - temp-data `npm run rin:v2-check`
  - temp-data `npm run rin:check`
  - `npm run rin:daily-chat-eval`
  - `git diff --check`
- Post-merge Python preview checks on `main` passed:
  - `.venv/bin/python -m pytest`
  - `.venv/bin/rin-python-candidate-check`
  - `.venv/bin/rin-python-preview-smoke`
  - `.venv/bin/rin-python-copy-data-shadow-report`
  - `.venv/bin/rin-python-api-contract-check`
- Copied owner-data read verification:
  - temporary copy under `/tmp/rin-python-owner-copy.*`.
  - original DB hash unchanged: yes.
  - copied DB hash unchanged after read-only inspection: yes.
  - schema version: 6.
  - tables checked: 17.
  - temporary copy removed.
- `git diff --check`: passed.

## Parity Status

- Package 0 parity target: no runtime behavior migrated yet.
- Package 0 foundation parity placeholder passed.
- Package 1 parity target: synthetic data-contract fixtures only.
- Package 1 validates round-trip JSON shapes and invalid inputs for manifest,
  profiles, conversation/message/turn records, Memory V2 report/analysis shapes,
  memory injection traces, Context V2 reports, model request/response,
  structured errors, and readiness reports.
- Package 2 parity target: read-only synthetic storage/profile fixture
  interpretation.
- Package 2 validates manifest parsing, core file presence, valid/invalid
  profile summaries, missing manifest handling, and temp-only fixture paths.
- Package 3 parity target: synthetic SQLite fixture interpretation.
- Package 3 validates schema version/table counts, deterministic conversation
  and message ordering, legacy memory row mapping, Memory V2 trace row mapping,
  audit summary privacy, and read-only DB behavior.
- Package 4 parity target: pure deterministic Memory V2 fixture decisions.
- Package 4 matches the TypeScript built-in evaluation decisions/reasons and
  token normalization behavior on synthetic fixtures.
- Package 5 parity target: pure deterministic Context V2 fixture ordering,
  budget, deduplication, and latest-owner preservation.
- Package 5 matches TypeScript built-in Context V2 fixture results.
- Package 6 parity target: mocked Ollama request/response/error handling and
  provider-free default smoke behavior.
- Package 6 validates `think: false`, Qwen3 defaults, empty-content safe errors,
  thinking stripping, missing-model classification, and default skipped smoke.
- Package 7 parity target: safe synthetic SQLite schema support and
  TypeScript-compatible read summaries after temp writes.
- Package 7 validates deterministic counts, readonly inspection compatibility,
  duplicate protection, and no raw audit payload leakage in summaries.
- Package 8 parity target: candidate conversation runtime safety properties and
  TypeScript-compatible persistence/read summaries.
- Package 8 validates owner-message preservation on model failure, no fake RIN
  reply, no duplicate retry, no thinking persistence, and Memory V2 trace
  creation on success.
- Package 9 parity target: local Console-compatible API surface where practical.
- Package 9 validates local/provider-free readiness, local state, profile
  status, conversation create/send/history, and safe trace status.
- Package 10 parity target: integrated candidate validation across synthetic
  fixtures, temp runtime/API behavior, copied-data read safety, repeated
  deterministic checks, and rollback documentation.
- Package 10 validates DB hash stability, no cutover, no launcher switch, no
  TypeScript removal, and explicit owner-review gates.
- Parity matrix initialized in `PYTHON_PARITY_MATRIX.md`.
- Behavioral parity begins in Package 1 with data contracts and synthetic
  fixtures.

## Unresolved Risks

- `npm install` in the migration worktree previously reported one critical npm
  audit advisory; no automated npm audit repair was run.
- Package 0 intentionally has no production runtime parity.
- Package 1 intentionally does not implement storage/database/provider/runtime
  behavior.
- TypeScript optional fields serialize differently by default in Pydantic; use
  `exclude_none=True` for API responses that need JavaScript `undefined`
  omission semantics.
- Package 2 storage reports include local paths in CLI output because they are
  local diagnostic commands, but they do not include private profile text.
- Package 3 does not run migrations or create missing tables; all access is
  read-only and expects an existing SQLite file.
- Package 4 only implements pure algorithms. It does not write traces, delete
  records, mutate accepted memories, or call providers.
- Package 5 only implements pure context report assembly. It does not read/write
  databases, call providers, or change production context injection.
- Package 6 default checks do not call Ollama or any external provider. Optional
  live smoke remains explicit via `RIN_MODEL_ADAPTER=rin-ollama-local`.
- Package 7 write entry points all call the production-data guard. No override
  exists, and tests assert real `.rin-data` rejection.
- Package 8 calls the same production-data guard before runtime writes and uses
  deterministic mock tests by default. It does not replace the TypeScript
  runtime or production launcher.
- Package 9 app factory is not wired to production launchers. Write routes
  reject non-temp layouts and default to a mock local adapter.
- Package 10 did not write to real `.rin-data`, did not change launchers, did
  not merge to `main`, and did not remove TypeScript Core.
- Package A remains candidate-only and does not alter production launchers,
  TypeScript source, or real data paths.
- Package B preview mode remains temp-only, binds to `127.0.0.1`, and does not
  alter `Start_RIN.command` or `Start_RIN_Local_Model.command`.
- Package C shadow validation copies source data before Python inspection or
  write simulation, hashes the source DB before/after, and prints no private raw
  text.
- Package D dry-run and rollback rehearsal expose no production apply path and
  mutate copied/temp data only.
- Package E verifies Console API compatibility on synthetic temp data and does
  not modify the React Console or production server routing.
- Package F final validation keeps PR #72 draft/unmerged and does not approve
  production cutover.
- Package A main-integration audit finds PR #72 preview-only and non-invasive,
  pending top-level preview wording and final verification before merge.
- Package B documents Python preview at the top level and does not change
  production launchers, TypeScript `src/`, production routing, or real data.
- Package C keeps PR #72 draft, clean, mergeable, and preview-only.
- Package D final verification passed and found no blocker to marking PR #72
  ready for review.
- Package E merged PR #72 into `main` as preview-only. TypeScript remains the
  default production runtime, Python remains preview/candidate, real `.rin-data`
  remains untouched by Python writes, and production cutover remains blocked.

## Exact Next Task

Owner can manually test Python Preview from `main` using
`scripts/python-preview/Start_RIN_Python_Preview.command` or
`npm run rin-python-preview-smoke`. Any production cutover, launcher switch,
real `.rin-data` migration, or TypeScript Core removal still requires a separate
owner-approved PR.
