# RIN v2.0 Progress

Status: recovery baseline checks passed; PR open.

This file must be updated at every v2.0 checkpoint and before ending any Codex
conversation.

此文件必须在每个 v2.0 checkpoint 更新，并且每次 Codex 对话结束前都要更新。

## Current State

- Current package: Recovery / Package 0 planning baseline.
- Package status: checks passed, PR open, merge gate review in progress.
- Active branch: `codex/v2-0-recovery-and-persistent-plan`.
- Latest verified main commit:
  `c9dfd3681010162a61d54fa246d13f24a5197c6f`.
- PR #49 status: merged on `main` as
  `c9dfd36 Merge pull request #49 from irin818/codex/v1-1-a-daily-chat-quality`.
- Open PRs at recovery inspection: none.
- Interrupted v2 branch found: none.
- Interrupted v2 documents found: none.
- Uncommitted work found at recovery start: none.
- Main/origin/main/HEAD match at recovery start: yes.

## Completed Commits

- `0dec6a4 docs: add RIN v2 recovery plan`
- This progress update is included in the active PR branch; use `git log` for
  the exact final commit hash after push.

## Pull Request

- PR URL/status:
  `https://github.com/irin818/RIN_loading/pull/50` open at checkpoint.

## Checks

- Temporary test data directory:
  `/tmp/rin-v2-recovery-check.jXjLtW`.
- `npm run rin:check`: passed.
- `npm run rin:v1-check`: passed.
- `npm run rin:daily-chat-eval`: passed.
- `git diff --check`: passed.
- External provider calls: `0`.
- Real `.rin-data` committed: no.

## Unresolved Risks

- This recovery task is documentation/governance/process only; it does not
  update source reality to v2.0.
- Current `main` still contains v1/v1.1 Agent scaffolds such as actions,
  planner, tasks, tools/MCP, and L0-L5 permission-level documentation and code.
- Package 1 must distinguish deprecated Agent permission hierarchy from retained
  data-integrity protections before removing anything.
- Default checks may read local `.rin-data` through existing readiness/report
  paths; recovery must not commit local data or generated artifacts.

## Next Exact Task

Finish Package 0 recovery:

1. Run required provider-free checks.
2. Review the diff and confirm it is documentation/governance/process only.
3. Commit, push, open PR, and merge only if all gates pass.
4. After merge, pull `main` and verify clean state.
5. Start Package 1 only from updated `main`; first checkpoint is
   `docs/RIN_V2_DECOMMISSION_INVENTORY.md` with a complete inventory before any
   source removal.

## Package Status Ledger

| Package | Status | Branch | PR | Notes |
| --- | --- | --- | --- | --- |
| Package 0 | in progress | `codex/v2-0-recovery-and-persistent-plan` | pending | Recovery and persistent v2 plan only. |
| Package 1 | not started | pending | pending | Decommission inventory and safe Agent complexity removal. |
| Package 2 | not started | pending | pending | Conversation runtime persistence redesign. |
| Package 3 | not started | pending | pending | Local RIN/Owner profile configuration. |
| Package 4 | not started | pending | pending | Memory V2 data model and short-term memory. |
| Package 5 | not started | pending | pending | Automatic memory engine and forgetting curve. |
| Package 6 | not started | pending | pending | Context Assembler V2 shadow path. |
| Package 7 | not started | pending | pending | Memory V2 cutover and legacy migration. |
| Package 8 | not started | pending | pending | v2 CLI consolidation and stabilization. |
