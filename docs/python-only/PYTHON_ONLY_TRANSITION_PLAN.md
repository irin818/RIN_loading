# Python-Only Transition Plan

Status: active transition plan after TypeScript Core deletion.

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
- TypeScript source, React/Vite UI, Node scripts, and TypeScript tests have been
  removed from the active tree.

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
- TypeScript fallback launchers were temporarily moved to
  `scripts/typescript-fallback/`, then removed in D4 when TypeScript source and
  Node configuration were deleted.
- Fallback is documented through `typescript-final-fallback`.

See:

- `docs/python-only/PYTHON_ONLY_OPERATION_GUIDE.md`
- `docs/python-only/TYPESCRIPT_FALLBACK_GUIDE.md`

### Package D: Remove TypeScript Core

Status: completed.

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
- D3 operational/reporting decision: completed; remaining TypeScript reports are
  Python-replaced, explicitly retired, or fallback-only through the final
  TypeScript tag.
- D4 deletion: completed; rollback is tag-only because current-tree TypeScript
  fallback scripts depended on deleted TypeScript source and Node config.

### Package E: Repository Restructure

Status: completed with no move.

- kept `python/src/rin`, `python/tests`, and `python/pyproject.toml`;
- avoided a broad path/venv/launcher rewrite immediately after TypeScript
  deletion;
- documented future move criteria in
  `docs/python-only/REPOSITORY_RESTRUCTURE_DECISION.md`.

### Package F: Worktree Cleanup

Status: completed.

The old `/Users/irin/Documents/RIN_loading_python` migration worktree was clean,
removed with `git worktree remove`, and pruned. See
`docs/python-only/WORKTREE_CLEANUP_GUIDE.md`.

### Package G: Final Python-Only Verification

Status: completed after final verification.

Final docs:

- `docs/python-only/PYTHON_ONLY_RELEASE_NOTES.md`
- `docs/python-only/PYTHON_ONLY_ARCHITECTURE.md`
- `docs/python-only/PYTHON_ONLY_KNOWN_LIMITATIONS.md`
- `docs/python-only/TYPESCRIPT_RESIDUE_REPORT.md`

Final checks passed and `python-only-v1.0.0` may be tagged from merged `main`.

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

Proceed to Package E repository restructure or document why the current
`python/` layout should remain.
