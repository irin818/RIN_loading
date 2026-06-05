# RIN v2.0 Progress

Status: RIN v2.0 completed and tagged.

This file must be updated at every v2.0 checkpoint and before ending any Codex
conversation.

此文件必须在每个 v2.0 checkpoint 更新，并且每次 Codex 对话结束前都要更新。

## Current State

- Current package: Package 8 completed.
- Current checkpoint: v2.0 final main verification passed and `v2.0.0` pushed.
- Package status: merged, verified on `main`, and tagged.
- Active branch: `main`.
- Latest verified release commit:
  `bf7ba722ee3233a07e2bb8823f4fa450206f3a8a`.
- PR #51 status: merged on `main` as
  `1b237c7 Merge pull request #51 from irin818/codex/v2-1-decommission-agent-complexity`.
- PR #52 status: merged on `main` as
  `cfb7b7b Merge pull request #52 from irin818/codex/v2-2-conversation-persistence`.
- PR #53 status: merged on `main` as
  `0f5d453 Merge pull request #53 from irin818/codex/v2-3-local-profiles`.
- PR #54 status: merged on `main` as
  `609557f Merge pull request #54 from irin818/codex/v2-4-memory-v2-shadow`.
- PR #55 status: merged on `main` as
  `247b674 Merge pull request #55 from irin818/codex/v2-5-memory-v2-engine`.
- PR #56 status: merged on `main` as
  `ca7c52f Merge pull request #56 from irin818/codex/v2-6-context-v2-shadow`.
- PR #57 status: merged on `main` as
  `2af75b4 Merge pull request #57 from irin818/codex/v2-7-memory-v2-cutover`.
- PR #58 status: merged on `main` as
  `d2b6c67 Merge pull request #58 from irin818/codex/v2-8-stabilization`.
- PR #59 status: merged on `main` as
  `bf7ba72 Merge pull request #59 from irin818/codex/v2-final-test-fix`.
- Release tag: `v2.0.0` pushed at
  `bf7ba722ee3233a07e2bb8823f4fa450206f3a8a`.
- Open PRs at Package 8 start: none observed after Package 7 merge.
- Uncommitted work found at Package 8 start: none.
- Main/origin/main/HEAD match at Package 8 start: yes.

## Completed Package 1 Work

- Created `docs/RIN_V2_DECOMMISSION_INVENTORY.md`.
- Removed active `src/actions`, `src/planner`, `src/tasks`, and `src/tools`
  implementation/test files.
- Removed active Agent/action/planner/task/tool/MCP CLI surfaces and npm scripts.
- Removed the `/api/tools/:id` local Console route.
- Stopped generating new `config/tool_registry.json` and
  `config/permissions.json` files.
- Replaced active Console permissions/planner/tool status with a
  decommissioned Agent runtime status and legacy tool invocation count.
- Retained SQLite `tool_invocations` schema/counts for old data compatibility.
- Updated governance/current-state docs to distinguish removed Agent permission
  hierarchy from retained data-integrity protections.

## Completed Package 2 Work

- Added additive schema migration `5` with `conversation_turns`.
- Persisted owner messages and turn-start metadata before model adapter calls.
- Moved model adapter generation outside long database transactions.
- Added explicit `turnId` idempotency semantics:
  - failed turns can retry with the same owner content
  - completed turns return the already stored reply without another model call
  - content mismatch on a reused `turnId` is rejected
- Preserved owner messages on model failure without writing fake RIN replies.
- Added safe turn/timing metadata to failure details.
- Added `npm run rin:conversation-runtime-report`.
- Added `docs/decisions/ADR-0003-conversation-turn-persistence.md`.

## Completed Package 3 Work

- Added manually editable local profile templates for RIN and owner state under
  `.rin-data/config/rin_profile.json` and
  `.rin-data/config/owner_profile.json`.
- Added profile schema validation, safe reporting, and compact profile context
  formatting without model-driven profile mutation.
