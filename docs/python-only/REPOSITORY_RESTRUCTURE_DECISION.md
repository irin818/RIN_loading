# Repository Restructure Decision

Status: Package E complete.

## Decision

Keep the active Python package under `python/` for now.

Do not move:

- `python/src/rin` to `rin/`;
- `python/tests` to `tests/`;
- `python/pyproject.toml` to `pyproject.toml`.

## Reason

The repository is now Python-only for active runtime, but the current `python/`
layout is the safer stable layout immediately after TypeScript deletion because:

- existing launchers use `python/.venv/bin/python`;
- the editable install is already created inside `python/.venv`;
- Python migration/cutover docs and commands already use `cd python`;
- production checks are passing with this layout;
- moving package roots would change imports, entry points, docs, launchers, and
  local venv assumptions in one broad structural change.

## Current Active Structure

```text
RIN_loading/
├── python/
│   ├── pyproject.toml
│   ├── src/rin/
│   └── tests/
├── docs/
├── public/
├── live2d-development/
├── Start_RIN.command
├── AGENTS.md
├── ARCHITECTURE.md
├── DEVELOPMENT_PROTOCOL.md
├── PROJECT_CHARTER.md
└── README.md
```

## Future Move Criteria

Move to top-level `rin/`, `tests/`, and `pyproject.toml` only in a dedicated
structural package after:

- current Python-only release is tagged;
- launchers are updated and tested against the new venv location;
- docs no longer refer to `cd python`;
- editable install and console scripts are regenerated from the new root.

## Checks Required If Moved Later

- `python -m pytest`
- `python -m ruff check .`
- `python -m ruff format --check .`
- `python -m mypy .`
- `rin-python-production-check`
- local model smoke when available
