# Architecture

## Current Project Type

`RIN-loading` is currently a TypeScript project using React, Vite, Vitest, and
ESLint. It contains both a browser UI shell and local RIN MVP runtime modules.
The repository also includes Live2D-related visual/body work, but it does not
currently implement real Cubism `.moc3` model loading.

The broader RIN direction is defined by `PROJECT_CHARTER.md`: local-first,
single-owner, long-running personal agent architecture with local identity,
memory, state, policy, auditability, local-model-first reasoning, and
replaceable local or external reasoning engines.

## Root-Level Configuration

Current root-level configuration includes:

- `package.json` and `package-lock.json` for npm dependencies and scripts.
- `vite.config.ts` for the Vite application build.
- `vitest.config.ts` for Vitest configuration.
- `tsconfig.json`, `tsconfig.app.json`, and `tsconfig.node.json` for TypeScript.
- `eslint.config.js` for linting.
- `index.html` for Vite entry.
- `.gitignore` for generated, dependency, local-data, and secret exclusions.
- `Start_RIN.command` and `Start_RIN_Local_Model.command` for macOS
  double-click local Console launch.

Governance and project documentation lives at the root and in `docs/`.

## `src/` Role

`src/` contains the application source and local RIN runtime code.

Current known module boundaries include:

- `src/ui/`: React UI shell and body view components. The Console displays local
  runtime status (active adapter, provider, and local model settings) and
  structured conversation recovery errors through RIN server APIs without calling
  model providers directly. Console recovery actions (manual status refresh and
  retry of a retryable failed turn) use RIN local APIs and do not bypass the
  runtime or provider boundaries. It can inspect persisted `memoryContext` trace
  metadata per successful historical RIN turn without recomputing memory context
  or exposing full memory text. The trace panel formats read-only lexical,
  type, metadata, and skipped-reason ranking components from existing trace
  data; it does not run memory evaluation in the browser or call providers.
- `src/body/`: current body adapter protocol, SVG/live2d-compatible body state
  mapping, local body interaction logic, and v0.8 body boundary reports. The
  body layer is replaceable interface code only; it does not own identity,
  memory, policy, continuity state, provider calls, or core cognition.
- `src/runtime/`: local conversation/runtime boundary.
- `src/conversation/`: conversation persistence, history retrieval, and runtime
  turn handling. Owner messages and `conversation_turns` records are persisted
  before model adapter calls; model generation runs outside long database
  transactions; RIN replies are returned only after storage. It maps typed model
  failures into structured, user-visible conversation errors (stable error
  codes, recovery guidance, HTTP status), preserves failed owner messages,
  records `conversation.turn_failed`, and never stores fake RIN replies.
  Successful RIN turns may store safe memory context trace metadata for
  audit/reload visibility; this metadata excludes full memory text, model context
  snippets, and raw prompt text.
- `src/context/`: fast-variable context assembly between conversation runtime
  and model adapters. It builds bounded model input, adds the compact RIN system
  prompt, and does not own identity, memory storage, policy, or provider calls.
  It may now receive accepted memory snippets from the memory layer and inject a
  compact, budgeted memory context block; context assembly remains budgeted and
  memory storage/review stays separate from context assembly.
- `src/model/`: provider-neutral model abstraction, local mock adapter,
  configurable adapter selection, and adapter boundaries for local-model-first
  reasoning plus optional external expert or fallback providers. The first real
  local runtime adapter is Ollama, with Qwen3 4B (`qwen3:4b`) as the recommended
  initial chat model target when explicitly selected.   Local adapter runtime
  controls such as timeout and bounded generation options live at this adapter
  boundary, not in UI or identity logic. Adapters throw typed model errors so
  the conversation runtime can classify local model failures (timeout,
  unavailable, missing model, invalid or provider response) without inspecting
  Ollama or provider internals. v0.3-A adds an explicit OpenAI-compatible
  external provider smoke diagnostic for handoff; it is not part of default
  checks and requires a separate live-smoke confirmation before any external
  call. v1.1-A hardens the Ollama/Qwen3 local chat path by requesting final
  content with `think: false`, classifying empty final content safely, removing
  recognized thinking-tag content from non-empty responses, rejecting remaining
  internal-analysis-style output, and adding provider-free daily chat evaluation
  plus an explicit local-only daily chat smoke command that skips unless the
  local adapter is selected.