- Added `npm run rin:profile-validate` and `npm run rin:profile-report`.
- Injected valid compact profile context into model context after the RIN system
  prompt and before accepted memory context.
- Added profile context counts to raw/audit conversation turn metadata.
- Added profile files to slow-variable snapshots for traceability.
- Updated architecture, README, project map, and v2 decisions to document manual
  profile ownership and report redaction boundaries.

## Completed Package 4 Work

- Added additive schema migration `6` with Memory V2 shadow tables for trace
  sources, traces, trace signals, and retrieval events.
- Added `npm run rin:memory-v2-schema-report`.
- Added `npm run rin:short-term-memory-report`.
- The short-term memory report uses a five-hour rolling window over raw
  conversation messages and prints only IDs, roles, timestamps, and character
  counts.
- Production accepted-memory retrieval remains unchanged.
- Full raw conversation text is not duplicated into Memory V2 tables.
- Updated architecture, README, project map, and v2 decisions for Memory V2
  shadow/report-only constraints.

## Completed Package 5 Work

- Added deterministic Memory V2 shadow engine for promotion, reinforcement,
  weakening, and ignore decisions.
- Added bounded retention scoring with
  `baseScore * exp(-ageHours / stabilityHours)`.
- Added `npm run rin:memory-v2-eval`.
- Added `npm run rin:memory-v2-shadow-report`.
- Shadow writes are limited to `memory_v2_*` trace/source/signal tables.
- Production accepted-memory retrieval remains unchanged.
- The engine does not delete raw history, mutate profiles, mutate accepted
  memory, call providers, extract hidden reasoning, or print full text.

## Completed Package 6 Work

- Added Context V2 shadow report/evaluation path with explicit ordering,
  provenance, deduplication, and budget accounting.
- Added `npm run rin:context-v2-report`.
- Added `npm run rin:context-v2-eval`.
- Context V2 reports intended order: system, RIN profile, Owner profile, current
  Owner message, short-term window, Memory V2 traces, older references.
- Latest Owner message preservation is reported and protected in fixtures.
- Production `buildModelContext` and conversation runtime remain unchanged.
- Reports do not print full prompt, profile, message, or memory text.

## Completed Package 7 Work

- Added Memory V2 legacy accepted-memory migration dry-run/apply/status module.
- Added `npm run rin:memory-v2-migration-dry-run`.
- Added `npm run rin:memory-v2-migration-apply`.
- Added `npm run rin:memory-v2-migration-status`.
- Migration maps accepted legacy `memory_items` to Memory V2
  `legacy_memory_item` retrieval-candidate traces idempotently.
- Migration writes only `memory_v2_*` trace/source/signal rows and an audit
  event; legacy accepted memory records and raw messages are preserved.
- Runtime accepted-memory retrieval now uses Memory V2 migrated legacy traces
  when migration is complete.
- Runtime falls back to legacy accepted-memory candidates when migration is
  incomplete so owner-reviewed memory is not silently dropped.
- Runtime raw/audit payloads record `memoryRetrievalSource` and migration
  counts for traceability.
- `/remember` remains a deprecated legacy proposal-only path and now emits a
  safe deprecation audit event without direct acceptance.

## Package 8 Work Verified Locally

- Added `npm run rin:v2-check` as the provider-free v2.0 release gate.
- `rin:v2-check` runs the default check plus conversation/profile reports,
  Memory V2 schema/eval/migration dry-run/status, Context V2 eval/report, and
  semantic retrieval evaluation.
- `rin:v2-check` does not run `rin:memory-v2-migration-apply`; applying real
  legacy-memory migration remains explicit.
- Marked non-versioned stale planner/action/Console policy docs as historical or
  superseded in active v2.
