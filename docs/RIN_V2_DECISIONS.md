# RIN v2.0 Decisions

Status: active decision log.

This file records durable v2.0 architectural decisions. Add new entries when a
package makes or changes a decision that future Codex conversations must
preserve.

此文件记录 v2.0 的长期架构决策。每个 package 如新增或改变会影响后续 Codex
工作的决策，都必须更新此文件。

## Decision 0001: v2.0 is conversation-centered, not a general autonomous Agent

Decision:

- RIN v2.0 focuses on natural local conversation, safe persistence, and memory
  continuity.
- It is not a general-purpose autonomous Agent expansion.

Rationale:

- The immediate product value is a reliable personal AI conversation and memory
  core.
- Existing Agent scaffolds create maintenance and conceptual complexity before
  the core conversation/memory path is mature.

Implications:

- New autonomous action features are out of scope for Packages 0-8.
- Future automation can be reconsidered only after v2.0 memory and conversation
  foundations are stable.

## Decision 0002: actions, planner, tasks, tools, and MCP are removed from active v2

Decision:

- The actions/planner/tasks/tools/MCP scaffolds are removed from active RIN v2
  source, CLI, npm script, server, and UI surfaces.
- Historical records and old docs may remain for compatibility/history, but they
  do not define active v2 behavior.

Rationale:

- These modules reflect the earlier Agent direction.
- v2.0 prioritizes a smaller, conversation-centered core.

Implications:

- Removal must not break conversation, memory, model, storage, audit,
  backup/restore, sync, reliability, or body boundaries.
- Future automation must be reconsidered through a separate governed package,
  not by restoring the old scaffolds implicitly.

## Decision 0003: L0-L5 runtime permission hierarchy is removed from active v2

Decision:

- The active Agent runtime permission hierarchy and L0-L5 model are removed from
  RIN v2.
- New v2 data directories no longer generate `config/permissions.json`.

Rationale:

- v2.0 does not execute general tools or autonomous actions.
- A complex action permission hierarchy is unnecessary for the near-term
  conversation/memory core.

Implications:

- Documentation must distinguish removed Agent permissions from retained safety
  invariants.
- Future integrations must not introduce a replacement permission hierarchy
  without explicit governance.

## Decision 0004: data-integrity protections remain mandatory

Decision:

- Removing Agent permission hierarchy does not remove data-integrity
  protections.

Retained protections:

- Models cannot overwrite profiles, identity, raw history, accepted memory, or
  audit records directly.
- Destructive local data operations require explicit owner intent and safe
  migration/rollback design.
- Migrations must protect existing data.
- Secrets and local data stay untracked.

Implications:

- Any package that weakens these invariants must stop.
- Package 1 must not delete safety checks that protect storage, migration,
  memory, profile, audit, backup, sync, or restore behavior.

## Decision 0005: raw conversations are never automatically deleted

Decision:

- Raw conversation history remains preserved local state.

Rationale:

- RIN identity and continuity depend on auditable history.
- Forgetting should affect retrieval priority, not destroy records.

Implications:

- Memory V2 may summarize, score, downrank, or ignore traces.
- Memory V2 must not automatically delete raw messages.

## Decision 0006: forgetting reduces retrieval priority rather than deleting history

Decision:

- Forgetting in Memory V2 means reduced salience or retrieval priority.

Rationale:

- Biologically inspired memory decay can improve relevance without destroying
  evidence.

Implications:

- Memory decay reports must avoid implying deletion.
- Raw records and legacy accepted memories remain preserved unless the owner
  explicitly requests a safe destructive operation.

## Decision 0007: Owner and RIN profiles are local files and not model-editable

Decision:

- Owner and RIN profiles will be manually editable local files.
- Model output may not mutate these files.

Rationale:

- Profiles are slow variables that define continuity and personalization.
- Single model outputs are not authoritative enough to rewrite profiles.

Implications:

- Package 3 must implement schema validation and safe report output.
- Profile context must be compact, bounded, and redacted in reports.

## Decision 0008: server/UI, body, backup/sync/reliability are frozen during v2 core work

Decision:

- Packages 0-8 do not develop new capabilities in server/UI, body/Live2D,
  backup/restore, sync, or reliability.

Rationale:

- The v2 core needs a narrow path to stabilize conversation and memory without
  broad product expansion.