- `src/memory/`: memory proposal, review, metadata, and manager boundary. It also
  provides deterministic retrieval of explicitly accepted memories for bounded
  injection into model context, plus safe injection explanation metadata (matched
  keywords, overlap counts, memory type, type-match bonus, matched tags,
  metadata bonus components, metadata signals, and skip reasons) without logging
  full memory text by default; it uses lightweight deterministic token
  normalization (plural folding, separator splitting, stopwords, CJK bigrams),
  a small type-aware ranking boost, and bounded owner-reviewed metadata boosts
  rather than embeddings. Type and metadata alone cannot inject a memory:
  content token overlap remains required and accepted-only filtering remains the
  hard boundary. Owner-reviewed metadata (`tags`, `importance`, `confidence`,
  `source`, review timestamps) is local slow-variable data stored separately from
  core memory content. Matching tags and `high` importance may add capped ranking
  bonuses after lexical overlap; `low` confidence can dampen metadata bonus;
  source and timestamps remain trace-only. The module also contains a local
  in-memory evaluation harness for retrieval/injection quality that reports
  total/pass/fail counts, fixture categories, category pass/fail counts, failed
  case IDs, and provider-call count without calling model providers or touching
  real owner data; it does not auto-write or auto-accept memories. The module
  also contains a fixture-only semantic retrieval comparison harness that
  compares deterministic injected IDs with explicit fixture semantic candidate
  IDs, fixture/mock embedding prototype candidate IDs, and report-only hybrid
  candidates. It includes deterministic fixture embedding utilities, vector
  math, an in-memory vector index, disabled local embedding provider readiness,
  and semantic readiness reporting. It reports false positives, false negatives,
  accepted-only violations, zero-overlap semantic candidates, privacy checks,
  prototype candidate counts, and provider-call count without real embeddings,
  vector databases, provider calls, real `.rin-data`, or production integration.
  It also now exposes explicit report-only accepted-memory semantic index,
  live accepted-memory index, and hybrid candidate report commands. These
  commands are disabled by default; without explicit owner opt-in they do not
  list real memories, read real `.rin-data`, or call providers. When explicitly
  enabled, they remain in-memory, accepted-only, ID/count/status-only, and do not
  feed candidates into context assembly by default. Package 2 adds sanitized
  semantic/hybrid trace persistence through existing audit storage and a
  disabled-by-default semantic context candidate-expansion gate. When explicitly
  enabled, semantic candidates are accepted-only, appended after deterministic
  candidates, capped, budgeted, provider-free by default, and traced separately
  from deterministic memory IDs. Deterministic retrieval remains the baseline,
  and default checks do not call embedding providers. v0.4 memory governance adds
  suggestion-only health/conflict/archive/merge reports. These reports may read
  memory content internally for deterministic comparison but only print memory
  IDs, statuses, types, counts, and reason codes; they never mutate memory or
  print full memory text.
- `src/policy/`: local policy runtime checks.
- `src/state/`: local AI state update logic.
- `src/storage/`: controlled local storage layout and manifest logic.
- `src/database/`: SQLite schema, migrations, and connection helpers, including
  side-table storage for optional owner-reviewed memory metadata.
- Agent complexity decommissioned in v2: `src/tools/`, `src/actions/`,
  `src/planner/`, and `src/tasks/` are no longer active source modules. The
  L0-L5 runtime permission hierarchy, tool execution path, MCP boundary smoke,
  planner scaffold, and task autonomy scaffold were removed from the active
  architecture. Legacy database tables and historical records remain readable
  for compatibility; no destructive migration drops old records.
- `src/backup/`: local backup and restore continuity. Dry-run reports still
  build safe manifest-style reports with relative file names, sizes, and hashes,
  exclude logs/secrets/generated folders, create no archive, and mutate no data.
  v0.2-A also adds a local encrypted `.rinbackup` archive workflow using
  standard Node crypto, passphrase-based key derivation, archive verification,
  conflict-reporting restore dry-run, and confirmation-gated restore apply into
  non-conflicting target files. Restore apply rewrites `manifest.json`
  directories for the target layout so old device absolute paths are not
  preserved.