- Added `docs/RIN_V2_STABILIZATION_NOTES.md`.
- Added final v2 reference docs:
  `docs/RIN_V2_REPOSITORY_CLEANUP_REPORT.md`,
  `docs/RIN_V2_RELEASE_NOTES.md`,
  `docs/RIN_V2_OPERATIONS_GUIDE.md`, `docs/RIN_V2_MEMORY_MODEL.md`,
  `docs/RIN_V2_CONTEXT_POLICY.md`, and
  `docs/RIN_V2_KNOWN_LIMITATIONS.md`.
- Updated Memory V2 schema report semantics so it no longer claims Memory V2 is
  shadow-only after Package 7 legacy retrieval cutover.

## Checks

- Baseline temporary test data directory:
  `/tmp/rin-v2-initial-baseline.0W2COA`.
- Baseline `npm run rin:init`: passed before Package 1 edits.
- Baseline `npm run rin:check`: passed before Package 1 edits.
- Baseline `npm run rin:v1-check`: passed before Package 1 edits.
- Baseline `npm run rin:daily-chat-eval`: passed before Package 1 edits.
- Baseline `npm run rin:memory-eval`: passed before Package 1 edits.
- Baseline `npm run rin:semantic-eval`: passed before Package 1 edits.
- Baseline `npm run rin:readiness`: passed before Package 1 edits with the
  expected live-model warning.
- Package 1 temporary test data directory:
  `/tmp/rin-v2-package1.CESlHx`.
- Package 1 `npm run typecheck`: passed.
- Package 1 `npm test`: passed, 53 files and 268 tests.
- Package 1 `RIN_DATA_DIR=/tmp/rin-v2-package1.CESlHx npm run rin:init`:
  passed; new data directories no longer generate `tool_registry.json` or
  `permissions.json`.
- Package 1 `RIN_DATA_DIR=/tmp/rin-v2-package1.CESlHx npm run rin:check`:
  passed.
- Package 1 `RIN_DATA_DIR=/tmp/rin-v2-package1.CESlHx npm run rin:v1-check`:
  passed.
- Package 1 `RIN_DATA_DIR=/tmp/rin-v2-package1.CESlHx npm run rin:local-chat-smoke`:
  passed as skipped-not-selected with `providerCallCount` 0.
- Package 1 old import/script scan: passed; no active deleted-module imports or
  old Agent script references in `src`/`package.json`.
- Package 1 `git diff --check`: passed.
- External provider calls: `0` in baseline.
- Real `.rin-data` committed: no.
- Package 2 focused `npm test -- src/conversation/runtime.test.ts src/database/initialize.test.ts`:
  passed before docs/report additions.
- Package 2 `npm test`: passed, 54 files and 271 tests.
- Package 2 temporary test data directory:
  `/tmp/rin-v2-package2.8RI20g`.
- Package 2 `RIN_DATA_DIR=/tmp/rin-v2-package2.8RI20g npm run rin:init`:
  passed; schema version 5.
- Package 2 `RIN_DATA_DIR=/tmp/rin-v2-package2.8RI20g npm run rin:conversation-runtime-report`:
  passed; no full text included.
- Package 2 `RIN_DATA_DIR=/tmp/rin-v2-package2.8RI20g npm run rin:check`:
  passed.
- Package 2 focused `npm test -- src/conversation/runtime.test.ts src/conversation/runtimeReport.test.ts src/database/initialize.test.ts`:
  passed, 17 tests.
- Package 2 `git diff --check`: passed.
- Package 2 `RIN_DATA_DIR=/tmp/rin-v2-package2.8RI20g npm run rin:v1-check`:
  passed.
- Package 2 final verification: passed.
- Package 2 PR #52: merged to `main`; local `main`, `origin/main`, and branch
  start point matched before Package 3 started.
- Package 3 focused `npm run typecheck`: passed before final aggregate checks.
- Package 3 focused `npm test -- src/profile/profiles.test.ts src/context/contextBuilder.test.ts src/conversation/runtime.test.ts src/storage/initialize.test.ts`:
  passed, 34 tests.
- Package 3 temporary test data directory:
  `/tmp/rin-v2-package3.ZSjcSo`.
