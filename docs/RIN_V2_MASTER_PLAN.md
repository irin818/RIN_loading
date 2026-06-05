# RIN v2.0 Master Plan

Status: active planning baseline.

Latest verified base at creation: `c9dfd3681010162a61d54fa246d13f24a5197c6f`
(`main`, `origin/main`, `HEAD`).

This document is the repository-persisted execution plan for the RIN v2.0
Conversation-Centered Core Redesign. It exists so future Codex conversations do
not depend on one long chat context.

此文件是 RIN v2.0 会话中心核心重构的仓库内持久计划，用来保证后续 Codex
对话可以从仓库文档继续，而不是依赖某一次超长聊天上下文。

## Program Direction

RIN v2.0 re-centers near-term development on a local-first, single-owner,
conversation-centered and memory-centered personal AI core.

RIN v2.0 的近期目标是把系统重新收敛到本地优先、单一所有者、以自然对话与记忆连续性
为中心的个人 AI 核心。

Core target:

- Local Ollama/Qwen3 4B remains the recommended first real chat target.
- External APIs remain optional adapters only, never the identity source.
- Natural conversation quality, persistence safety, and memory continuity are
  higher priority than autonomous Agent expansion.
- Raw conversation records are preserved.
- Short-term and long-term memory are bounded, deduplicated, traceable, and
  locally governed.
- RIN and Owner profiles are manually editable local files and are not
  model-editable.
- Future screen awareness, proactive conversation, and Live2D-controlled
  behavior remain possible but are not part of the v2.0 core package sequence.

核心目标：

- 本地 Ollama/Qwen3 4B 仍是第一个推荐真实聊天目标。
- 外部 API 仅作为可选 adapter，不成为身份来源。
- 自然对话质量、持久化安全和记忆连续性优先于自主 Agent 扩张。
- 原始对话记录必须保留。
- 短期与长期记忆必须有界、去重、可追溯，并由本地规则治理。
- RIN 与 Owner profile 是手动编辑的本地文件，模型不可编辑。
- 未来屏幕感知、主动对话和 Live2D 行为控制可以保留接口想象，但不进入 v2.0
  核心包序列。

## Frozen Areas

During Packages 0-8, do not develop new capabilities in:

- server or UI/Console
- backup, restore, sync, or reliability
- body/Live2D
- external provider integrations

Minimal compile, import, script, or reference cleanup is allowed only when it is
required by deprecated module removal or documentation consistency.

冻结区域：

- server 或 UI/Console
- backup、restore、sync、reliability
- body/Live2D
- 外部 provider 集成

只有在废弃模块移除导致引用失效时，才允许做最小编译、导入、脚本或引用修正。

## Non-Negotiable Invariants

- Models cannot overwrite profiles, identity, raw conversation history, or
  accepted memory records directly.
- Raw conversations are never automatically deleted by memory decay.
- Forgetting reduces retrieval priority rather than deleting history.
- Migrations must be transactional, backward-compatible, and dry-run capable
  where data safety matters.
- No secrets, API keys, tokens, local databases, logs, `.rin-data/`,
  `node_modules/`, or `dist/` may be committed.
- Default checks must remain provider-free and external-call-free.
- No destructive database operation may be introduced without explicit owner
  intent and a documented rollback path.

不可变约束：

- 模型不能直接覆盖 profile、身份、原始对话历史或已接受记忆。
- 原始对话不会因为遗忘机制而被自动删除。
- 遗忘只降低检索优先级，不删除历史。
- 涉及数据安全的 migration 必须可事务化、向后兼容，并尽量支持 dry-run。
- 不提交密钥、token、本地数据库、日志、`.rin-data/`、`node_modules/` 或 `dist/`。
- 默认检查必须保持 provider-free、external-call-free。
- 不引入未经明确授权且没有回滚方案的破坏性数据库操作。

## Package Sequence

Each package must start from an updated, verified `main`, use its own
`codex/...` branch, produce coherent commits, pass required gates, open a PR,
and merge only after review confirms scope and safety.