- `src/sync/`: v0.7 device continuity and sync dry-run reporting. It reports
  local manifest device identity, sync dry-run summaries, and migration checks
  without cloud sync, plaintext sync, automatic merge, automatic overwrite,
  upload, mutation, or provider calls.
- `src/body/`: v0.8 body and Live2D boundary reporting. It inventories
  replaceable body adapters and maps local state into body state output without
  storing identity, memory, policy, or continuity state in the body layer.
- `src/reliability/`: v0.9 report-only integrity, recovery smoke, and ops
  health checks. It does not automatically repair, delete, restore, hide errors,
  mutate data, or call providers.
- `src/project/`: safe local project assistant reports and rollback notes. It
  reports package scripts, governance file presence, source counts, and audit
  event count summaries without printing full file contents, audit payloads,
  secrets, raw prompts, local absolute paths, or model context snippets.
- `src/bundle/`: manual Agent State Bundle export and safe import.
- `src/cli/`: Node-side command entry points.
- `src/server/`: local console server.
- `src/config/`: environment/configuration helpers.
- `src/readiness/`: local readiness checks for API handoff and operational
  sanity checks.
- `src/tests/`: current shared test setup and charter tests.

Do not move these modules during governance-only work.

## `public/` Role

`public/` contains static assets served by Vite. Current Live2D-related runtime
image assets are under `public/live2d/rin/`.

These files are runtime assets, not authoring source files. They may be loaded
by browser code using public paths such as `/live2d/rin/...`.

## `docs/` Role

`docs/` contains project-level documentation:

- `docs/PROJECT_MAP.md`
- `docs/TECHNICAL_DIRECTION.md`
- `docs/MEMORY_RETRIEVAL_RANKING.md`
- `docs/MEMORY_RETRIEVAL_EVALUATION_PLAN.md`
- `docs/SEMANTIC_RETRIEVAL_PROTOTYPE_PLAN.md`
- `docs/LOCAL_EMBEDDING_PROVIDER_PLAN.md`
- `docs/SEMANTIC_INDEX_LIFECYCLE.md`
- `docs/HYBRID_RETRIEVAL_INTEGRATION_PLAN.md`
- `docs/LOCAL_LAUNCHER.md`
- `docs/SEMANTIC_RETRIEVAL_OPT_IN_GATES.md`
- `docs/MEMORY_MAINTENANCE_POLICY.md`
- `docs/ACTION_PERMISSION_POLICY.md`
- `docs/LOCAL_PLANNER_POLICY.md`
- `docs/CONSOLE_OPERATIONS_POLICY.md`
- `docs/BACKUP_MIGRATION_POLICY.md`
- `docs/RIN_V0_1_READINESS_CHECKLIST.md`
- `docs/RIN_V0_1_PRIVACY_AUDIT.md`
- `docs/RIN_V0_1_OPERATIONS_GUIDE.md`
- `docs/RIN_V0_1_RELEASE_NOTES.md`
- `docs/RIN_V0_3_SCOPE_GOVERNANCE_AUDIT.md`
- `docs/RIN_V0_3_RELEASE_NOTES.md`
- `docs/RIN_V0_4_MEMORY_GOVERNANCE_POLICY.md`
- `docs/RIN_V0_4_RELEASE_NOTES.md`
- `docs/RIN_V0_5_TOOL_MCP_POLICY.md`
- `docs/RIN_V0_5_RELEASE_NOTES.md`
- `docs/RIN_V0_6_TASK_AUTONOMY_POLICY.md`
- `docs/RIN_V0_6_RELEASE_NOTES.md`
- `docs/RIN_V0_7_DEVICE_SYNC_POLICY.md`
- `docs/RIN_V0_7_RELEASE_NOTES.md`
- `docs/RIN_V0_8_BODY_LIVE2D_POLICY.md`
- `docs/RIN_V0_8_RELEASE_NOTES.md`
- `docs/RIN_V0_9_RELIABILITY_POLICY.md`
- `docs/RIN_V0_9_RELEASE_NOTES.md`
- `docs/RIN_V1_READINESS_CHECKLIST.md`
- `docs/RIN_V1_RELEASE_NOTES.md`
- `docs/RIN_V1_OPERATIONS_GUIDE.md`
- `docs/RIN_V1_MIGRATION_GUIDE.md`
- `docs/RIN_V1_SECURITY_PRIVACY_AUDIT.md`
- `docs/decisions/ADR-0001-local-model-first-reasoning.md`
- `docs/decisions/ADR-0002-local-semantic-memory-retrieval.md`

