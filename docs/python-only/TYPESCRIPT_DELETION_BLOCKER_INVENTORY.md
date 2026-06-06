# TypeScript Deletion Blocker Inventory

Status: Package D0 inventory. No code deletion is approved by this document.

D4 update: TypeScript Core, React/Vite UI, Node configuration, and TypeScript
fallback scripts have since been removed from the active tree. Rollback is now
through the `typescript-final-fallback` tag.

## Baseline

- Branch: `python-only/04a-deletion-blocker-inventory`
- Main baseline: `b679634`
- Root active launchers: Python-only.
- TypeScript fallback tag: `typescript-final-fallback`
- TypeScript fallback scripts: `scripts/typescript-fallback/`
- Python production check: passed.
- TypeScript fallback check: passed on initialized temporary data.

## Remaining Artifact Inventory

The residue scan found 229 tracked TypeScript/Node artifacts, excluding
generated/dependency folders such as `dist/`, `node_modules/`, and
`python/.venv/`.

### Root Node/TypeScript Tooling

| Artifact | Classification | Decision |
|---|---|---|
| `package.json` | active TypeScript core | Delete only after D4 removes `src/` and TypeScript scripts; keep through D1-D3 for fallback validation. |
| `package-lock.json` | active TypeScript core | Delete with `package.json` only after no active Node commands remain. |
| `tsconfig.json` | active TypeScript core | Safe to delete only with TypeScript source. |
| `tsconfig.app.json` | active TypeScript core | Safe to delete only with TypeScript source. |
| `tsconfig.node.json` | active TypeScript core | Safe to delete only with TypeScript source/scripts. |
| `vite.config.ts` | active React/Console UI | Delete after React Console is retired/replaced. |
| `vitest.config.ts` | test-only | Delete after TypeScript tests are removed/replaced/retired. |
| `eslint.config.js` | active TypeScript core | Delete after Node/TypeScript lint path is removed. |

### TypeScript Source Groups

| Path | Count | Classification | Decision |
|---|---:|---|---|
| `src/backup/` | 5 `.ts` | operational/reporting | D3 must mark TypeScript backup/restore commands fallback-only or obsolete before deletion. |
| `src/body/` | 12 `.ts` | requires explicit retirement | D2 must retire or replace body/Live2D runtime surfaces. |
| `src/bundle/` | 4 `.ts` | operational/reporting | D3 must retire old TS export/import bundle path or replace in Python if still needed. |
| `src/cli/` | 51 `.ts` | legacy CLI/report commands | D3 must classify command-by-command as Python-replaced, obsolete, or fallback-only. |
| `src/config/` | 3 `.ts` | active TypeScript core | Delete with TypeScript runtime after Python config path is confirmed sufficient. |
| `src/console/` | 1 `.ts` | active React/Console UI | D1 must cover current owner-facing console needs in Python. |
| `src/context/` | 10 `.ts` | active TypeScript core/test-only | Mostly Python-replaced; D3/D4 must preserve Python context tests before deletion. |
| `src/conversation/` | 9 `.ts` | active TypeScript core/test-only | Mostly Python-replaced; D1 must verify UI/runtime error behavior before deletion. |
| `src/core/` | 1 `.ts` | active TypeScript core | Delete with TypeScript runtime. |
| `src/database/` | 7 `.ts` | active TypeScript core | Python SQLite path exists; delete only after D4 confirms no active Node dependency. |
| `src/live2d/` | 2 `.ts` | requires explicit retirement | D2 must retire future Live2D runtime TS surface or add minimal Python placeholder. |
| `src/memory/` | 44 `.ts` | operational/reporting/test-only | Core algorithms mostly Python-replaced; D3 must retire broader semantic/report commands. |
| `src/model/` | 20 `.ts` | operational/reporting/test-only | Python has Ollama/local adapter; D3 must retire external-provider TS smoke paths. |
| `src/policy/` | 2 `.ts` | active TypeScript core | Python policy coverage is minimal; delete only if current Python production does not require this TS path. |
| `src/profile/` | 3 `.ts` | active TypeScript core/test-only | Python profile report exists; D1/D3 must verify UI/report coverage. |
| `src/project/` | 5 `.ts` | operational/reporting | D3 must retire old project report/rollback note commands or replace if still needed. |
| `src/rawLog/` | 1 `.ts` | active TypeScript core | Delete with TS runtime after no active Node dependency. |
| `src/readiness/` | 3 `.ts` | operational/reporting | Python readiness exists; D3 can classify TS readiness as fallback-only. |
| `src/reliability/` | 3 `.ts` | operational/reporting | D3 must retire old reliability report surfaces. |
| `src/runtime/` | 1 `.ts` | active TypeScript core | Delete with TS runtime after Python runtime is accepted. |
| `src/server/` | 3 `.ts` | active React/Console UI | D1 must verify Python UI replaces owner-facing server behavior. |
| `src/slowVariables/` | 2 `.ts` | active TypeScript core | Delete with TS runtime after Python storage/profile coverage is accepted. |
| `src/state/` | 2 `.ts` | active TypeScript core | Delete with TS runtime if current Python production does not use TS state. |
| `src/storage/` | 7 `.ts` | active TypeScript core | Python storage exists; delete only after D4 confirms no active Node dependency. |
| `src/sync/` | 3 `.ts` | operational/reporting | D3 must retire old sync reports or keep fallback-only via tag. |
| `src/tests/` | 2 `.ts` | test-only | Delete with TS tests after Python checks cover governance/runtime needs. |
| `src/ui/` | 4 `.ts`, 6 `.tsx` | active React/Console UI | D1 must prove Python UI coverage; D2 must address body/Live2D UI residue. |
| `src/vite-env.d.ts` | 1 `.ts` | active React/Console UI | Delete with Vite/React UI. |

