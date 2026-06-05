# RIN v2.0 Progress

Status: Package 1 verification passed; PR pending.

This file must be updated at every v2.0 checkpoint and before ending any Codex
conversation.

此文件必须在每个 v2.0 checkpoint 更新，并且每次 Codex 对话结束前都要更新。

## Current State

- Current package: Package 1, decommission Agent complexity and permission
  hierarchy.
- Package status: verification passed, PR pending.
- Active branch: `codex/v2-1-decommission-agent-complexity`.
- Latest verified main commit:
  `4c12268fd9e37cd24bd460105ef7918c1aac4ee1`.
- PR #50 status: merged on `main` as
  `4c12268 Merge pull request #50 from irin818/codex/v2-0-recovery-and-persistent-plan`.
- Open PRs at Package 1 start: none observed.
- Uncommitted work found at Package 1 start: none.
- Main/origin/main/HEAD match at Package 1 start: yes.

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

## Unresolved Risks

- Package 1 checks passed after removal.
- Historical v0.x/v1 documents still describe old Agent scaffolds as historical
  behavior; current v2 docs now mark those paths as decommissioned.
- `Agent State Bundle` naming remains for portability compatibility and does not
  imply active Agent execution.
- Legacy `tool_invocations` records remain readable by design.

## Next Exact Task

Finish Package 1 GitHub handoff:

1. Commit the verified Package 1 diff.
2. Push `codex/v2-1-decommission-agent-complexity`.
3. Open a PR and merge only if repository gates pass.
4. After merge, pull `main` and verify clean state.
5. Start Package 2 only from updated `main`.

## Package Status Ledger

| Package | Status | Branch | PR | Notes |
| --- | --- | --- | --- | --- |
| Package 0 | merged | `codex/v2-0-recovery-and-persistent-plan` | #50 | Recovery and persistent v2 plan merged to `main`. |
| Package 1 | verified locally | `codex/v2-1-decommission-agent-complexity` | pending | Decommission inventory and safe Agent complexity removal. |
| Package 2 | not started | pending | pending | Conversation runtime persistence redesign. |
| Package 3 | not started | pending | pending | Local RIN/Owner profile configuration. |
| Package 4 | not started | pending | pending | Memory V2 data model and short-term memory. |
| Package 5 | not started | pending | pending | Automatic memory engine and forgetting curve. |
| Package 6 | not started | pending | pending | Context Assembler V2 shadow path. |
| Package 7 | not started | pending | pending | Memory V2 cutover and legacy migration. |
| Package 8 | not started | pending | pending | v2 CLI consolidation and stabilization. |