Additional folders are reserved for future documentation:

- `docs/design/`
- `docs/development/`
- `docs/live2d/`
- `docs/decisions/`

Documentation should describe the current system accurately and mark future
ideas as recommendations or open questions.

## `live2d-development/` Role

`live2d-development/` is the Live2D model development workspace. It is separate
from production TypeScript code and public runtime assets.

Current subdirectories separate references, source art, layered assets, Cubism
project files, exports, integration notes, tests, and Live2D development docs.

Keep authoring files, source art, Cubism project files, and exploratory
integration notes in this workspace. Move only production-ready runtime assets
to `public/live2d/` through an explicit integration task.

## Live2D Asset and Code Separation

Expected separation:

- Runtime assets: `public/live2d/`
- Runtime/control code: `src/live2d/` when introduced
- Current body adapter code: `src/body/`
- UI presentation: `src/ui/`
- Development source files: `live2d-development/`

Current code uses a body adapter boundary and layered image assets. Real Cubism
runtime loading is deferred.

## Future Recommended Boundaries

Recommended future structure, only when the project needs it:

- `src/live2d/` for Cubism runtime loading, model lifecycle, motion/expression
  mapping, and Live2D-specific adapters.
- `src/components/` for reusable UI primitives shared across views.
- `src/features/` for feature-level UI/runtime integrations.
- `src/styles/` for shared style modules or global style organization.
- root `tests/` for integration tests that span multiple source modules.
- `scripts/` for repository maintenance commands that should not live in app
  source.

Do not migrate current files into these folders without a scoped refactor and
passing checks.

## Risks and Open Questions

- The repository currently has no committed history, so the first commit defines
  the baseline.
- `.rin-data/` contains local owner state and SQLite data; it must remain local
  and ignored.
- Current body code uses Live2D-compatible state fields but not a real Cubism
  model runtime.
- Model providers, whether local runtimes or external APIs, must enter only
  through configured model adapters. The UI must not call Ollama, external APIs,
  or any other provider directly.
- External API keys must remain in environment variables or ignored local files.
- Semantic retrieval remains disabled by default. A fixture-only comparison,
  readiness program, report-only accepted-memory index, sanitized trace
  persistence path, and opt-in semantic context candidate-expansion gate exist,
  but there is still no default production embedding path, vector database,
  persistent semantic index, or provider-required semantic context path.
- Memory writes are still controlled slow-variable updates: owner messages can
  create proposals, and local review routes decide accepted, rejected, or
  archived status.
- Memory maintenance remains suggestion-only: reports do not delete, archive, or
  rewrite memories automatically.
- General-purpose Agent scaffolds are decommissioned in v2. There is no active
  L0-L5 permission hierarchy, tool/MCP execution path, planner scaffold, or task
  autonomy runtime. Data-integrity protections remain in storage, migration,
  profile, memory, audit, backup, restore, and model-response policy paths.
- Console operational status remains a read-only local snapshot. Backup/restore
  dry-run commands remain non-mutating defaults. Encrypted backup archive
  creation is explicit and local-only; restore apply requires a confirmation
  token, refuses target file conflicts, performs no cloud sync, and does not
  automatically overwrite existing data.
- Conversation history is local SQLite state. The UI may select and continue a
  conversation, but it still writes through the runtime instead of mutating
  storage directly. Runtime model calls use bounded fast-variable context rather
  than sending unlimited stored history to model adapters.
- Bundle import is deliberately conservative: it restores into a new empty data
  directory and refuses to overwrite existing local state.
- There may be parallel Codex conversations working on Live2D assets; avoid file
  moves in `live2d-development/` unless explicitly coordinated.
- The final long-term split between `src/body/` and future `src/live2d/` is not
  yet decided.
