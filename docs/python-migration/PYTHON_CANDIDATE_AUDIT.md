# Python Candidate Audit

Status: Package A audit completed for review.

## Audit Scope

- Python source: `python/src/rin/`
- Python tests: `python/tests/`
- Python package config: `python/pyproject.toml`
- Migration docs: `docs/python-migration/`
- Draft candidate PR: #72
- TypeScript reference areas: `src/storage/`, `src/database/`, `src/profile/`,
  `src/memory/`, `src/context/`, `src/model/`, `src/conversation/`,
  `src/server/`, and `src/cli/`

## Area Classification

| Area | Classification | Notes |
|---|---|---|
| Storage compatibility | compatible | Read-only manifest/layout/core-file parsing is covered by synthetic fixtures. |
| Profile compatibility | compatible | Load/validate/report paths are read-only and do not print full profile text. |
| SQLite read compatibility | compatible | Read-only `mode=ro` repository covers schema, conversations, messages, legacy memory, Memory V2 traces, and audit summaries. |
| Temp-only write safety | complete | Write entry points guard `/tmp/rin-python-*`; production `.rin-data` rejection is tested. |
| Memory V2 behavior | compatible | Pure deterministic fixture behavior matches approved TypeScript decisions; production write policy remains candidate-only. |
| Context V2 behavior | compatible | Pure ordering, deduplication, budget, provenance, and protected segment behavior are covered. |
| Ollama/Qwen3 behavior | compatible | Local-only adapter sends `think: false`, strips thinking tags, rejects empty/reasoning-only content, and reports safe errors. |
| Conversation runtime behavior | candidate-only | Temp-only runtime preserves owner messages on failure and writes no fake reply; not production backend. |
| FastAPI compatibility | partial | Local-only app factory supports preview contracts but does not yet fully replace TypeScript Console APIs. |
| CLI completeness | partial | Core candidate checks exist; preview, shadow, dry-run, rollback, and API contract commands are post-candidate tasks. |
| Error semantics | compatible | Model/runtime errors are structured and safe; API compatibility will expand Console-shaped errors later. |
| Timing metrics | candidate-only | Package A adds safe elapsed runtime timing in API/runtime results; durable timing event tables remain TypeScript-only. |
| Safety guard behavior | complete | Production data path rejection and temp-data acceptance are covered by tests. |
| Documentation accuracy | compatible | Package A updates stale Package 10 handoff state and parity classifications. |

## Gap Closure

- Added safe `elapsedMs` timing to Python conversation runtime results for
  completed and failed turns.
- Updated migration progress to reflect that Package 10 is merged into
  `python-rewrite/main` and PR #72 is the current draft review PR.
- Updated parity status for audit events and timing metrics.

## Not Production Ready

- Python is not the default backend.
- Production launchers remain TypeScript.
- Real `.rin-data` migration is not approved.
- PR #72 remains draft and unmerged.
- TypeScript Core remains the rollback path.