- Package 3 `RIN_DATA_DIR=/tmp/rin-v2-package3.ZSjcSo npm run rin:init`:
  passed; generated `config/rin_profile.json` and
  `config/owner_profile.json`.
- Package 3 `RIN_DATA_DIR=/tmp/rin-v2-package3.ZSjcSo npm run rin:profile-validate`:
  passed; report status valid, issue count 0, providerCallCount 0, full text
  included no.
- Package 3 `RIN_DATA_DIR=/tmp/rin-v2-package3.ZSjcSo npm run rin:profile-report`:
  passed; report status valid, issue count 0, providerCallCount 0, full text
  included no.
- Package 3 `RIN_DATA_DIR=/tmp/rin-v2-package3.ZSjcSo npm run rin:check`:
  passed; 55 test files and 276 tests passed, lint/build/readiness/memory eval
  and daily chat eval passed.
- Package 3 explicit `RIN_DATA_DIR=/tmp/rin-v2-package3.ZSjcSo npm run rin:memory-eval`:
  passed; 29/29 cases, providerCallCount 0.
- Package 3 explicit `RIN_DATA_DIR=/tmp/rin-v2-package3.ZSjcSo npm run rin:daily-chat-eval`:
  passed; 8/8 cases, providerCallCount 0, external provider calls 0, real
  `.rin-data` read no, full text included no.
- Package 3 `RIN_DATA_DIR=/tmp/rin-v2-package3.ZSjcSo npm run rin:v1-check`:
  passed.
- Package 3 `git diff --check`: passed.
- Package 3 final verification: passed.
- Package 3 PR #53: merged to `main`; local `main`, `origin/main`, and branch
  start point matched before Package 4 started.
- Package 4 focused `npm run typecheck`: passed before final aggregate checks.
- Package 4 focused `npm test -- src/memory/v2Schema.test.ts src/database/initialize.test.ts src/storage/initialize.test.ts`:
  passed, 8 tests.
- Package 4 temporary test data directory:
  `/tmp/rin-v2-package4.zhapOA`.
- Package 4 `RIN_DATA_DIR=/tmp/rin-v2-package4.zhapOA npm run rin:init`:
  passed; database schema version 6.
- Package 4 `RIN_DATA_DIR=/tmp/rin-v2-package4.zhapOA npm run rin:memory-v2-schema-report`:
  passed; status ready, providerCallCount 0, full text included no.
- Package 4 `RIN_DATA_DIR=/tmp/rin-v2-package4.zhapOA npm run rin:short-term-memory-report`:
  passed on sequential rerun; status ready, five-hour window, providerCallCount
  0, production retrieval changed no, full text included no.
- Package 4 `RIN_DATA_DIR=/tmp/rin-v2-package4.zhapOA npm run rin:check`:
  passed; 56 test files and 279 tests passed, lint/build/readiness/memory eval
  and daily chat eval passed.
- Package 4 explicit `RIN_DATA_DIR=/tmp/rin-v2-package4.zhapOA npm run rin:memory-eval`:
  passed; 29/29 cases, providerCallCount 0.
- Package 4 explicit `RIN_DATA_DIR=/tmp/rin-v2-package4.zhapOA npm run rin:daily-chat-eval`:
  passed; 8/8 cases, providerCallCount 0, external provider calls 0, real
  `.rin-data` read no, full text included no.
- Package 4 `RIN_DATA_DIR=/tmp/rin-v2-package4.zhapOA npm run rin:v1-check`:
  passed; integrity report shows schema version 6.
- Package 4 `git diff --check`: passed.
- Package 4 final verification: passed.
- Package 4 PR #54: merged to `main`; local `main`, `origin/main`, and branch
  start point matched before Package 5 started.
- Package 5 focused `npm run typecheck`: passed after initial helper typing fix.
- Package 5 focused `npm test -- src/memory/v2Engine.test.ts src/memory/v2Schema.test.ts`:
  passed, 6 tests.