每个 package 都必须从已更新并验证的 `main` 开始，使用独立 `codex/...` 分支，形成
内聚提交，通过检查，创建 PR，并在范围与安全审查通过后合并。

### Package 0: Governance and scope re-baseline

Goal:

- Persist the v2.0 direction in governance and process docs.
- Make future Codex continuation independent of chat context.

Allowed scope:

- Governance, architecture, process, README, and planning documentation.
- Documentation-only clarification of deprecated Agent complexity.
- Recovery of any interrupted documentation-only v2 work if it is understood.

Forbidden scope:

- Runtime/source changes.
- Database migrations.
- CLI behavior changes.
- UI/server/body/Live2D work.
- Removing code modules.

Dependencies:

- Clean, synchronized `main`.
- PR #49 present on `main`.
- No unknown uncommitted work.

Checkpoints:

- Inspect git, branches, open PRs, and any interrupted v2 artifacts.
- Read governance, architecture, README, package scripts, and v1/v1.1 docs.
- Create or update v2 master plan, progress tracker, and decisions log.
- Add Codex continuation protocol.

Required tests:

- `npm run rin:check`
- `npm run rin:v1-check`
- `npm run rin:daily-chat-eval`
- `git diff --check`

Migration risks:

- Documentation may overstate implementation reality.
- Governance may accidentally weaken local-first or data-integrity boundaries.

Merge gates:

- Changes are documentation/governance/process only.
- All required checks pass.
- No secrets, local data, generated output, or runtime code touched.
- PR is mergeable.

Completion definition:

- v2 plan, progress, and decisions are committed to the repository.
- Handoff protocol is documented.
- PR is merged and `main` is clean at a verified commit.

### Package 1: Decommission Agent complexity and permission hierarchy

Goal:

- Inventory and safely remove active autonomous Agent scaffolding that no longer
  matches the v2 conversation-centered core.

Allowed scope:

- Create `docs/RIN_V2_DECOMMISSION_INVENTORY.md`.
- Inventory actions, planner, tasks, tools/MCP, runtime permission levels,
  L0-L5 references, tool audit paths, scripts, tests, and docs.
- Remove active Agent complexity only when references and replacement needs are
  understood.
- Update scripts, imports, tests, and docs directly affected by removals.

Forbidden scope:

- Removing database safety, migrations, conversation audit, model quality
  checks, profile protection, memory integrity, backup/restore source, sync
  source, reliability source, or body source.
- Introducing a replacement permission hierarchy.
- Changing UI/server behavior beyond compile/reference fixes.
- Deleting `.rin-data/`, backup bundles, owner data, or generated dependency
  folders.

Dependencies:

- Package 0 merged.
- Current `docs/RIN_V2_PROGRESS.md` points to Package 1.

Checkpoints:

- Complete inventory with each item classified as safe to remove, still
  referenced, frozen dependency, requires replacement, or uncertain.
- Remove only safe items.
- Confirm no stale imports, scripts, or docs present active Agent claims.

Required tests:

- `npm run rin:check`
- `npm run rin:v1-check` unless intentionally replaced by a documented v2 gate
- `npm run rin:memory-eval`
- `npm run rin:daily-chat-eval`
- targeted tests for removed modules and affected scripts
- `git diff --check`

Migration risks:

- Agent scaffolds may be referenced by broad v1 check chains.
- Removing permission levels could accidentally remove data-integrity
  protections if not separated carefully.

Merge gates:

- Conversation, memory, model quality, storage, and audit paths still pass.
- Deprecated modules have no active imports or package scripts unless explicitly
  frozen.
- The inventory explains every retained or uncertain item.

Completion definition:

- Deprecated Agent complexity is either removed or explicitly documented as
  retained/frozen with reason.
- Main still has passing provider-free conversation and memory checks.

### Package 2: Conversation runtime and persistence redesign

Goal:

