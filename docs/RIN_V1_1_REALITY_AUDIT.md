# RIN v1.1 Reality Audit

Status: Package A baseline audit.

Date: 2026-06-05.

Branch: `codex/v1-1-a-daily-chat-quality`.

This audit records the verified repository, runtime, script, and local model
state before v1.1 stabilization changes. It treats the current repository,
tests, documentation, and live local runtime checks as source of truth.

## Executive Summary

- `main` was clean, synchronized with `origin/main`, and at merge commit
  `b3c86ad4eb95a663692d7ecb6017851c64b5e7e8` before the Package A branch was
  created.
- All default aggregate and v1 verification commands passed.
- Default checks remain provider-free and external-call-free.
- Local Ollama is installed, reachable after starting the app, and has
  `qwen3:4b` available.
- Live local smoke with `rin-ollama-local` succeeds, but the current live daily
  chat path still leaks internal analysis-style text and a `</think>` marker for
  the prompt `今天晚上吃什么好`.
- Package A must therefore prioritize response-sanitization, daily-chat
  regression coverage, and prompt tuning before broader program work continues.

## Git Resync

Verified commands:

```text
pwd
git status
git branch --show-current
git log --oneline -100
git remote -v
git fetch origin
git checkout main
git pull origin main
git status
git rev-parse main origin/main HEAD
git status --short --branch
git log --oneline --decorate -12
```

Verified state:

- Repository path: `/Users/irin/Documents/RIN_loading`
- Remote: `origin https://github.com/irin818/RIN_loading.git`
- Clean synced base branch: `main`
- Base head: `b3c86ad4eb95a663692d7ecb6017851c64b5e7e8`
- `main`, `origin/main`, and `HEAD` matched before branching.
- Working tree was clean before Package A branch creation.

Latest verified history included:

- `b3c86ad Merge pull request #48 from irin818/cursor/v1-1-a-qwen3-local-chat-hardening`
- `73e113c fix: harden Ollama Qwen3 local chat responses`
- `785664e Merge pull request #47 from irin818/cursor/one-click-rin-launcher`
- `514775d feat: add one-click RIN launcher`
- `b4a281b Merge pull request #46 from irin818/cursor/v1-0-stable-release`

## Governance And Documentation Read

Read and applied:

- `AGENTS.md`
- `PROJECT_CHARTER.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT_PROTOCOL.md`
- `README.md`
- `.env.example`
- `package.json`
- `docs/RIN_V1_RELEASE_NOTES.md`
- `docs/RIN_V1_OPERATIONS_GUIDE.md`
- `docs/RIN_V1_SECURITY_PRIVACY_AUDIT.md`
- `docs/LOCAL_LAUNCHER.md`
- `docs/EXTERNAL_MODEL_HANDOFF.md`
- memory, semantic retrieval, planner, action, backup, sync, body/Live2D, MCP,
  task, migration, and reliability policy docs.

Confirmed governance boundaries:

- RIN remains local-first and single-owner.
- Model providers are replaceable reasoning engines, not identity sources.
- UI must not call providers directly.
- External APIs are optional and explicit only.
- Accepted memory is the only production memory source for context injection.
- Semantic retrieval remains disabled by default and report-only unless
  explicitly configured.
- Tools, actions, planner execution, backup, restore, sync, and body behavior
  remain permission-gated or dry-run/report-only according to their policies.
- Generated/local/private paths remain untracked: `node_modules/`, `dist/`,
  `.rin-data/`, `.env*`, databases, logs, caches, and temporary files.

## Local Environment

Verified local tools:

- Node.js: `v24.16.0`
- npm: `11.13.0`
- `node_modules`: present
- Ollama CLI: `/opt/homebrew/bin/ollama`
- Ollama local API: reachable after `open -ga Ollama`
- Installed local model: `qwen3:4b`

Ignored local/generated directories found:

- `./node_modules`
- `./dist`
- `./.rin-data`

These are covered by `.gitignore`.

