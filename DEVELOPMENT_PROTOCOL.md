# DEVELOPMENT_PROTOCOL.md

## 1. Purpose

This file defines practical development procedures for RIN.

It does not define project identity, long-term goals, architecture, or agent startup order.

For those, use:

- AGENTS.md for agent execution rules;
- PROJECT_CHARTER.md for project principles;
- ARCHITECTURE.md for runtime structure.

---

## 2. Basic Workflow

For each task:

1. Confirm task scope.
2. Inspect only relevant files.
3. Check Git status.
4. Make minimal coherent changes.
5. Run relevant checks.
6. Clean task-created temporary files.
7. Report results using the format in AGENTS.md.

Do not perform unrelated cleanup or broad rewrites.

---

## 3. Git Procedure

Before editing:

```sh
git status --short
git branch --show-current
```

Use a scoped branch unless the owner explicitly requests direct work on main.

Recommended branch prefixes:

```text
governance/
docs/
fix/
feature/
codex/
cursor/
```

Commit rules:

- commit small coherent changes;
- use clear commit messages;
- keep governance changes separate from runtime changes when practical;
- do not commit generated files, local data, logs, dependencies, or secrets.

Do not force-push, rewrite shared history, merge PRs, or delete active branches unless explicitly requested.

---

## 4. Handling Existing Changes

If there are unexpected existing changes:

1. Do not overwrite them.
2. Inspect them only if relevant.
3. Adapt the task to avoid conflict.
4. Report them in the final report.

Owner edits are valid project state, not errors.

---

## 5. Python Checks

For Python runtime changes, run from python/ when available:

```sh
python -m pytest
python -m ruff check .
python -m ruff format --check .
python -m mypy src
rin-python-candidate-check
rin-python-production-check
```

For targeted changes, targeted tests are acceptable when full checks are expensive.

## 6. Frontend Checks

For frontend changes, run from frontend/ when applicable:

```sh
cd frontend
npm run typecheck
npm run build
```

For local model adapter changes, also run when available:

```sh
RIN_PYTHON_CHECK_LOCAL_MODEL=1 rin-python-production-check
RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_MODEL=qwen3:4b RIN_OLLAMA_TIMEOUT_MS=180000 rin-python-local-chat-smoke
```

Never claim a check passed if it was not run.

---

## 7. Documentation / Governance Checks

For documentation-only or governance-only changes, run when possible:

```sh
git diff --check
git status --short
```

Do not run expensive runtime checks unless the documentation change affects commands, runtime assumptions, or architecture.

---

## 8. Failure Handling

When a check fails:

1. Identify whether the failure is caused by the current task.
2. Fix it only if it is in scope.
3. Do not perform broad unrelated fixes.
4. Report the exact failed command and a short failure summary.

If the environment is missing or a check cannot run, report the reason.

---

## 9. Temporary Files

Temporary files should be created only when necessary.

Preferred locations:

```text
/tmp/rin-*
tmp/
temp/
```

Before finishing:

- remove task-created temporary files unless needed;
- report any temporary files intentionally kept;
- do not commit temporary outputs.

---

## 10. Local Data and Secret Safety

Before committing, ensure no private or local-only files are included.

Never commit:

- .env
- .env.*
- API keys
- tokens
- credentials
- local databases
- .rin-data/
- private logs
- local conversation data
- local memory data
- backups
- exports
- dependency folders
- cache folders
- .DS_Store

If a secret appears in tracked files, stop and report it.

---

## 11. Data-Sensitive Changes

For changes touching local data, database schema, memory, identity, profile, context assembly, or persistence:

- inspect relevant tests first;
- keep the change small;
- preserve existing data;
- add or update tests when behavior changes;
- report remaining risk clearly.

Do not delete, migrate, overwrite, or transform local owner data unless explicitly requested and safe.

---

## 12. Completion

Use the final report format defined in AGENTS.md.

Do not duplicate the report template here.