- Make conversation turn persistence safe: owner message and turn-start are
  persisted before model calls, and RIN replies are never displayed before they
  are stored.

Allowed scope:

- Conversation runtime, repository transaction boundaries, audit events,
  failure/retry semantics, idempotent turn IDs, and tests.
- ADR documenting transaction design.
- Timing metrics and `npm run rin:conversation-runtime-report`.

Forbidden scope:

- UI/server feature development, except minimal endpoint compatibility if a
  runtime contract requires it.
- Streaming response work.
- External provider changes outside adapter-neutral behavior.
- Fake RIN replies on failure.

Dependencies:

- Package 1 merged or explicitly deferred with no active conflict.
- Existing conversation tests understood.

Checkpoints:

- Persist owner message and turn-start before model call.
- Call model outside long database transactions.
- Use a short transaction for RIN reply, audit, and state updates.
- Preserve owner message on model failure.
- Provide explicit retry semantics and duplicate-reply prevention.

Required tests:

- `npm run rin:check`
- `npm run rin:memory-eval`
- `npm run rin:daily-chat-eval`
- focused transaction/failure/retry/idempotency/history tests
- `npm run rin:conversation-runtime-report`
- `git diff --check`

Migration risks:

- Existing failed-turn rollback behavior changes.
- Stored history ordering and retry semantics may affect UI expectations.

Merge gates:

- No RIN reply can be returned or displayed before persistence.
- Model failures preserve owner messages without fake assistant content.
- Runtime does not hold long DB transactions during model calls.

Completion definition:

- Safe transaction model is implemented, documented, and covered by regression
  tests.

### Package 3: Local RIN and Owner profile configuration

Goal:

- Introduce manually editable local RIN and Owner profile files that compactly
  guide conversation context without model-editable profile mutation.

Allowed scope:

- `.rin-data/config/rin_profile.json` and `owner_profile.json` templates,
  schemas, validation, loaders, safe reports, CLI validation/report commands,
  and compact profile context formatting.

Forbidden scope:

- Console editing.
- Model-driven profile mutation or automatic profile evolution.
- Committing real local profile data.
- Dumping full private profile text in reports.

Dependencies:

- Package 2 persistence semantics stable.
- Existing config/data-dir path helpers understood.

Checkpoints:

- Define profile schemas and defaults.
- Add validation CLI and report CLI.
- Integrate compact profile context into model context.
- Ensure profiles are local-only and ignored when real data is generated.

Required tests:

- `npm run rin:check`
- `npm run rin:memory-eval`
- `npm run rin:daily-chat-eval`
- `npm run rin:profile-validate`
- `npm run rin:profile-report`
- schema, loader, redaction, and context formatting tests
- `git diff --check`

Migration risks:

- Profile content could become too verbose for context budget.
- Reports could leak private profile text if not redacted.

Merge gates:

- Profiles are manually editable only.
- Model output cannot write profile files.
- Reports avoid full private text and secrets.

Completion definition:

- RIN and Owner profile files are locally configurable, validated, and compactly
  available to context assembly.

### Package 4: Memory V2 data model and short-term memory

Goal:

- Add a shadow Memory V2 schema and a five-hour rolling short-term memory window
  without changing production retrieval yet.

Allowed scope:

- Shadow tables or equivalent structures for memory signals, traces, trace
  sources, and retrieval events.
- Short-term memory reporting.
- Schema/report CLIs.

Forbidden scope:

- Production retrieval cutover.
- Full raw message duplication into memory tables.
- Automatic deletion of raw conversations.
- Model-provider calls.

Dependencies:

- Package 3 profile/context boundary stable.
- Database migration safety reviewed.

Checkpoints:

- Design schema with provenance and no raw-history duplication.
- Add idempotent migration.
- Build five-hour short-term window report.
- Keep existing accepted-memory retrieval unchanged.

Required tests:

