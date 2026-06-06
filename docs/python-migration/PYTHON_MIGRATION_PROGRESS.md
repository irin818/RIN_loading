# RIN Python Migration Progress

Status: active handoff document.

## Current State

- Current package: Package 0 — Migration Governance and Python Foundation.
- Current checkpoint: Package 0 implementation complete; Python verification
  blocked by missing Python 3.12+ runtime.
- Active branch: `python-rewrite/00-foundation`.
- Target integration branch: `python-rewrite/main`.
- Worktree: `/Users/irin/Documents/RIN_loading_python`.
- TypeScript reference branch: `main`.
- TypeScript reference tag: `v2.0.0`.
- Latest verified migration integration commit:
  `48bcb13 Merge pull request #60 from irin818/codex/v2-progress-complete`.
- Open PR: none yet.

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

## Tests Run

- Python version check: blocked; `python3 --version` returned `Python 3.9.6`
  and no `python3.12`, `python3.13`, `uv`, `pyenv`, or `mise` executable was
  available on PATH.
- Python checks: not run because Package 0 requires Python 3.12+.
- Initial TypeScript `npm run rin:check`: failed at readiness because the new
  migration worktree had no initialized local data directory.
- TypeScript temp-data setup:
  `RIN_DATA_DIR=/tmp/rin-python-ts-ref.HF8OPN npm run rin:init` passed.
- TypeScript reference check:
  `RIN_DATA_DIR=/tmp/rin-python-ts-ref.HF8OPN npm run rin:check` passed.
- TypeScript v2 gate:
  `RIN_DATA_DIR=/tmp/rin-python-ts-ref.HF8OPN npm run rin:v2-check` passed.
- `git diff --check`: passed.

## Parity Status

- Package 0 parity target: no runtime behavior migrated yet.
- Parity matrix initialized in `PYTHON_PARITY_MATRIX.md`.
- Behavioral parity begins in Package 1 with data contracts and synthetic
  fixtures.

## Unresolved Risks

- Python 3.12+ is not installed or available through `uv`, `pyenv`, or `mise` on
  PATH, so Package 0 cannot be auto-merged yet.
- Package 0 intentionally has no production runtime parity.

## Exact Next Task

Install or provide a Python 3.12+ runtime, then run:

```sh
cd python
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -e ".[dev]"
rin-python-check
rin-python-parity-check
rin-python-readiness
rin-python-candidate-check
```

After Python checks pass, review scope, open a PR targeting
`python-rewrite/main`, and merge only if Package 0 gates pass.