- Package 5 temporary test data directory:
  `/tmp/rin-v2-package5.AUv9AF`.
- Package 5 `RIN_DATA_DIR=/tmp/rin-v2-package5.AUv9AF npm run rin:init`:
  passed; database schema version 6.
- Package 5 `npm run rin:memory-v2-eval`: passed; 5/5 cases,
  providerCallCount 0, full text included no.
- Package 5 `RIN_DATA_DIR=/tmp/rin-v2-package5.AUv9AF npm run rin:memory-v2-shadow-report`:
  passed on an empty temporary data directory; status ready, providerCallCount
  0, production retrieval changed no, full text included no.
- Package 5 `RIN_DATA_DIR=/tmp/rin-v2-package5.AUv9AF npm run rin:check`:
  passed; 57 test files and 282 tests passed, lint/build/readiness/memory eval
  and daily chat eval passed.
- Package 5 explicit `RIN_DATA_DIR=/tmp/rin-v2-package5.AUv9AF npm run rin:memory-eval`:
  passed; 29/29 cases, providerCallCount 0.
- Package 5 `RIN_DATA_DIR=/tmp/rin-v2-package5.AUv9AF npm run rin:v1-check`:
  passed; integrity report shows schema version 6.
- Package 5 `git diff --check`: passed.
- Package 5 final verification: passed.
- Package 5 PR #55: merged to `main`; local `main`, `origin/main`, and branch
  start point matched before Package 6 started.
- Package 6 focused `npm run typecheck`: passed.
- Package 6 focused `npm test -- src/context/contextV2.test.ts src/memory/v2Engine.test.ts src/context/contextBuilder.test.ts`:
  passed, 19 tests.
- Package 6 temporary test data directory:
  `/tmp/rin-v2-package6.HzAZ6j`.
- Package 6 `RIN_DATA_DIR=/tmp/rin-v2-package6.HzAZ6j npm run rin:init`:
  passed; database schema version 6.
- Package 6 `npm run rin:context-v2-eval`: passed; 3/3 cases,
  providerCallCount 0, full text included no.
- Package 6 `RIN_DATA_DIR=/tmp/rin-v2-package6.HzAZ6j npm run rin:context-v2-report`:
  passed; status ready, production context changed no, providerCallCount 0,
  full text included no.
- Package 6 `RIN_DATA_DIR=/tmp/rin-v2-package6.HzAZ6j npm run rin:check`:
  passed; 58 test files and 286 tests passed, lint/build/readiness/memory eval
  and daily chat eval passed.
- Package 6 explicit `RIN_DATA_DIR=/tmp/rin-v2-package6.HzAZ6j npm run rin:memory-eval`:
  passed; 29/29 cases, providerCallCount 0.
- Package 6 explicit `RIN_DATA_DIR=/tmp/rin-v2-package6.HzAZ6j npm run rin:daily-chat-eval`:
  passed; 8/8 cases, providerCallCount 0, external provider calls 0, real
  `.rin-data` read no, full text included no.
- Package 6 `RIN_DATA_DIR=/tmp/rin-v2-package6.HzAZ6j npm run rin:v1-check`:
  passed; integrity report shows schema version 6.
- Package 6 `git diff --check`: passed.
- Package 6 final verification: passed.
- Package 6 PR #56: merged to `main`; local `main`, `origin/main`, and branch
  start point matched before Package 7 started.
- Package 7 baseline temporary test data directory:
  `/tmp/rin-v2-package7-baseline-full.uteIB6`.
- Package 7 baseline `RIN_DATA_DIR=/tmp/rin-v2-package7-baseline-full.uteIB6 npm run rin:init`:
  passed; database schema version 6.
- Package 7 baseline `RIN_DATA_DIR=/tmp/rin-v2-package7-baseline-full.uteIB6 npm run rin:check`:
  passed; 58 test files and 286 tests passed.