Implications:

- Minimal compile or reference fixes are allowed only when caused by scoped
  removal or runtime changes.
- Any feature request in frozen areas must become a separate future plan after
  v2.0.

## Decision 0009: response-before-persistence and streaming are deferred

Decision:

- Returning or streaming RIN responses before persistence is deferred.

Rationale:

- Safe response-before-persistence and streaming would require server/UI work,
  which is frozen during v2 core work.
- Package 2 prioritizes persistence correctness over perceived latency.

Implications:

- RIN replies must not be returned/displayed before they are persisted.
- Future streaming must be designed after server/UI thawing and must preserve
  persistence and audit guarantees.

## Decision 0010: legacy tool invocation schema remains for compatibility

Decision:

- The SQLite `tool_invocations` table and `DatabaseStatus.counts.toolInvocations`
  remain in v2.
- Old historical tool/action/planner/task records are not deleted by Package 1.

Rationale:

- Owners may have v1 databases containing old records.
- Package 1 is not a destructive migration task.

Implications:

- Legacy counts may be displayed as compatibility status, but they must not imply
  active tool execution.
- Future schema cleanup requires an explicit destructive migration design and
  owner-reviewed backup/rollback plan.

## Decision 0011: model-response policy is a data-integrity guard

Decision:

- `evaluateModelResponse` remains as a data-integrity guard for direct memory
  writes and direct external side-effect requests.
- It is not an Agent permission gateway and does not implement L0-L5 risk
  levels.

Rationale:

- Removing Agent permissions must not allow model output to mutate memory or
  trigger side effects directly.

Implications:

- Future memory/profile/runtime packages must preserve this boundary or replace
  it with a stricter data-integrity design.

## Decision 0012: conversation turns persist before model calls

Decision:

- Owner messages and `conversation_turns` rows are committed before model adapter
  calls.
- Model adapter calls run outside long database transactions.
- RIN replies are returned only after the reply message and completion metadata
  are stored.
- Failed turns preserve the owner message and turn metadata but never store a
  fake RIN reply.

Rationale:

- Raw owner messages are local history and should not disappear because a model
  provider fails.
- Database transactions should stay short and should not wait on local or
  external model generation.

Implications:

- `turnId` is the idempotency key for retry and duplicate-reply prevention.
- Retrying a failed turn with the same content reuses the owner message and
  increments the attempt count.
- Reusing a completed `turnId` returns the stored reply without calling the
  model adapter again.
- See `docs/decisions/ADR-0003-conversation-turn-persistence.md`.

## Decision 0013: local profiles are manual slow variables

Decision:

- `config/rin_profile.json` and `config/owner_profile.json` are manually
  editable local slow-variable files.
- They can provide compact model context through the runtime.
- Model output cannot write or evolve these profile files.
- Profile reports must avoid full private profile text.

Rationale:

- Profiles are high-impact continuity data and should not be rewritten by a
  single generated response.
- Compact profile context improves personalization without expanding memory
  mutation scope.

Implications:

- Profile loaders validate schemas and fall back to no profile context when
  invalid.
- `rin:profile-validate` may fail on invalid local profile files.
- `rin:profile-report` reports status/counts/issues only.

## Decision 0014: Memory V2 starts as shadow schema and reports

Decision:

- Memory V2 begins with additive shadow tables for trace sources, traces,
  trace signals, and retrieval events.
- The five-hour short-term memory report references raw conversation messages
  by ID, role, timestamp, and character count only.
- Production accepted-memory retrieval remains unchanged.
- Full raw conversation text is not duplicated into Memory V2 tables.

Rationale:

- Memory V2 needs schema and reporting foundations before automatic formation,
  decay, or production retrieval cutover.
- Raw conversations remain the source of raw history and must stay auditable.

Implications:

- `rin:memory-v2-schema-report` reports shadow schema readiness without provider
  calls.
- `rin:short-term-memory-report` is report-only and prints no full message text.
- Future Memory V2 engines may write shadow traces, but production retrieval
  cannot switch until an explicit cutover package.

## Decision 0015: Memory V2 automatic formation is deterministic and shadow-only

Decision:

- Memory V2 formation, reinforcement, weakening, and ignore decisions are
  deterministic shadow behavior.
