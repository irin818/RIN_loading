# RIN Python Migration Progress

Status: active handoff document.

## Current State

- Current package: Package 2 — Storage and Profile Read-Only Compatibility.
- Current checkpoint: Package 2 implementation and checks passed; PR creation
  pending.
- Active branch: `python-rewrite/02-storage-profiles-readonly`.
- Target integration branch: `python-rewrite/main`.
- Worktree: `/Users/irin/Documents/RIN_loading_python`.
- TypeScript reference branch: `main`.
- TypeScript reference tag: `v2.0.0`.
- Latest verified TypeScript reference commit:
  `48bcb13 Merge pull request #60 from irin818/codex/v2-progress-complete`.
- Latest verified migration integration commit:
  `dd17807 Merge pull request #62 from irin818/python-rewrite/01-data-contracts`.
- Open PR: none for Package 2 yet.

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

## Exact Next Task

Commit Package 2, push `python-rewrite/02-storage-profiles-readonly`, open a PR
targeting `python-rewrite/main`, review and merge only if gates pass, then
continue to Package 3.
