# AGENTS.md

## 1. Project Identity

Project name: RIN.

RIN is a local-first, single-owner, long-running personal AI system. Its identity, memory, user model, AI identity model, policy, state, and continuity must remain locally governed.

RIN is not a generic chatbot, SaaS product, Live2D toy, or simple API wrapper.

---

## 2. Authority

This file is the first project-local instruction file for AI-assisted development.

All coding agents must read AGENTS.md before planning or editing.

If another file conflicts with this file, follow AGENTS.md first and report the conflict.

---

## 3. Startup Reading Order

For development tasks, read only what is necessary:

1. AGENTS.md
2. PROJECT_CHARTER.md
3. DEVELOPMENT_PROTOCOL.md
4. ARCHITECTURE.md only for architecture, runtime, module-boundary, or data-flow work
5. task-relevant source files

Do not read README.md by default. README.md is for owner/developer usage documentation. Read it only when the task explicitly concerns setup, usage, public behavior, or documentation.

Do not read or recreate deleted legacy docs, including:

- docs/RIN_V2_MASTER_PLAN.md
- docs/RIN_V2_PROGRESS.md
- docs/RIN_V2_DECISIONS.md
- old per-task design notes
- old per-task summary reports
- old TypeScript transition reports

---

## 4. Current Project State

RIN is currently a Python-first project.

Active areas:

- source: python/src/rin/
- tests: python/tests/
- Python config: python/pyproject.toml
- local UI: FastAPI + Jinja2 + static CSS/JavaScript
- launcher: Start_RIN.command
- local data: .rin-data/
- model strategy: local-model-first through provider-neutral adapters

Do not restore old TypeScript, React, Vite, Node, or npm runtime systems.

---

## 5. Core Principles

Preserve these principles:

- local-first
- single-owner
- slow variables control fast variables
- model output is advice, not authority
- model providers are replaceable
- memory, identity, policy, state, and owner model are slow variables
- external APIs are optional expert/fallback providers, not identity sources
- UI, runtime, model, memory, storage, policy, diagnostics, and body/Live2D boundaries must stay clear
- make small, coherent, testable changes
- keep the project runnable
- report uncertainty and failed/skipped checks honestly

---

## 6. Protected Files

Protected files:

- AGENTS.md
- PROJECT_CHARTER.md
- DEVELOPMENT_PROTOCOL.md
- ARCHITECTURE.md
- README.md
- .gitignore

Do not overwrite, delete, rename, or simplify them unless the task explicitly includes governance, documentation, architecture, or repository hygiene work.

---

## 7. Active Non-Goals

Do not implement, restore, or expand these unless the owner explicitly reopens the scope:

- backup
- restore
- migration
- synchronization
- device state switching
- Agent State Bundle import/export
- autonomous agent execution
- planner/task autonomy
- MCP runtime execution
- tool-execution framework
- L0-L5 permission hierarchy
- TypeScript/React/Vite runtime
- real Live2D Cubism .moc3 loading
- complete Live2D behavior system
- multi-user accounts
- SaaS backend
- cloud identity source
- hard-coded API keys
- UI-direct model provider calls
- automatic long-term memory writes without review

These are deferred, not permanently forbidden.

---

## 8. Source Boundaries

Use these boundaries unless existing local structure is more specific:

- python/src/rin/server/: FastAPI, UI, templates, static files
- python/src/rin/conversation/: conversation runtime
- python/src/rin/model/: provider-neutral model adapters
- python/src/rin/memory/: memory proposal, review, retrieval
- python/src/rin/storage/: local file layout
- python/src/rin/database/: SQLite persistence
- python/src/rin/profiles/: user model and AI identity model
- python/src/rin/policy/: local policy checks
- python/src/rin/diagnostics/: readiness and diagnostics
- python/src/rin/body/: body/Live2D boundary
- python/tests/: tests

Do not mix concerns without explicit architecture work.

---

## 9. Documentation Policy

Avoid large stale documentation.

docs/ is optional and may be absent.

Do not create per-task reports, old progress files, repeated handoff logs, or large historical summaries by default.

Final reports should normally stay in chat replies or PR descriptions.

---

## 10. Temporary Files and Secrets

Temporary files are allowed only when necessary.

Preferred temporary locations:

- /tmp/rin-*
- tmp/
- temp/

Before final report, delete temporary files created by the task unless there is a clear reason to keep them.

Never commit:

- .env
- .env.*
- API keys
- tokens
- credentials
- private keys
- certificates
- local databases
- local conversation data
- local memory data
- .rin-data/
- logs containing private data
- generated exports
- backup bundles
- caches
- dependency folders
- .DS_Store

Do not print secrets in logs, summaries, commits, PRs, or reports.

---

## 11. Git Workflow

Default rules:

- main is stable.
- Do not work directly on main unless explicitly requested.
- Use small scoped branches.
- Prefer PRs for reviewable work.
- Do not merge PRs unless explicitly requested.
- Do not force-push or rewrite shared history unless explicitly requested.

Suggested branch prefixes:

- codex/
- cursor/
- governance/
- docs/
- fix/
- feature/

Keep commits small and coherent. Do not include unrelated cleanup, generated files, local data, or secrets.

If unexpected user changes exist, do not overwrite them. Inspect if relevant and report them.

---

## 12. Checks

Run checks relevant to the changed files.

For Python runtime changes, prefer:

```sh
cd python
python -m pytest
python -m ruff check .
python -m ruff format --check .
python -m mypy src
rin-python-candidate-check
rin-python-production-check
```

For local model adapter changes, also run when available:

```sh
RIN_PYTHON_CHECK_LOCAL_MODEL=1 rin-python-production-check
RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_MODEL=qwen3:4b RIN_OLLAMA_TIMEOUT_MS=180000 rin-python-local-chat-smoke
```

For docs/governance-only changes, at minimum run when possible:

```sh
git diff --check
git status --short
```

Never claim a check passed if it was not run.

---

## 13. High-Risk Areas

Treat these as high-risk:

- memory writes
- accepted-memory retrieval
- context injection
- prompt/context assembly
- conversation persistence
- raw conversation logs
- profile and identity handling
- database schema and migrations
- local data handling
- model adapter boundaries
- policy enforcement
- external side effects
- future tool/integration boundaries
- body/Live2D control
- backup/migration/sync assumptions

For high-risk areas, inspect relevant tests, make small changes, preserve invariants, and report risks.

---

## 14. Final Report Format

End each development task with:

```md
### Summary
- What was done.

### Changed Files
- `path`: reason.

### Tests / Checks
- `command`: result.
- Skipped checks, if any, with reason.

### Git / GitHub
- Branch:
- Commit:
- Push status:
- PR status:

### Risks
- Remaining risks, assumptions, or uncertainty.

### Next Step
- Recommended next action.
```