# RIN v2.0 Progress

Status: Package 2 verification passed; PR pending.

This file must be updated at every v2.0 checkpoint and before ending any Codex
conversation.

此文件必须在每个 v2.0 checkpoint 更新，并且每次 Codex 对话结束前都要更新。

## Current State

- Current package: Package 2, conversation runtime persistence redesign.
- Package status: verification passed, PR pending.
- Active branch: `codex/v2-2-conversation-persistence`.
- Latest verified main commit:
  `1b237c76bc7462e9ece15123f4e2b3680a81ec64`.
- PR #51 status: merged on `main` as
  `1b237c7 Merge pull request #51 from irin818/codex/v2-1-decommission-agent-complexity`.
- Open PRs at Package 2 start: none observed after Package 1 merge.
- Uncommitted work found at Package 2 start: none.
- Main/origin/main/HEAD match at Package 2 start: yes.

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

## Pull Request

- PR URL/status: pending.

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

## Unresolved Risks

- Package 2 checks passed locally.
- Historical v0.x/v1 documents still describe old Agent scaffolds as historical
  behavior; current v2 docs mark those paths as decommissioned.
- `Agent State Bundle` naming remains for portability compatibility and does not
  imply active Agent execution.
- Legacy `tool_invocations` records remain readable by design.

## Next Exact Task

Finish Package 2 GitHub handoff:

1. Commit the verified Package 2 diff.
2. Push `codex/v2-2-conversation-persistence`.
3. Open PR and merge only if repository gates pass.
4. After merge, pull `main` and verify clean state.
5. Start Package 3 only from updated `main`.

## Package Status Ledger

| Package | Status | Branch | PR | Notes |
| --- | --- | --- | --- | --- |
| Package 0 | merged | `codex/v2-0-recovery-and-persistent-plan` | #50 | Recovery and persistent v2 plan merged to `main`. |
| Package 1 | merged | `codex/v2-1-decommission-agent-complexity` | #51 | Decommission inventory and safe Agent complexity removal. |
| Package 2 | verified locally | `codex/v2-2-conversation-persistence` | pending | Conversation runtime persistence redesign. |
| Package 3 | not started | pending | pending | Local RIN/Owner profile configuration. |
| Package 4 | not started | pending | pending | Memory V2 data model and short-term memory. |
| Package 5 | not started | pending | pending | Automatic memory engine and forgetting curve. |
| Package 6 | not started | pending | pending | Context Assembler V2 shadow path. |
| Package 7 | not started | pending | pending | Memory V2 cutover and legacy migration. |
| Package 8 | not started | pending | pending | v2 CLI consolidation and stabilization. |