### TypeScript Maintenance Scripts

| Path | Classification | Decision |
|---|---|---|
| `scripts/live2d/*.ts` | requires explicit retirement | D2 must retire old TypeScript Live2D asset scripts or document a future Python replacement path. |

### TypeScript Fallback Scripts

| Path | Classification | Decision |
|---|---|---|
| `scripts/typescript-fallback/*.command` | fallback-only | Keep through D0-D3; D4 may convert rollback to documentation-only if `src/` and `package.json` are deleted. |
| `scripts/typescript-fallback/*.sh` | fallback-only | Same as above. These depend on current TypeScript source and Node config. |

## Blocker Area Decisions

### 1. Body / Live2D UI Behavior

Current TypeScript files provide placeholder body adapters, interaction reports,
React body shells, and Live2D runtime asset wiring. Current Python production
does not depend on them. Decision: resolve in D2 by explicitly retiring active
TypeScript body/Live2D runtime surfaces for now, while keeping Live2D as future
documented work. Add a minimal Python body state/report only if needed for
current status visibility.

### 2. Console Chat Behavior

Python FastAPI UI already provides chat input, response display, conversation
history, profile/status summary, and visible error rendering. Decision: D1 must
add/verify remaining owner-facing Console coverage: local model status,
memory/context trace summary, safe reload behavior, and clear Python-primary
identity.

### 3. Memory / Context Trace Display

Python API exposes `GET /memory/context-trace/status`; the Python UI does not
yet show the summary explicitly enough for replacement proof. Decision: D1 must
surface trace summary in the UI and test it.

### 4. Readiness / Status Display

Python UI shows local status and counts. Decision: D1 must make readiness and
adapter/local-model status explicit and covered by tests.

### 5. Profile Summary

Python UI shows profile status. Decision: D1 should expose enough profile
summary counts/status to replace the owner-facing React summary.

### 6. Error Display

Python UI already renders errors visibly. Decision: D1 should keep and test
structured error display.

### 7. Operational Reports

Python has core candidate, production, readiness, profile, storage, local chat,
cutover, rollback, API contract, and migration commands. TypeScript still has
broader historical reports for backup, sync, semantic experiments, reliability,
project reports, and old migration/status paths. Decision: D3 must classify
these as already replaced, obsolete/retired, or fallback-only via tag.

### 8. CLI Scripts

TypeScript CLI scripts remain active only because `package.json` and `src/` are
still present. Decision: D3 should avoid recreating obsolete command surfaces in
Python; only current production essentials should remain.

### 9. Tests

TypeScript tests currently validate behavior that may be retired or moved to
Python tests. Decision: D1-D3 must add or identify Python checks for retained
behavior before D4 deletes TypeScript tests.

### 10. Docs References

Most active docs now identify Python as primary and TypeScript as rollback-only.
Some historical migration docs still describe prior TypeScript launcher states.
Decision: D4/G should update active docs; historical docs can remain if clearly
historical.

## D0 Verdict

Do not delete TypeScript Core yet.

Proceed to:

1. D1: finish owner-facing Python UI coverage.
2. D2: explicitly retire or minimally replace body/Live2D surfaces.
3. D3: classify operational/reporting commands.
4. D4: delete only paths classified safe after D1-D3 are merged.