## Script Classification

Default real build/test gates:

- `typecheck`, `test`, `lint`, `build`
- `rin:check`
- `rin:full-check`
- `rin:v1-check`

Default local readiness/report commands:

- `rin:readiness`
- `rin:project-report`
- `rin:rollback-notes`
- `rin:integrity-check`
- `rin:recovery-smoke`
- `rin:ops-health-report`

Provider-free fixture or report-only evaluation:

- `rin:memory-eval`
- `rin:semantic-eval`
- `rin:semantic-readiness`
- `rin:semantic-index-report`
- `rin:semantic-live-index-report`
- `rin:hybrid-retrieval-report`
- `rin:semantic-trace-list`
- `rin:semantic-trace-read`
- `rin:memory-maintenance-report`
- `rin:memory-health-report`
- `rin:memory-conflict-report`
- `rin:memory-governance-smoke`

Controlled planner/action/tool/task smoke:

- `rin:planner-smoke`
- `rin:planner-execution-smoke`
- `rin:planner-audit-report`
- `rin:actions-smoke`
- `rin:actions-audit-report`
- `rin:tool`
- `rin:tool-registry-smoke`
- `rin:mcp-boundary-smoke`
- `rin:tool-audit-report`
- `rin:task-smoke`
- `rin:task-audit-report`

Continuity, backup, restore, migration, sync:

- `rin:backup-dry-run`
- `rin:backup-encrypted-smoke`
- `rin:backup-create`
- `rin:backup-verify`
- `rin:restore-dry-run`
- `rin:restore-apply`
- `rin:device-report`
- `rin:sync-dry-run`
- `rin:migration-check`

Local or external live model gates:

- `rin:local-chat-smoke`: skipped by default unless `rin-ollama-local` is
  explicitly selected.
- `rin:external-model-smoke`: skipped/no-call by default unless external
  adapter env and `RIN_EXTERNAL_MODEL_SMOKE=allow` are supplied.

Console and launchers:

- `rin:console`
- `rin:console:server`
- `Start_RIN.command`
- `Start_RIN_Local_Model.command`
- `scripts/start-rin.sh`
- `scripts/start-rin-local-model.sh`

Live2D asset tooling:

- `live2d:assets`
- `live2d:verify-runtime`
- `live2d:source`
- `live2d:source-psd`
- `live2d:verify-source-psd`

## Baseline Command Results

All commands below exited `0`.

| Command | Result | Provider / data classification |
| --- | --- | --- |
| `npm run rin:check` | pass | Typecheck, 59 test files / 280 tests, lint, build, readiness, memory eval. Default provider-free. |
| `npm run rin:full-check` | pass | Default aggregate provider-free reports and controlled fixture smokes. |
| `npm run rin:v1-check` | pass | Full v1 chain including external smoke skip, tools, tasks, sync, body, integrity, recovery, ops. |
| `npm run rin:readiness` | pass with live-model warning | Default mock selected; no live provider. |
| `npm run rin:memory-eval` | pass | 29/29 fixtures; `providerCallCount: 0`. |
| `npm run rin:semantic-eval` | pass | 11/11 fixtures; report-only; `providerCallCount: 0`; expected risk signals visible. |
| `npm run rin:semantic-readiness` | pass | Production semantic retrieval disabled; no real `.rin-data` indexing; `providerCallCount: 0`. |
| `npm run rin:local-chat-smoke` | skipped | Default adapter `rin-mock-local`; local/external calls `0`. |
| `npm run rin:memory-maintenance-report` | pass | Reads local memory metadata safely; mutated memories `0`; `providerCallCount: 0`. |
| `npm run rin:planner-smoke` | pass | Deterministic dry-run blocked report; executed actions `0`; `providerCallCount: 0`. |
| `npm run rin:planner-execution-smoke` | pass | Temporary fixture, explicit test confirmation, two low-risk fixture actions, destructive action blocked. |
| `npm run rin:actions-smoke` | pass | Temporary fixture actions; external network no; `providerCallCount: 0`. |
| `npm run rin:backup-dry-run` | pass | Reads real local `.rin-data`; archive created no; secrets included no; full text no. |
| `npm run rin:restore-dry-run` | pass | Missing manifest report; data mutated no. |
| `npm run rin:external-model-smoke` | skipped | External call attempted no; `providerCallCount: 0`; secrets not printed. |
| `npm run rin:integrity-check` | pass | Manifest/database inspectable; automatic repair no; data mutated no. |
| `npm run rin:ops-health-report` | pass | Readiness/integrity/recovery ready; hidden errors suppressed no; data mutated no. |