- Package 7 baseline `RIN_DATA_DIR=/tmp/rin-v2-package7-baseline-full.uteIB6 npm run rin:v1-check`:
  passed.
- Package 7 baseline `RIN_DATA_DIR=/tmp/rin-v2-package7-baseline-full.uteIB6 npm run rin:daily-chat-eval`:
  passed; 8/8 cases, providerCallCount 0.
- Package 7 baseline `RIN_DATA_DIR=/tmp/rin-v2-package7-baseline-full.uteIB6 npm run rin:memory-eval`:
  passed; 29/29 cases, providerCallCount 0.
- Package 7 baseline `RIN_DATA_DIR=/tmp/rin-v2-package7-baseline-full.uteIB6 npm run rin:readiness`:
  passed with expected live-model warning.
- Package 7 baseline `npm run rin:semantic-eval`: passed; 11/11 cases,
  providerCallCount 0.
- Package 7 baseline `git diff --check`: passed.
- Package 7 focused `npm run typecheck`: passed.
- Package 7 focused `npm test -- src/memory/v2LegacyMigration.test.ts src/conversation/runtime.test.ts`:
  passed, 18 tests.
- Package 7 temporary CLI test data directory:
  `/tmp/rin-v2-package7.VkTo77`.
- Package 7 `RIN_DATA_DIR=/tmp/rin-v2-package7.VkTo77 npm run rin:init`:
  passed; database schema version 6.
- Package 7 `RIN_DATA_DIR=/tmp/rin-v2-package7.VkTo77 npm run rin:memory-v2-migration-dry-run`:
  passed; providerCallCount 0, full text included no.
- Package 7 `RIN_DATA_DIR=/tmp/rin-v2-package7.VkTo77 npm run rin:memory-v2-migration-apply`:
  passed; providerCallCount 0, full text included no, no accepted memories in
  temp directory.
- Package 7 `RIN_DATA_DIR=/tmp/rin-v2-package7.VkTo77 npm run rin:memory-v2-migration-status`:
  passed; providerCallCount 0, full text included no.
- Package 7 full verification temporary test data directory:
  `/tmp/rin-v2-package7-check.xBkIkK`.
- Package 7 `RIN_DATA_DIR=/tmp/rin-v2-package7-check.xBkIkK npm run rin:init`:
  passed; database schema version 6.
- Package 7 `RIN_DATA_DIR=/tmp/rin-v2-package7-check.xBkIkK npm run rin:check`:
  passed; 59 test files and 290 tests passed.
- Package 7 explicit `RIN_DATA_DIR=/tmp/rin-v2-package7-check.xBkIkK npm run rin:memory-eval`:
  passed; 29/29 cases, providerCallCount 0.
- Package 7 explicit `RIN_DATA_DIR=/tmp/rin-v2-package7-check.xBkIkK npm run rin:daily-chat-eval`:
  passed; 8/8 cases, providerCallCount 0, external provider calls 0, real
  `.rin-data` read no, full text included no.
- Package 7 `RIN_DATA_DIR=/tmp/rin-v2-package7-check.xBkIkK npm run rin:v1-check`:
  passed; project report lists 73 scripts and integrity report shows schema
  version 6.
- Package 7 `git diff --check`: passed.
- Package 7 secret/local-data scan: no tracked `.rin-data`, `node_modules`,
  `dist`, `.env`, sqlite/db/log files; secret-like matches were docs examples,
  old task policy references, and CSS masks only.
- Package 7 final quick `npm run typecheck`: passed after documentation/status
  cleanup.
- Package 7 final quick `npm test -- src/memory/v2LegacyMigration.test.ts src/conversation/runtime.test.ts`:
  passed, 18 tests.
- Package 7 final quick `npm run lint`: passed.
- Package 7 final quick `git diff --check`: passed.
- Package 7 PR #57: merged to `main`; local `main`, `origin/main`, and branch
  start point matched before Package 8 started.
