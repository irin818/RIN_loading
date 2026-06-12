# RIN Python Test Suite

This suite validates the Python backend/core RIN runtime without touching `.rin-data`.
Tests create temporary layouts under `/tmp/rin-python-*` and remove them after use.

## Layout

- `tests/unit/`: focused unit and API compatibility tests.
- `tests/e2e/`: full FastAPI + SQLite + runtime flow tests with mock adapters.
- `tests/perf/`: lightweight benchmark-style regression tests with generous limits.
- `tests/parity/`: current parity checks for the Python foundation.

## Coverage

`python -m pytest` runs coverage by default through `pytest-cov`.

Required thresholds:

- overall package line coverage: at least 80%;
- `src/rin/context/v2.py`: at least 90%;
- `src/rin/memory/v2.py`: at least 90%;
- `src/rin/conversation/runtime.py`: at least 90%.

Run the focused per-file threshold check after pytest:

```sh
python scripts/check_coverage_thresholds.py coverage.json
```

## Common Commands

```sh
python -m pytest
python -m ruff check .
python -m ruff format --check .
python -m mypy src
rin-python-candidate-check
rin-python-production-check
```

## Mock Strategy

Fast tests use provider-free mock adapters. They verify persistence, sanitization,
runtime trace metadata, memory trace decisions, and API contracts without calling
external model providers.

## Local Model Smoke

Local model chat smoke checks are removed from the active development workflow.
Local models are reserved for future non-chat features only (OCR, vision,
speech, classification, local preprocessing, offline utilities). They are
not part of the current active chat path.