- Retention scoring uses bounded visible inputs such as source type, role,
  content length, pattern-based signals, age, stability, and
  `baseScore * exp(-ageHours / stabilityHours)`.
- The engine may write trace summaries and signals to `memory_v2_*` shadow
  tables.
- It cannot delete raw history, mutate profiles, mutate accepted memories,
  extract hidden reasoning, call providers, or change production retrieval.

Rationale:

- Automatic memory behavior needs repeatable local evaluation before it can
  influence model context.
- Shadow traces allow audit and tuning without changing the owner-visible memory
  contract.

Implications:

- `rin:memory-v2-eval` must remain fixture-based and provider-free.
- `rin:memory-v2-shadow-report` may mutate only Memory V2 shadow tables.
- Reports must not print raw message text, accepted memory text, prompt text, or
  hidden reasoning.

## Decision 0016: Context V2 is shadow-only until explicit cutover

Decision:

- Context V2 assembles candidate context in a report/evaluation path only.
- Its intended order is system, RIN profile, Owner profile, current Owner
  message, recent short-term window, relevant Memory V2 traces, then older
  references if budget remains.
- It reports provenance, deduplication, budget accounting, and whether the
  latest Owner message is preserved.
- It does not feed production model calls before an explicit cutover package.

Rationale:

- Context ordering can change model behavior, so it must be observable and
  tested before production use.
- Provenance and privacy reporting are needed before Memory V2 retrieval is
  allowed to influence runtime context.

Implications:

- `rin:context-v2-report` and `rin:context-v2-eval` are provider-free.
- Reports must not print full prompt, profile, message, or memory text.
- Production `buildModelContext` still owns provider-facing message construction
  until a later explicit assembler cutover; Package 7 may use Memory V2 as the
  production accepted-memory candidate source.

## Decision 0017: legacy accepted-memory cutover is additive and parity-first

Decision:

- Legacy accepted `memory_items` are mapped into Memory V2
  `legacy_memory_item` retrieval-candidate traces through explicit dry-run,
  apply, and status commands.
- The migration is idempotent and additive: it writes only `memory_v2_*` trace
  rows and preserves legacy accepted memory records and raw messages.
- Production accepted-memory retrieval uses Memory V2 migrated legacy traces
  when every accepted legacy memory has a corresponding retrieval trace.
- If the migration is incomplete, production retrieval falls back to legacy
  accepted memory records rather than dropping owner-reviewed memory.
- `/remember` remains a deprecated legacy proposal-only path; it does not
  directly accept long-term memory and does not make memory model-editable.

Rationale:

- Owner-reviewed accepted memories are slow-variable data and must not lose
  retrieval semantics during the Memory V2 cutover.
- A fallback is safer than silently omitting accepted memories when a local data
  directory has not yet run the Package 7 migration command.
- Keeping legacy records makes the cutover reversible without destructive
  schema changes.

Implications:

- `rin:memory-v2-migration-dry-run` and `rin:memory-v2-migration-status` print
  IDs and counts only, not accepted memory text.
- `rin:memory-v2-migration-apply` must not mutate `memory_items`, raw messages,
  profiles, or provider configuration.
- Runtime raw/audit payloads may record `memoryRetrievalSource` and migration
  counts for traceability.
- Context V2 remains report/evaluation-only for provider-facing message order
  until a later explicit assembler cutover.

## Decision 0018: v2 release gate is provider-free and non-applying

Decision:

- `npm run rin:v2-check` is the v2.0 stabilization and release-readiness gate.
- It is provider-free and external-call-free by default.
- It runs v2-specific report and evaluation commands but does not run
  `rin:memory-v2-migration-apply`.
- Historical v0.x/v1 policy documents may remain for audit context, but active
  v2 behavior is defined by the v2 governance, architecture, progress,
  decisions, README, and stabilization notes.

Rationale:

- Release checks should be safe to run against local data without silently
  applying migrations or calling external providers.
- Real legacy-memory migration should remain an explicit owner action.
- Historical documents are useful for traceability, but they should not be
  mistaken for current active Agent/tool/planner behavior.

Implications:

- Package 8 must keep `rin:v2-check` non-destructive and provider-free.
- Tagging `v2.0.0` requires a clean, verified `main`, not a package branch.
- Non-versioned stale policy docs must be marked historical or superseded when
  they mention decommissioned Agent behavior.
