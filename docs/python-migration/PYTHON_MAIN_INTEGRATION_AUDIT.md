# Python Main Integration Audit

Status: Package A final audit for preview-only main integration.

## Scope

- PR: #72 from `python-rewrite/main` to `main`
- Candidate head audited: `ab42b0f`
- Target mode: preview/candidate code on `main`, not production cutover
- Production TypeScript runtime: remains default and rollback path

## Audit Answers

1. Does Python code affect TypeScript default runtime?
   - No. Python code lives under `python/` with root npm wrappers for explicit
     `rin-python-*` commands. The TypeScript `src/` runtime and default Console
     server remain unchanged.
2. Does Python code modify production launchers?
   - No. `Start_RIN.command` and `Start_RIN_Local_Model.command` are not in the
     PR #72 diff. Python preview uses
     `scripts/python-preview/Start_RIN_Python_Preview.command`.
3. Can Python write to real `.rin-data`?
   - Write-capable Python paths are guarded and must reject
     `/Users/irin/Documents/RIN_loading/.rin-data`.
4. Are write guards enforced and tested?
   - Yes. Unit tests cover production path rejection, temp-only writes, preview
     smoke production rejection, copied-data shadow hash stability, dry-run, and
     rollback rehearsal.
5. Are Python dependencies isolated?
   - Yes. Python dependencies are declared in `python/pyproject.toml`; npm
     wrappers call `python/.venv/bin/python`. No global install or production
     TypeScript dependency replacement is required.
6. Are private data files excluded?
   - Yes. `.gitignore` excludes `.rin-data/`, local databases, env files,
     dependency folders, build outputs, caches, logs, and preview/shadow temp
     artifacts. Reports print counts/status only.
7. Are TypeScript checks still passing?
   - Yes. Package F and this audit use temp-data TypeScript checks. TypeScript
     remains provider-free by default.
8. Are API compatibility claims accurate?
   - Yes. Python FastAPI is preview-compatible for core Console flow only. It
     does not claim full Console memory review API parity or production routing.
9. Are preview docs clear?
   - Mostly yes. `PYTHON_PREVIEW_GUIDE.md` is clear; Package B will add top-level
     README/architecture discoverability before main merge.
10. Is production cutover still blocked?
    - Yes. No production apply path exists, production launchers are unchanged,
      and cutover remains explicitly not approved.
11. Is TypeScript Core still rollback fallback?
    - Yes. TypeScript Core is retained, tests are retained, and TypeScript
      remains the default runtime.
12. Is PR #72 safe to merge as preview-only?
    - Yes, pending Package B top-level preview wording and Package D final
      verification. The audited diff is preview-only and non-invasive.

## Required Before Merge

- Add concise top-level README and architecture preview notices.
- Re-run Python candidate, preview, shadow, dry-run, rollback, and API contract
  checks.
- Re-run TypeScript temp-data checks.
- Recheck PR #72 diff for no production launcher changes, no TypeScript Core
  deletion, no private data, and no real-data artifacts.

## Explicit Non-Goals

- No production cutover.
- No default backend switch.
- No real `.rin-data` migration.
- No TypeScript Core removal.
- No external API calls.