- `npm run rin:check`
- `npm run rin:memory-eval`
- `npm run rin:daily-chat-eval`
- `npm run rin:short-term-memory-report`
- `npm run rin:memory-v2-schema-report`
- migration/idempotency/report tests
- `git diff --check`

Migration risks:

- Schema could duplicate sensitive raw content unnecessarily.
- Migration errors could affect existing SQLite state.

Merge gates:

- Production retrieval remains unchanged.
- Migration is backward-compatible and idempotent.
- Raw conversations remain the source of raw history.

Completion definition:

- Memory V2 schema and short-term reporting exist in shadow mode with passing
  migration tests.

### Package 5: Automatic memory formation and forgetting-curve engine

Goal:

- Add a deterministic shadow memory engine that forms, reinforces, and lowers
  retrieval priority using biologically inspired retention scoring.

Allowed scope:

- Deterministic signal extraction, scoring, reinforcement, decay, fixtures,
  reports, and shadow writes.
- Retention-style scoring such as `exp(-age / stability)` where justified.
- `rin:memory-v2-eval` and `rin:memory-v2-shadow-report`.

Forbidden scope:

- Automatic deletion of raw history.
- Automatic profile mutation.
- Hidden reasoning or chain-of-thought extraction.
- Production retrieval cutover.
- Non-deterministic provider-dependent memory formation.

Dependencies:

- Package 4 shadow data model merged.

Checkpoints:

- Define formation, reinforcement, and forgetting scores.
- Add deterministic fixtures for daily, preference, project, contradiction, and
  low-signal conversations.
- Report why traces are promoted, reinforced, weakened, or ignored.

Required tests:

- `npm run rin:check`
- `npm run rin:memory-eval`
- `npm run rin:memory-v2-eval`
- `npm run rin:memory-v2-shadow-report`
- deterministic fixture and no-provider-call tests
- `git diff --check`

Migration risks:

- Automatic memory could overfit temporary emotions or low-signal chatter.
- Forgetting could be misread as deletion unless reporting is precise.

Merge gates:

- Engine is shadow-only.
- No automatic deletion or profile mutation.
- Reports are deterministic and provider-free.

Completion definition:

- Memory V2 engine produces explainable shadow traces with stable fixture
  results.

### Package 6: Context Assembler V2

Goal:

- Add a shadow Context Assembler V2 with explicit ordering, provenance,
  deduplication, and budget controls.

Allowed scope:

- Shadow context assembly, budget accounting, provenance reports, deduplication,
  and evaluation fixtures.
- `rin:context-v2-report` and `rin:context-v2-eval`.

Forbidden scope:

- UI/server work.
- External provider calls.
- Production cutover before Memory V2 is ready.
- Unbounded context growth.

Dependencies:

- Packages 3-5 merged.

Checkpoints:

- Implement shadow context order:
  system, RIN profile, Owner profile, current Owner message, recent short-term
  window, relevant long-term Memory V2 traces, and older references if budget
  remains.
- Add deduplication and provenance.
- Verify latest Owner message cannot be displaced.

Required tests:

- `npm run rin:check`
- `npm run rin:memory-eval`
- `npm run rin:daily-chat-eval`
- `npm run rin:context-v2-report`
- `npm run rin:context-v2-eval`
- budget, ordering, deduplication, and provenance tests
- `git diff --check`

Migration risks:

- Context ordering can change model behavior even before production cutover if
  accidentally wired in.
- Privacy reports could expose too much context.

Merge gates:

- Shadow assembler is not used in production unless explicitly enabled.
- Provenance and budget behavior are deterministic.
- Latest owner message remains protected.

Completion definition:

- Context V2 can be evaluated in shadow mode with clear reports and no runtime
  production behavior change.

### Package 7: Memory V2 production cutover and legacy migration

Goal:

- Cut production memory retrieval over to Memory V2/Context Assembler V2 while
  preserving legacy accepted memories and raw conversation history.

Allowed scope:

- Dry-run/apply/status migration CLI.
- Idempotent legacy accepted-memory migration.
- Production retrieval switch once dry-run proves safe.
- `/remember` deprecation path.

Forbidden scope:

- Destructive deletion of legacy records.
- Raw conversation deletion.
- Automatic overwrite of accepted memory without trace.
- UI/server feature development beyond compatibility.

Dependencies:

- Packages 4-6 merged and stable.

Checkpoints:

- Build dry-run migration report.
- Validate legacy accepted memories map into Memory V2 traces.
- Add apply/status commands with idempotency.
- Switch production retrieval only after dry-run parity checks.

Required tests:

- `npm run rin:check`
- `npm run rin:memory-eval`
- `npm run rin:daily-chat-eval`
- Memory V2 migration dry-run/apply/status commands
- legacy accepted-memory parity tests
- `git diff --check`

Migration risks:

- Legacy accepted memories might lose semantics or provenance.
- Production context could change unexpectedly if parity checks are weak.

Merge gates:

- Legacy records are preserved.
- Migration is idempotent and reversible by keeping legacy tables/records.
- Raw messages are untouched.
- Production retrieval has deterministic parity or documented differences.

Completion definition:

- Memory V2 and Context Assembler V2 are the production memory/context path with
  safe legacy preservation.

### Package 8: CLI consolidation, repository cleanup, and v2.0 stabilization

Goal:

- Consolidate v2 checks, remove stale references, stabilize documentation, and
  prepare the v2.0.0 tag.

Allowed scope:

- CLI script cleanup.
- `npm run rin:v2-check`.
- Documentation updates for v2 operation.
- Final provider-free stabilization checks.
- v2.0.0 tag after merged main verification.

Forbidden scope:

- New product capabilities.
- UI/server/body/Live2D expansion.
- External API live calls by default.
- Broad unrelated refactors.

Dependencies:

- Packages 0-7 merged.

Checkpoints:

- Add v2 aggregate check.
- Remove or archive stale docs/scripts that claim active Agent behavior.
- Run repeated provider-free checks.
- Optionally run explicit local Ollama live checks if local runtime is available
  and the owner wants live verification.

Required tests:

- `npm run rin:v2-check`
- `npm run rin:check`
- `npm run rin:v1-check` only if still intentionally supported
- `npm run rin:daily-chat-eval`
- `git diff --check`

Migration risks:

- Removing old checks too early can hide regressions.
- Tagging before main is clean and verified creates a misleading release.

Merge gates:

- v2 aggregate check is provider-free and passes.
- Documentation accurately describes implemented behavior.
- Main is clean after merge and final pull.

Completion definition:

- `main` is verified clean after final merge.
- v2.0 docs and checks pass.
- `v2.0.0` tag is created and pushed only after final verification.

## Stop Conditions

Stop and report instead of continuing when:

- `main` is dirty, diverged, or not synchronized with `origin/main`.
- Unknown user changes are present and affect package scope.
- Governance direction conflicts with source reality.
- Agent removal breaks conversation, memory, audit, migration, or data safety.
- Migration could lose raw messages, accepted memories, profile data, or audit
  history.
- Memory V2 behavior is nondeterministic or provider-dependent by default.
- Profile implementation would require committing real owner data.
- The task requires new UI/server/body/Live2D capability during frozen packages.
- Required checks fail for an unexplained or unrelated reason.
- A package cannot meet merge gates.

停止条件：

- `main` 脏、分叉或未与 `origin/main` 同步。
- 存在影响当前 package 的未知用户改动。
- 治理方向与源码事实冲突。
- Agent 移除破坏对话、记忆、审计、migration 或数据安全。
- migration 有丢失原始消息、已接受记忆、profile 数据或审计历史风险。
- Memory V2 默认行为变成非确定性或依赖 provider。
- profile 实现需要提交真实所有者数据。
- 冻结 package 中需要新增 UI/server/body/Live2D 能力。
- 必需检查失败且原因不清或与任务无关。
- package 无法满足 merge gate。