- Package 7 post-merge temporary test data directory:
  `/tmp/rin-v2-package7-postmerge.SNBwp0`.
- Package 7 post-merge `RIN_DATA_DIR=/tmp/rin-v2-package7-postmerge.SNBwp0 npm run rin:init`:
  passed; database schema version 6.
- Package 7 post-merge `RIN_DATA_DIR=/tmp/rin-v2-package7-postmerge.SNBwp0 npm run rin:check`:
  passed; 59 test files and 290 tests passed.
- Package 7 post-merge `git diff --check`: passed.
- Package 8 focused `npm test -- src/memory/v2Schema.test.ts`: passed, 3 tests.
- Package 8 temporary test data directory:
  `/tmp/rin-v2-package8-final.Rc6TDQ`.
- Package 8 `RIN_DATA_DIR=/tmp/rin-v2-package8-final.Rc6TDQ npm run rin:init`:
  passed; database schema version 6.
- Package 8 `RIN_DATA_DIR=/tmp/rin-v2-package8-final.Rc6TDQ npm run rin:v2-check`:
  passed; default `rin:check` inside the gate passed with 59 test files and 290
  tests, Memory V2 schema report shows legacy migration support and production
  retrieval path, Context V2 eval passed 3/3, semantic eval passed 11/11, and
  providerCallCount remained 0.
- Package 8 `RIN_DATA_DIR=/tmp/rin-v2-package8-final.Rc6TDQ npm run rin:check`:
  passed; 59 test files and 290 tests passed.
- Package 8 `RIN_DATA_DIR=/tmp/rin-v2-package8-final.Rc6TDQ npm run rin:v1-check`:
  passed; project report lists 74 scripts and integrity report shows schema
  version 6.
- Package 8 `RIN_DATA_DIR=/tmp/rin-v2-package8-final.Rc6TDQ npm run rin:daily-chat-eval`:
  passed; 8/8 cases, providerCallCount 0, external provider calls 0, real
  `.rin-data` read no, full text included no.
- Package 8 `git diff --check`: passed.
- Package 8 pre-PR temporary test data directory:
  `/tmp/rin-v2-package8-prepr.OLqIUb`.
- Package 8 pre-PR `RIN_DATA_DIR=/tmp/rin-v2-package8-prepr.OLqIUb npm run rin:init`:
  passed; database schema version 6.
- Package 8 pre-PR `RIN_DATA_DIR=/tmp/rin-v2-package8-prepr.OLqIUb npm run rin:v2-check`:
  passed; 59 test files and 290 tests passed inside `rin:check`, Memory V2
  schema report shows production retrieval changed yes, Context V2 eval passed
  3/3, semantic eval passed 11/11, and providerCallCount remained 0.
- Package 8 secret/local-data scan: no tracked `.rin-data`, `node_modules`,
  `dist`, `.env`, sqlite/db/log files; secret-like matches were documentation
  examples, historical task policy references, branch naming text, and CSS masks
  only.
- Package 8 hidden control character scan: passed; no control or bidi/zero-width
  characters detected outside ignored generated/local-data directories.
- Package 8 optional Ollama/Qwen3 live smoke: skipped; Ollama CLI exists but no
  local service responded on `127.0.0.1:11434`.
- Final main verification temporary test data directory:
  `/tmp/rin-v2-final-main2.ATsVD0`.
- Final main `RIN_DATA_DIR=/tmp/rin-v2-final-main2.ATsVD0 npm run rin:init`:
  passed; database schema version 6.
- Final main `RIN_DATA_DIR=/tmp/rin-v2-final-main2.ATsVD0 npm run rin:v2-check`:
  passed three consecutive times; each run passed 59 test files and 290 tests
  inside `rin:check`, Context V2 eval 3/3, Memory V2 eval 5/5, semantic eval
  11/11, and providerCallCount remained 0.
- Final main `RIN_DATA_DIR=/tmp/rin-v2-final-main2.ATsVD0 npm run rin:check`:
  passed; 59 test files and 290 tests passed.
