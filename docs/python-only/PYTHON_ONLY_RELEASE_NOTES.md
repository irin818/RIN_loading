# Python-Only Release Notes

Status: Package G final verification candidate.

## Release

Target tag: `python-only-v1.0.0`

## Summary

RIN active runtime is now Python-only:

- Python FastAPI web UI is the active owner-facing Console.
- Python launchers are the only active root launchers.
- TypeScript Core, React/Vite UI, Node package config, and TypeScript tests were
  removed from the active tree.
- Rollback is preserved through `typescript-final-fallback`.

## Completed Packages

- D0: TypeScript deletion blocker inventory.
- D1: Python Console completion.
- D2: Body/Live2D retirement or minimal replacement.
- D3: Operational/reporting retirement.
- D4: Safe TypeScript Core deletion.
- E: Python layout decision.
- F: Old migration worktree cleanup.
- G: Final verification and release tag.

## Verification

Final verification must pass:

- Python tests;
- Ruff lint and format check;
- mypy;
- production and candidate checks;
- optional local model checks when Ollama/Qwen3 is available;
- residue scan;
- private-data and hidden-control-character scan.
