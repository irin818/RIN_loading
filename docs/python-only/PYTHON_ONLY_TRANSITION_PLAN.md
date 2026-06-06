# Python-Only Transition Plan

Status: active transition plan.

## Goal

Move RIN as close as safely possible to a Python-only project while preserving:

- real `.rin-data`;
- verified backup bundles;
- Git history;
- rollback through `typescript-final-fallback`;
- test coverage for deleted behavior.

## Current State

- Python is the recommended primary launch path.
- Real-data Python cutover is complete.
- `python-core-v1.0.0` exists.
- `typescript-final-fallback` exists and has been pushed.
- TypeScript source, React/Vite UI, Node scripts, and TypeScript tests remain in
  the repository.

## Package Sequence

### Package A: Retirement Audit

Completed by:

- inventorying TypeScript/Node files;
- classifying deletion readiness;
- creating and pushing `typescript-final-fallback`;
- documenting blockers.

Deletion status: blocked pending Python UI replacement.

### Package B: Python UI / Console Replacement

Status: completed with Route 1.

Implemented route: FastAPI-served HTML UI with no React/Vite dependency.

Implemented features:

- local-only `127.0.0.1`;
- chat input and response display;
- conversation history display;
- readiness/status display;
- profile summary display;
- visible error display;
- local Ollama mode support;
- no external API calls.

See `docs/python-only/PYTHON_UI_CONSOLE_DECISION.md`.

### Package C: Python Launchers Become Sole Active Launchers

Status: completed.

- Python launchers remain at root.
- TypeScript fallback launchers moved to `scripts/typescript-fallback/`.
- Fallback is documented through `typescript-final-fallback`.

See:

- `docs/python-only/PYTHON_ONLY_OPERATION_GUIDE.md`
- `docs/python-only/TYPESCRIPT_FALLBACK_GUIDE.md`

### Package D: Remove TypeScript Core

Allowed only after:

- Python UI works;
- Python tests replace deleted TypeScript coverage;
- fallback tag exists;
- Python production check passes;
- TypeScript fallback is documented.

Remove only files proven replaced.

Blocker status:

- D1 Python Console coverage: completed.
- D2 body/Live2D decision: completed; current active TypeScript body runtime is
  retired and a minimal Python body report exists.

### Package E: Repository Restructure

After TypeScript removal:

- decide whether to keep `python/src/rin` or move to top-level `rin/`;
- move tests/config only if imports and package metadata remain stable;
- do not move `.rin-data` or backup bundles.

### Package F: Worktree Cleanup

Document or remove `/Users/irin/Documents/RIN_loading_python` only after clean
worktree checks.

### Package G: Final Python-Only Verification

Add `rin-check`, run all Python checks, safety scans, and local model readiness
when available. Tag `python-only-v1.0.0` only after passing.

### Package H: TypeScript Residue Audit

Prove whether any TypeScript/Node residue remains. Classify as:

- none;
- historical docs only;
- fallback scripts only;
- active dependency;
- blocker.

## Stop Conditions

Stop before deletion if:

- Python UI cannot replace the TypeScript Console;
- Python cannot read/write migrated `.rin-data`;
- fallback tag is missing;
- tests fail;
- private data appears in Git;
- a file is uncertain.

## Next Step

Implement Package B Python UI / Console replacement before removing any
TypeScript UI or Node/Vite files.