- Final main `RIN_DATA_DIR=/tmp/rin-v2-final-main2.ATsVD0 npm run rin:v1-check`:
  passed after PR #59 stabilized the encrypted backup tamper test fixture.
- Final main `RIN_DATA_DIR=/tmp/rin-v2-final-main2.ATsVD0 npm run rin:daily-chat-eval`:
  passed; 8/8 cases, providerCallCount 0, external provider calls 0, real
  `.rin-data` read no, full text included no.
- Final main `RIN_DATA_DIR=/tmp/rin-v2-final-main2.ATsVD0 npm run rin:memory-v2-eval`:
  passed; 5/5 cases, providerCallCount 0.
- Final main `RIN_DATA_DIR=/tmp/rin-v2-final-main2.ATsVD0 npm run rin:context-v2-eval`:
  passed; 3/3 cases, providerCallCount 0.
- Final main `git diff --check`: passed.
- Final main local-data scan: no tracked `.rin-data`, `node_modules`, `dist`,
  `.env`, sqlite/db/log files.
- Final main secret-like scan: matches were documentation examples, historical
  task policy references, branch naming text, and CSS masks only.
- Final main hidden control character scan: passed; no control or
  bidi/zero-width characters detected outside ignored generated/local-data
  directories.
- Final main optional Ollama/Qwen3 live smoke: skipped; Ollama CLI exists but no
  local service responded on `127.0.0.1:11434`.
- Final tag `v2.0.0`: created and pushed.

## Unresolved Risks

- Historical v0.x/v1 documents still describe old Agent scaffolds as historical
  behavior; current v2 docs mark those paths as decommissioned.
- `Agent State Bundle` naming remains for portability compatibility and does not
  imply active Agent execution.
- Legacy `tool_invocations` records remain readable by design.
- Context V2 provider-facing message assembly remains report/evaluation-only;
  Package 7 cuts production accepted-memory candidate sourcing over to Memory V2
  migrated traces while preserving existing provider message construction.
- Optional local Ollama/Qwen3 live smoke remains unverified because the local
  Ollama service was not running during final checks.

## Next Exact Task

Post-v2 recommended next task:

1. Start a separate governed post-v2 branch for local Ollama/Qwen3 live
   conversation quality hardening and owner-approved real local data setup.
2. Keep real `.rin-data` migration explicit; run Memory V2 legacy migration
   apply only after owner intent and backup review.
3. Keep Server/UI/body/sync feature expansion separate from this completed v2
   core release.

## Package Status Ledger

| Package | Status | Branch | PR | Notes |
| --- | --- | --- | --- | --- |
| Package 0 | merged | `codex/v2-0-recovery-and-persistent-plan` | #50 | Recovery and persistent v2 plan merged to `main`. |
| Package 1 | merged | `codex/v2-1-decommission-agent-complexity` | #51 | Decommission inventory and safe Agent complexity removal. |
| Package 2 | merged | `codex/v2-2-conversation-persistence` | #52 | Conversation runtime persistence redesign. |
| Package 3 | merged | `codex/v2-3-local-profiles` | #53 | Local RIN/Owner profile configuration. |
| Package 4 | merged | `codex/v2-4-memory-v2-shadow` | #54 | Memory V2 data model and short-term memory. |
| Package 5 | merged | `codex/v2-5-memory-v2-engine` | #55 | Automatic memory engine and forgetting curve. |
| Package 6 | merged | `codex/v2-6-context-v2-shadow` | #56 | Context Assembler V2 shadow path. |
| Package 7 | merged | `codex/v2-7-memory-v2-cutover` | #57 | Memory V2 cutover and legacy migration. |
| Package 8 | merged and tagged | `codex/v2-8-stabilization` | #58 | v2 CLI consolidation and stabilization. |
| Final test fix | merged | `codex/v2-final-test-fix` | #59 | Stabilized encrypted backup tamper test before final tag. |
