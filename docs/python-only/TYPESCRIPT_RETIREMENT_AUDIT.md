# TypeScript Retirement Audit

Status: Package A audit. No TypeScript deletion is approved by this document.

Package C update: TypeScript fallback launchers were later moved from the
repository root to `scripts/typescript-fallback/`. The root launcher path is now
Python-only.

## Baseline

- Repository: `/Users/irin/Documents/RIN_loading`
- Audited branch: `python-only/01-typescript-retirement-audit`
- Baseline main commit: `294fba6`
- Python release tag present: `python-core-v1.0.0`
- Final TypeScript rollback tag created and pushed:
  `typescript-final-fallback`
- Python production check: passed
- TypeScript fallback check: passed on temporary data

## Inventory Summary

- TypeScript source under `src/`: 211 `.ts` files.
- React/TSX UI under `src/ui/`: 6 `.tsx` files.
- TypeScript maintenance scripts under `scripts/`: 4 `.ts` files.
- Node/Vite/TypeScript config:
  - `package.json`
  - `package-lock.json`
  - `tsconfig.json`
  - `tsconfig.app.json`
  - `tsconfig.node.json`
  - `vite.config.ts`
  - `vitest.config.ts`
  - `eslint.config.js`
  - `index.html`
- Generated/dependency folders:
  - `node_modules/`: generated dependency folder; ignored, not committed.
  - `dist/`: generated build output; ignored, not committed.

## Classification

| Item | Classification | Reason |
|---|---|---|
| `Start_RIN_Python.command` | keep | Active Python production launcher. |
| `Start_RIN_Python_Local_Model.command` | keep | Recommended active Python local-model launcher. |
| `python/` | keep | Active Python runtime, checks, migration, production server, and tests. |
| `scripts/python-preview/` | keep temporarily | Useful Python preview/sandbox path during transition. |
| `Start_RIN.command` | keep temporarily | TypeScript fallback launcher until Python UI fully replaces React Console and rollback path is documented. |
| `Start_RIN_Local_Model.command` | keep temporarily | TypeScript local-model fallback launcher. |
| `scripts/start-rin.sh` | keep temporarily | Required by TypeScript fallback launcher. |
| `scripts/start-rin-local-model.sh` | keep temporarily | Required by TypeScript local-model fallback launcher. |
| `src/ui/` | uncertain/blocker | React Console is still the only full browser UI. Python currently has API endpoints, not an HTML UI. |
| `src/server/` | keep temporarily | TypeScript Console server supports current React UI fallback. |
| `src/conversation/` | keep temporarily | Python has conversation runtime, but TypeScript tests still cover recovery/UI-facing behavior not yet fully mapped to Python UI tests. |
| `src/context/` | keep temporarily | Python has Context V2 algorithms, but TS tests are still broad coverage. |
| `src/database/` | keep temporarily | Python has SQLite support, but TS fallback tag is the real rollback path; deletion waits for UI replacement and coverage mapping. |
| `src/memory/` | keep temporarily | Python has Memory V2 parity fixtures, but TypeScript memory governance/maintenance/semantic coverage remains broader. |
| `src/model/` | keep temporarily | Python has Ollama adapter and safe response handling; TS fallback still covers external provider handoff and UI status paths. |
| `src/profile/` | keep temporarily | Python has profile reports; TS fallback tests still cover Console integration. |
| `src/readiness/` | keep temporarily | Python has readiness; TS fallback launcher still uses TS readiness. |
| `src/storage/` | keep temporarily | Python storage exists; TS fallback still requires storage init/inspection. |
| `src/backup/` | keep temporarily | Python cutover backup gates exist; TS encrypted backup/restore workflow remains broader. |
| `src/body/`, `src/live2d/`, `public/live2d/`, `live2d-development/` | uncertain/blocker | Live2D/body UI work is TypeScript/React-facing and not replaced by Python UI. |
| `src/cli/` | keep temporarily | Current Node scripts provide fallback checks and broad operational reports. |
| `src/tests/` and TypeScript `*.test.ts(x)` | keep temporarily | Do not remove tests until Python replacement coverage is explicit. |
| `package.json`, `package-lock.json` | keep temporarily | Needed for TypeScript fallback checks, React UI, and launchers. |
| `tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `index.html` | keep temporarily | Needed by React/Vite/TS fallback and test/build system. |
| `README.md`, `ARCHITECTURE.md`, `PROJECT_CHARTER.md`, `AGENTS.md`, `DEVELOPMENT_PROTOCOL.md` | keep | Protected governance/public documentation. Update only with focused changes. |
| historical Python migration docs | historical docs only | Keep as audit trail unless separately archived. |
| `node_modules/`, `dist/` | delete now if cleaning local workspace only | Generated/ignored local output; not part of Git deletion. |

## Required Questions

### 1. Does any production Python path import or depend on TypeScript?

No. The active Python production server lives under `python/src/rin`, uses
FastAPI/Uvicorn/Pydantic/httpx/sqlite3, and starts through
`rin.cli.production_server`. It does not import from `src/` TypeScript modules.

### 2. Does Python FastAPI fully replace TypeScript server for current use?

Partially. Python FastAPI supports readiness, local state, profile status,
conversation create/send/history, and memory/context trace status. It is enough
for API-level operation and production checks.

It does not yet fully replace the TypeScript Console server as an owner-facing
web application because it does not serve a Python-native HTML UI.

### 3. Does Python UI/preview provide enough owner-facing functionality?

No. Current Python launchers start a local FastAPI backend at `127.0.0.1:8765`,
but there is no Python-served chat UI. The React/Vite Console remains the only
full browser UI with visible chat/status/body surfaces.

This is a hard blocker for deleting `src/ui/`, Vite, React, and related Node
tooling.

### 4. Are old TypeScript tests still the only coverage for some behavior?

Yes. Python tests cover the Python candidate/runtime/cutover path, but
TypeScript tests still provide the only broad coverage for:

- React Console rendering and interaction.
- local Console server behavior.
- body/Live2D UI shell behavior.
- TypeScript encrypted backup/restore workflow.
- several historical operational report commands.
- broad memory governance/maintenance/semantic report surfaces.

Do not remove TypeScript tests until Package B and later packages map or replace
that coverage in Python.

### 5. Which launchers should remain?

For now:

- Keep active Python launchers:
  - `Start_RIN_Python.command`
  - `Start_RIN_Python_Local_Model.command`
- Keep TypeScript fallback launchers temporarily:
  - `Start_RIN.command`
  - `Start_RIN_Local_Model.command`

Package C may move TypeScript fallback launchers under
`scripts/typescript-fallback/` after Python UI is verified.

### 6. What exact rollback path exists after deletion?

The exact rollback anchor is the pushed Git tag:

```text
typescript-final-fallback
```

Rollback before TypeScript deletion:

```sh
git checkout typescript-final-fallback
```

Production data rollback remains the verified `.rin-python-backups/` backup from
the Python cutover, plus current Git history. Backup bundles must not be deleted.

### 7. Which files cannot be deleted yet?

Cannot delete yet:

- `src/ui/`
- `src/server/`
- `package.json`
- `package-lock.json`
- `tsconfig*.json`
- `vite.config.ts`
- `vitest.config.ts`
- `eslint.config.js`
- `index.html`
- TypeScript fallback launchers and scripts
- TypeScript tests whose coverage is not replaced in Python
- Live2D/body TypeScript UI surfaces

## Audit Verdict

Proceed to Package B.

Do not delete TypeScript Core in Package A. Python needs a verified
Python-native UI/Console replacement before React/Vite/TypeScript UI and its
tests can be retired safely.