## Live Local Model Results

Local Ollama readiness command:

```text
RIN_MODEL_ADAPTER=rin-ollama-local \
RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434 \
RIN_OLLAMA_MODEL=qwen3:4b \
RIN_OLLAMA_TIMEOUT_MS=180000 \
RIN_OLLAMA_NUM_PREDICT=1024 \
RIN_OLLAMA_TEMPERATURE=0.5 \
RIN_OLLAMA_TOP_P=0.9 \
npm run rin:readiness
```

Result:

- Ready: yes
- Live model ready: yes
- Local model ready: yes
- External model ready: no

Live local smoke command:

```text
RIN_MODEL_ADAPTER=rin-ollama-local \
RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434 \
RIN_OLLAMA_MODEL=qwen3:4b \
RIN_OLLAMA_TIMEOUT_MS=180000 \
RIN_OLLAMA_NUM_PREDICT=1024 \
RIN_OLLAMA_TEMPERATURE=0.5 \
RIN_OLLAMA_TOP_P=0.9 \
npm run rin:local-chat-smoke
```

Result:

- Status: success
- Adapter: `rin-ollama-local`
- Provider: local
- Model: `qwen3:4b`
- Local model calls: `1`
- External provider calls: `0`
- Full text included: no
- Raw provider response included: no
- Thinking included: no
- Content length: `1801`

Audit note: the smoke command does not currently inspect the returned text
content, and the reported content length is high for a prompt asking for three
sentences. Package A should add deterministic text-shape and leakage checks.

## Daily Chat Reality Probe

An explicit live runtime probe was run with a temporary `RIN_DATA_DIR`, not the
real `.rin-data`, using:

- Adapter: `rin-ollama-local`
- Model: `qwen3:4b`
- Prompt: `今天晚上吃什么好`
- Output length: `857`

Observed result:

- Internal analysis-style wording leaked into the assistant message.
- The reply referenced RIN identity/architecture instead of simply answering the
  daily-life prompt.
- A closing `</think>` marker was included in the stored assistant content.
- The final usable answer existed only after the leaked internal analysis.

The full leaked text is intentionally not copied into this repository document.

Severity:

- High for Package A.
- This does not fail the current automated baseline because there is no daily
  chat regression harness yet.
- It blocks expansion work until fixed and covered.

## Current Source Reality

Verified implementation facts:

- `src/model/ollamaAdapter.ts` sends `think: false` to `/api/chat`.
- `src/model/ollamaAdapter.ts` rejects empty `message.content` with
  `MODEL_RESPONSE_INVALID`, including a reasoning-only hint when reasoning-like
  response fields are present.
- `src/model/config.ts` defaults Ollama to `qwen3:4b`, timeout `180000ms`,
  `num_predict=1024`, `temperature=0.5`, and `top_p=0.9`.
- `src/conversation/runtime.ts` rolls back failed turns and logs safe failure
  audit metadata without storing a fake RIN reply.
- `src/context/rinSystemPrompt.ts` still foregrounds RIN architecture and local
  slow-variable framing, which appears to influence daily-life prompts too much.
- `src/context/contextBuilder.ts` preserves the system prompt and latest owner
  message, bounds accepted-memory injection, and keeps memory trace metadata.
