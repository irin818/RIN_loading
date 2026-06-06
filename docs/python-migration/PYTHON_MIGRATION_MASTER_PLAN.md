# RIN Python Migration Master Plan

Status: active Python migration control document.

## Objective

Build a production-ready Python RIN core candidate while preserving the
TypeScript RIN v2.0 implementation as the reference and rollback path.

The Python candidate will eventually cover storage, database access, profiles,
Memory V2, Context V2, model adapters, Ollama/Qwen3, conversation runtime, CLI
commands, and a FastAPI-compatible local API.

## Branch And Worktree Model

- Stable reference branch: `main`
- Python integration branch: `python-rewrite/main`
- Package branches: `python-rewrite/<package-name>`
- Migration worktree: `/Users/irin/Documents/RIN_loading_python`
- Stable TypeScript worktree: `/Users/irin/Documents/RIN_loading`

Normal migration package PRs target `python-rewrite/main`, not `main`.

## Safety Boundaries

- Do not delete, overwrite, or replace TypeScript core source during migration.
- Do not switch production launchers to Python.
- Do not modify `/Users/irin/Documents/RIN_loading/.rin-data`.
- Do not run write tests against the owner's real SQLite database.
- Do not commit local data, databases, logs, `.env`, credentials, or private
  owner records.
- Default Python checks must remain provider-free.

## Package Sequence

1. Package 0: migration governance and Python foundation.
2. Package 1: data contracts and Pydantic models.
3. Package 2: storage and profile read-only compatibility.
4. Package 3: SQLite read-only repository.
5. Package 4: Memory V2 pure algorithm migration.
6. Package 5: Context V2 pure algorithm migration.
7. Package 6: Ollama/Qwen3 model adapter.
8. Package 7: temporary-data write repositories and migrations.
9. Package 8: Python conversation runtime candidate.
10. Package 9: FastAPI compatibility layer.
11. Package 10: candidate integration, shadow validation, and cutover plan.

## Package 0 Contract

Package 0 may create `python/`, migration docs, safe temporary-data helpers,
Python check commands, and root npm wrappers for those commands.

Package 0 must not modify `src/`, TypeScript migrations, production launchers,
`package-lock.json`, or real `.rin-data`.
