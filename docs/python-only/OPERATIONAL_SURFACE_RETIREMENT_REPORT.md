# Operational Surface Retirement Report

Status: Package D3 complete.

## Verdict

The remaining TypeScript operational/reporting surface is not required for
current Python production. Current production essentials are covered by Python
commands, Python tests, and the Python web UI.

Do not recreate obsolete TypeScript experiment/report surfaces in Python unless
they become explicit future requirements.

## Python Production Essentials

| Need | Python surface | Status |
|---|---|---|
| Full Python gate | `rin-python-candidate-check` | replaced |
| Production readiness | `rin-python-production-check` | replaced |
| Basic readiness | `rin-python-readiness` | replaced |
| Profile validation/report | `rin-python-profile-validate`, `rin-python-profile-report` | replaced |
| Storage report | `rin-python-storage-report` | replaced |
| Local chat smoke | `rin-python-local-chat-smoke` | replaced |
| Preview/sandbox testing | `rin-python-preview-*`, `rin-python-sandbox-*` | replaced |
| Real-data safety gates | `rin-python-real-data-*` | replaced |
| Migration/rollback rehearsal | `rin-python-production-migration-dry-run`, `rin-python-rollback-rehearsal` | replaced |
| API compatibility | `rin-python-api-contract-check` | replaced |
| Copied-data shadow validation | `rin-python-copy-data-shadow-report` | replaced |

## TypeScript Command Classification

| TypeScript surface | Decision | Reason |
|---|---|---|
| `rin:readiness` | Python replaced | Covered by `rin-python-readiness` and production check. |
| `rin:check`, `rin:v*-check` | Python replaced / fallback-only | Python checks are now authoritative; old chained TS gates remain only in `typescript-final-fallback`. |
| `rin:console`, `rin:console:server`, `dev`, `build` | retired for active use | Python FastAPI UI is active owner-facing UI. |
| `rin:local-chat-smoke`, `rin:daily-chat-eval`, `rin:daily-chat-live-smoke` | Python replaced / retired | Python local chat smoke and Ollama adapter tests cover current local model needs; old daily-chat fixtures are historical. |
| `rin:profile-*` | Python replaced | Python profile commands and UI profile summary cover active use. |
| `rin:memory-v2-*`, `rin:context-v2-*` | Python replaced / retired | Python unit tests cover Memory V2 and Context V2 algorithms needed by current runtime; old shadow/report CLIs are historical. |
| `rin:semantic-*`, `rin:hybrid-retrieval-report` | retired | These were TypeScript semantic retrieval experiments; not active Python production requirements. |
| `rin:memory-health-report`, `rin:memory-conflict-report`, `rin:memory-governance-smoke`, `rin:memory-maintenance-report` | retired | Not required by current Python production; future memory governance should be Python-native if reintroduced. |
| `rin:backup-*`, `rin:restore-*` | Python cutover gates replace current need; old TS path fallback-only | Current protected backups live under Python cutover workflow and `.rin-python-backups/`. |
| `rin:export`, `rin:import` | retired | No active Python production launcher or UI depends on TS bundle import/export. Future export should be Python-native if needed. |
| `rin:external-model-smoke` | retired | External APIs are disallowed for the Python-only transition. |
| `rin:project-report`, `rin:rollback-notes` | retired / docs replaced | Rollback is documented through `typescript-final-fallback` and Python-only docs. |
| `rin:device-report`, `rin:sync-dry-run`, `rin:migration-check` | retired | Old sync/device reports are not active Python production behavior. |
| `rin:body-smoke`, `rin:body-state-report` | Python replaced / retired | D2 added minimal Python body report and retired active TS body/Live2D runtime surfaces. |
| `rin:integrity-check`, `rin:recovery-smoke`, `rin:ops-health-report` | retired | Current Python production check is authoritative. |
| `typecheck`, `test`, `lint` | TypeScript test-only | Valid only while TypeScript source remains; delete with TypeScript core in D4. |

## Test Surface Decision

Retained behavior is covered by Python tests for:

- conversation runtime;
- database/storage/profile reading;
- Memory V2 and Context V2 algorithms;
- Ollama adapter and local chat;
- Python FastAPI UI and API compatibility;
- production cutover/safety gates;
- body status boundary.

Retired TypeScript-only behavior does not need Python replacement tests because
it is no longer part of active Python production.

## D3 Deletion Implication

After D3, TypeScript operational/reporting commands are no longer blockers for
D4 deletion. They are either:

- replaced by Python;
- explicitly retired;
- fallback-only through the `typescript-final-fallback` tag.

If a retired report is needed later, it should be reintroduced as a Python-native
command with fresh tests.