- `src/memory/retrieval.ts` filters to accepted memories only.
- `src/context/semanticContextConfig.ts` defaults semantic context expansion to
  `off`.
- `src/backup/*`, `src/sync/*`, `src/actions/*`, `src/planner/*`, `src/tasks/*`,
  `src/tools/*`, and `src/reliability/*` are currently covered by passing smoke
  and report commands.
- Browser UI routes model calls through the local server/runtime rather than
  directly to providers.

## Problems Found

1. Daily chat leakage is real in live local runtime output.
2. Existing `rin:local-chat-smoke` can pass while the actual content is too
   verbose or quality-poor because it does not inspect the text.
3. The current compact system prompt is still architecture-heavy for ordinary
   daily-life prompts.
4. There is no default provider-free daily chat quality evaluation command.
5. Existing automated tests cover empty content, response fields, runtime
   rollback, and local smoke metadata, but not full thinking-tag stripping from
   non-empty `message.content`.

## Package A Required Work

Package A should:

- Add deterministic daily-chat fixtures covering common harmless daily prompts.
- Reject or sanitize non-empty assistant content containing thinking artifacts
  such as `<think>` / `</think>` and internal analysis-style preambles.
- Ensure raw thinking output is not stored as `rinMessage.content`.
- Keep empty or thinking-only responses as structured model errors.
- Tune the RIN system prompt so daily chat is natural, concise, useful, and
  truthful without dumping governance or identity framing.
- Add a provider-free `npm run rin:daily-chat-eval`.
- Add an optional live `npm run rin:daily-chat-live-smoke` for explicit local
  Ollama checks.
- Update docs so current launch and live-model behavior is accurate.

## Baseline Expansion Readiness

Package A remediation is required before broader expansion.

Reason: live daily chat still leaks internal analysis and architecture framing.
Package A must close this before Packages B-E continue.

## Package A Remediation Addendum

After the baseline audit, Package A added:

- model-layer assistant content sanitization for recognized Qwen3 thinking-tag
  output;
- final-paragraph extraction when untagged internal analysis is followed by a
  clean final answer;
- structured `MODEL_RESPONSE_INVALID` behavior when thinking-only or unsafe
  internal-analysis content has no safe final answer;
- a less architecture-heavy RIN system prompt for harmless daily-life prompts;
- provider-free daily chat evaluation through `npm run rin:daily-chat-eval`;
- optional local Ollama daily live smoke through
  `npm run rin:daily-chat-live-smoke`;
- documentation updates for local launch, operations, privacy, and architecture.

Verified after remediation:

- `npm run rin:daily-chat-eval`: passed, 8/8 provider-free fixtures.
- Explicit local `npm run rin:local-chat-smoke`: passed with
  `rin-ollama-local`, `qwen3:4b`, local calls `1`, external calls `0`, no full
  text printed, no thinking included.
- Explicit local `npm run rin:daily-chat-live-smoke`: passed with
  `rin-ollama-local`, `qwen3:4b`, daily cases `2/2`, local calls `2`,
  external calls `0`, real `.rin-data` read `no`, no full text printed, no
  thinking included.

Current Package A status: daily-chat expansion blocker is closed for the tested
Qwen3 local runtime path after remediation. Broader Packages B-E should still
run their own package-specific audits before expansion.

## 中文摘要

本次审计确认：仓库主分支干净且同步，默认检查和 v1 检查全部通过，默认路径没有调用外部
API。本机 Ollama 和 `qwen3:4b` 可用，显式本地模型 smoke 可以成功。

基线审计时，真实本地 runtime 对日常问题 `今天晚上吃什么好` 仍然会把内部分析风格文本和
`</think>` 写入 RIN 回复。Package A 已补 daily chat eval、thinking artifact 处理、
未标记内部分析后的最终段落提取、system prompt 调整，以及显式本地 daily live smoke。
修复后，本机 `qwen3:4b` 的 daily live smoke 通过，未打印全文、未读取真实 `.rin-data`、
未调用外部 API。
