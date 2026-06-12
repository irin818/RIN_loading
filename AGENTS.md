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
2. PROJECT_CHARTER.md only for governance, architecture, identity, memory, policy, model layer, storage, data safety, Live2D/body, integration, or high-risk work
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

RIN architecture:

- Python backend/core (protected):
  - identity/profile policy
  - memory system
  - SQLite storage access
  - runtime/agent loop
  - provider-neutral model adapters
  - sanitizer
  - runtime trace
  - tool orchestration
  - API routes
- TypeScript/React/Vite frontend (first-class):
  - Glitch Core Multi-Window Console
  - Web UI
  - window system
  - visual state
  - API client
- SQLite: local long-term memory store
- Launcher: Start_RIN.command
- Local data: .rin-data/

Active source areas:

- Python source: python/src/rin/
- Python tests: python/tests/
- Python config: python/pyproject.toml
- Frontend source: frontend/src/
- Frontend config: frontend/package.json, frontend/vite.config.ts, frontend/tsconfig.json

Do not restore old deleted TypeScript runtime systems from earlier project phases. The current React/Vite frontend is not a restoration of those systems.

---

## 5. Core Principles

Preserve these principles:

- local-state-first
- single-owner
- slow variables control fast variables
- model output is advice, not authority
- model providers are replaceable fast variables
- memory, identity, policy, state, and owner model are locally governed slow variables
- external API models are the only active chat reasoning providers, not identity sources
- local models are reserved for future non-chat features only (OCR, vision, speech, classification, local preprocessing, offline utilities)
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
- real Live2D Cubism .moc3 loading
- complete Live2D behavior system
- multi-user accounts
- SaaS backend
- cloud identity source
- hard-coded API keys
- UI-direct model provider calls
- automatic long-term memory writes without review
- local model chat provider or local model chat fallback
- frontend direct external API provider calls
- local model inference for chat dialogue

These are deferred, not permanently forbidden.

Local models may be reserved for future non-chat features only:
OCR, vision, speech, classification, local preprocessing, and offline
utilities.  These are not active scope unless explicitly reopened.

---

## 8. Source Boundaries

Use these boundaries unless existing local structure is more specific:

- python/src/rin/server/: FastAPI, UI, templates, static files
- python/src/rin/conversation/: conversation runtime
- python/src/rin/model/: provider-neutral model adapters (external API chat only; no local chat provider unless explicitly reopened)
- python/src/rin/memory/: memory proposal, review, retrieval
- python/src/rin/context/: context assembly, context budgeting, and context reports
- python/src/rin/storage/: local file layout
- python/src/rin/database/: SQLite persistence
- python/src/rin/profiles/: user model and AI identity model
- python/src/rin/policy/: local policy checks
- python/src/rin/diagnostics/: readiness and diagnostics
- python/src/rin/body/: body/Live2D boundary
- python/tests/: tests

Do not mix concerns without explicit architecture work.

---

## 9. Frontend Rules

React/Vite/TypeScript frontend work is allowed and expected.

Rules:

- Frontend work should normally stay inside frontend/.
- Frontend must call backend APIs, not internal Python modules directly.
- Frontend must not call external model providers directly.
- Frontend must not read secrets or environment variables directly.
- Frontend must not write directly to SQLite or mutate memory storage.
- Frontend must not expose hidden reasoning, raw unsafe model output, API keys, or secret config.
- Frontend-only layout/UI state persistence is allowed inside frontend/ when it does not depend on backend schema.
- develop web app style tooling may be used when available.

Before completing frontend work, run when applicable:

```sh
cd frontend
npm run typecheck
npm run build
```

---

## 10. Backend Protection Rules

Protected backend areas require stronger caution:

- memory core (python/src/rin/memory/)
- provider abstraction (python/src/rin/model/)
- sanitizer logic
- runtime trace core (python/src/rin/diagnostics/)
- identity/profile policy (python/src/rin/profiles/)
- storage schema (python/src/rin/storage/, python/src/rin/database/)
- database migrations
- secrets and config files

Lightweight read-only API endpoints are allowed when needed by the frontend, provided they:

- do not change core logic
- do not change schema
- do not expose secrets
- do not expose hidden reasoning
- return safe metadata only

---

## 11. API Boundary Rules

Frontend/backend interaction must use explicit API contracts.

Rules:

- New UI data needs should first be expressed as route/schema contracts.
- API responses must be safe for display.
- Runtime trace endpoints must expose safe metadata only.
- Provider status endpoints must expose configured/health/model metadata but not keys or tokens.
- Memory endpoints should be read-only unless explicit memory-management work is requested.
- Frontend must not import or depend on internal Python modules.

---

## 12. Governance Document Rules

Governance files are protected slow-variable documents.

Rules:

- Do not casually edit governance files during feature work.
- Governance changes should be isolated in dedicated governance tasks unless explicitly requested.
- AGENTS.md has the highest priority among project-local instruction files.
- If governance files conflict, prefer the more recent explicit architecture: Python-core + TypeScript/React frontend.
- Governance files:
  - AGENTS.md — highest priority, first-read for AI agents
  - PROJECT_CHARTER.md — long-term principles
  - DEVELOPMENT_PROTOCOL.md — development workflow
  - ARCHITECTURE.md — runtime architecture
  - README.md — human usage guide

---

## 13. Documentation Policy

Avoid large stale documentation.

docs/ is optional and may be absent.

Do not create per-task reports, old progress files, repeated handoff logs, or large historical summaries by default.

Final reports should normally stay in chat replies or PR descriptions.

---

## 14. Temporary Files and Secrets

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

## 15. Git Workflow

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
- claude/
- governance/
- docs/
- fix/
- feature/

Keep commits small and coherent. Do not include unrelated cleanup, generated files, local data, or secrets.

If unexpected user changes exist, do not overwrite them. Inspect if relevant and report them.

---

## 16. Low-Cost Agent Policy

For Claude Code / DeepSeek usage, prefer these defaults:

- keep tasks small and file-scoped;
- do not scan the whole repo by default;
- read only files required by the task;
- prefer targeted shell checks over full tests unless runtime behavior changed;
- do not run expensive checks without a concrete reason;
- do not push, merge, or create PRs unless requested.

---

## 17. Checks

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

For frontend changes, run when applicable:

```sh
cd frontend
npm run typecheck
npm run build
```

For docs/governance-only changes, at minimum run when possible:

```sh
git diff --check
git status --short
```

Never claim a check passed if it was not run.

---

## 18. High-Risk Areas

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

## 19. Final Report Format

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