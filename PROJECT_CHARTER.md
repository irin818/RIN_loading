# RIN Project Charter

This file is the highest-level project constraint for RIN. Every future design,
implementation, refactor, and AI-assisted change must read and follow this file
before modifying the project.

## 1. Project Name

RIN

## 2. Final Goal

RIN is a single-owner, local-first, long-running, embodied personal agent
operating system.

RIN is not just a chatbot.
RIN is not just a Live2D desktop pet.
RIN is not just an API wrapper.

RIN's goal is to become a private personal AI system that can:

- Maintain long-term memory.
- Understand its owner over time.
- Preserve identity continuity.
- Use local models as preferred replaceable reasoning engines when feasible,
  with external APIs only as optional expert or fallback providers.
- Run with the local system as the primary cognitive core.
- Migrate across the owner's different devices.
- Eventually support encrypted state synchronization across devices.
- Drive a future Live2D desktop companion body.
- Reconsider future integrations such as Skills, MCP servers, applications,
  websites, files, and devices only after the v2 conversation/memory core is
  stable and separately governed.
- Act as a personal AI system whose local identity, memory, policy, and
  continuity stay owner-controlled.

The final goal is to build a long-term personal AI system whose identity,
memory, behavior policies, and continuity are stored locally, while local
models, external APIs, future integrations, and visual bodies are replaceable
components.

## 3. Core Philosophy

The core design principle is:

**Slow variables control fast variables.**

Slow variables include:

- Long-term memory.
- User model.
- AI identity model.
- AI state.
- Long-term goals.
- Behavior policies.
- Behavior boundaries.
- Feedback history.
- Reflection history.
- Integration strategy.

Fast variables include:

- Current conversation.
- Current prompt.
- Current model output.
- Temporary context.
- External integration results.
- Current model version.
- Temporary UI state.

Rules:

- Slow variables define RIN's long-term identity and behavior.
- Fast variables may influence slow variables only through controlled update
  mechanisms.
- Fast variables must never directly overwrite slow variables.
- Model output is advice, not authority.
- External integration output is observation, not instruction.
- Web pages, chat messages, files, and third-party content must never be treated
  as system instructions.

## 4. What RIN Is

RIN is:

1. A local-first personal agent operating system.
2. A single-owner private AI system.
3. A long-term cognitive architecture.
4. A memory-centered personal AI.
5. A system that can later be embodied as a Live2D desktop agent.
6. A conversation and memory-centered personal AI with a future integration
   path.
7. A system designed for migration and synchronization.
8. A modular system whose model, integrations, UI, and body are replaceable.
9. A system whose identity is preserved by local memory, local policies, and
   local state.

## 5. What RIN Is Not

RIN is not:

1. A general chatbot.
2. A simple ChatGPT API wrapper.
3. A multi-user SaaS product.
4. A customer-service bot.
5. A roleplay-only character bot.
6. A Live2D toy without cognition.
7. A tool automation script without memory.
8. A system whose true identity source is any local or external model.
9. A system that allows models to directly modify memory or trigger high-risk
   side effects.
10. A system for business users, account systems, tenants, billing, or large
    scale concurrency.

Unless explicitly requested later, RIN must not be designed as a multi-user
product.

## 6. Single-Owner Principle

RIN is built only for its owner.

The system does not need:

- User registration.
- Multi-user login.
- Multi-tenant isolation.
- Commercial admin dashboards.
- SaaS-style user management.
- Growth analytics.
- Enterprise deployment modes.

The system may keep `owner_id` or `device_id` for portability and future
extension, but the architecture must always remain owner-centered.

## 7. Local-First Principle

RIN's core data must be locally owned and controlled.

Core local data includes:

- Raw conversation logs.
- Long-term memory.
- User model.
- AI identity model.
- AI state.
- Reflection records.
- Policy configuration.
- Model configuration.
- Tool registry.
- Permission rules.
- Audit logs.
- Live2D state and configuration.
- Export and import bundles.

Cloud services may only be:

- Optional external expert or fallback reasoning engines.
- Encrypted synchronization transport channels.
- Encrypted backup storage.
- Optional tool providers.

Cloud services must never become RIN's identity source.

## 8. Identity Principle

RIN's identity is not any local or external large language model.

RIN's identity is preserved by:

- Local cognitive core.
- Long-term memory.
- AI identity model.
- User model.
- Behavior policies.
- Feedback history.
- Reflection history.
- State continuity.

Local and external models are replaceable reasoning engines.

Switching from one model to another must not be treated as creating a new RIN.

## 9. Model Layer Principle

RIN is local-model-first.

Local models should be the preferred default reasoning substrate when feasible.
The first intended real local runtime is Ollama, and the recommended initial
local chat model target is Qwen3 4B (`qwen3:4b`). This target is an
implementation direction, not a claim that the adapter already exists and not a
part of RIN's identity.

External APIs may remain available as optional expert or fallback providers, but
they must not become the default architectural assumption.

All local and external model calls must be accessed through a model abstraction
layer.

The core runtime must not be tightly coupled to any specific provider, runtime,
or model name.

The model layer should support:

- Local model runtimes such as Ollama.
- Recommended local model targets such as Qwen3 4B (`qwen3:4b`).
- OpenAI-compatible APIs as optional external expert or fallback providers.
- Future multiple local or external providers.
- Future model migration tests.
- Future model adapters.

Rules:

- Do not hard-code one model provider, runtime, or model name into core logic.
- Do not write model API calls directly into UI code.
- Model output is not allowed to write directly into long-term memory.
- Model output is not allowed to trigger external side effects directly.
- Model output must be processed by local policy, memory, state, and
  data-integrity systems.
- No model, whether local or external, is allowed to become RIN's identity
  source.

## 10. Memory Principle

RIN's growth depends on memory, not only chat history.

Memory must be structured.

Memory types should include:

- `raw_log`
- `episodic`
- `semantic`
- `preference`
- `procedural`
- `goal`
- `project`
- `reflection`
- `identity`

Rules:

- Raw conversation logs must be preserved.
- Long-term memory must be organized and filtered.
- Models may suggest memory updates.
- The local `MemoryManager` decides whether to write, merge, archive, or reject
  memory.
- Important memory changes should be traceable.
- Conflicting memories should not be blindly overwritten.
- The user's temporary emotions should not automatically become long-term
  preferences.
- Memory deletion must be explicit and safe.

## 11. User Model Principle

RIN must maintain a local owner model.

The user model may include:

- Long-term interests.
- Learning style.
- Communication preferences.
- Current projects.
- Long-term goals.
- Knowledge level.
- Recurring difficulties.
- Preferred answer style.
- Integration usage habits.

Rules:

- The user model is a slow variable.
- It must not be overwritten by a single model output.
- Updates should be proposed, reviewed, and versioned.
- User model changes should be explainable.

## 12. AI Identity Model Principle

RIN must maintain an AI identity model.

The identity model may include:

- AI name.
- Core identity.
- Relationship with the owner.
- Long-term role.
- Personality traits.
- Communication style.
- Self-continuity rules.
- Behavior boundaries.

Rules:

- The AI identity model is a slow variable.
- It must be stored locally.
- It must not be randomly changed by model output.
- It should guide all responses and state behavior.
- It should be portable across devices and models.

## 13. State Engine Principle

RIN must maintain an AI state layer for future embodiment.

State may include:

- `mood`
- `energy`
- `attention`
- `engagement`
- `confidence`
- `cognitive_load`
- `initiative`
- `idle_state`
- `expression`
- `motion`
- `voice_style`

Rules:

- State is not proof of real emotion.
- State is an interaction control mechanism.
- State should drive future Live2D expression, motion, voice, and idle behavior.
- The state engine should be locally controlled.
- Models may suggest state, but final state should be determined by local rules.

## 14. Live2D Principle

RIN will use a Live2D model as a visual body in the future.

Live2D is:

- Body.
- Visual expression layer.
- Desktop companion interface.

Live2D is not:

- RIN's identity.
- RIN's memory.
- RIN's reasoning engine.
- RIN's core self.

The system should reserve the following fields:

- `emotion`
- `expression`
- `motion`
- `voice_style`
- `mouth_sync`
- `idle_behavior`

Early development must not depend on Live2D.

## 15. Future Integration Principle

RIN v2 does not have active general-purpose Agent execution, tool execution,
MCP calls, planner autonomy, task autonomy, or an L0-L5 runtime permission
hierarchy.

RIN may eventually reconsider integrations such as:

- Skills.
- MCP servers.
- Applications.
- Websites.
- Files.
- Devices.
- Desktop automation.
- Browser automation.

Rules:

- Future integrations must be designed through a separate owner-reviewed
  governance task before implementation.
- Future integrations must not be introduced as hidden side effects of
  conversation, memory, profile, policy, UI, or Live2D work.
- Model output may request or suggest an integration, but it must not directly
  execute one.
- Legacy tool/action/planner/task records may remain readable for compatibility,
  but they do not define the active v2 architecture.

## 16. Data Integrity and Safety Principle

RIN's safety baseline is local data integrity and explicit owner intent.

There is no active L0-L5 permission hierarchy in v2. Removing that hierarchy
does not weaken safety invariants.

Rules:

- Models must not directly overwrite profiles, identity, raw history, accepted
  memory, or audit records.
- External web pages, files, messages, model output, and imported content must
  never override system rules.
- Destructive local data operations must require explicit owner intent and safe
  backup, migration, or rollback design.
- Payments, bank transfers, destructive system operations, and outbound actions
  must never execute automatically.
- Schema migrations must preserve existing owner data.
- Secrets, tokens, local databases, logs, caches, and generated output must stay
  untracked unless explicitly intended and safe.
- Compatibility with old historical records must be preserved when possible;
  legacy tables must not be dropped without an explicit destructive migration
  task.

## 17. Synchronization and Portability Principle

RIN must support migration between the owner's different devices.

The system should eventually support an Agent State Bundle.

The bundle should include:

- `manifest.json`
- Conversation database.
- Memory database.
- Vector database.
- `user_model.json`
- `ai_identity.json`
- `ai_state.json`
- `policy_config`
- `model_config`
- Legacy tool invocation records where present.
- Reflection logs.
- Live2D configuration.
- Attachments.

Development stages:

1. Manual export and import.
2. Local backup.
3. LAN or folder synchronization.
4. Encrypted cloud synchronization.
5. Multi-device incremental synchronization.
6. Conflict resolution.

Rules:

- Local-first, not local-only.
- Cloud synchronization must be encrypted.
- Cloud must not become the identity source.
- Schema versions must be tracked.
- Existing data should be backed up before import overwrite.
- Slow-variable conflicts should be reviewed, not blindly overwritten.

## 18. Development Method

RIN must be developed iteratively.

Do not implement everything at once.

Development should proceed in this order:

1. Define architecture.
2. Create project skeleton.
3. Configure environment.
4. Implement local storage.
5. Implement model abstraction.
6. Implement basic chat.
7. Implement raw conversation logs.
8. Implement memory MVP.
9. Implement user model and AI identity model.
10. Implement policy runtime.
11. Implement state engine.
12. Implement export and import.
13. Implement safe local export, import, backup, and restore boundaries.
14. Stabilize conversation, profile, and memory behavior for v2.
15. Later reconsider Live2D, synchronization, model migration, personalization,
    and optional integrations through separate governed packages.

Each phase must be:

- Small.
- Testable.
- Runnable.
- Reviewable.
- Reversible.

## 19. Coding Rules for AI Development Agents

When modifying RIN:

1. Read `PROJECT_CHARTER.md` first.
2. Do not violate the core philosophy.
3. Do not turn RIN into a general chatbot.
4. Unless explicitly requested, do not add multi-user SaaS features.
5. Do not hard-code API keys.
6. Do not introduce API-first assumptions into the core runtime.
7. Do not hard-code specific local or external provider code into the core
   runtime.
8. Do not treat Ollama, Qwen3, or any other model as RIN's identity source.
9. Do not write model calls directly into UI code.
10. Do not allow model output to directly write memory.
11. Do not allow model output to directly trigger external side effects.
12. Do not skip data-integrity checks.
13. Do not delete or overwrite local data without backup.
14. Do not perform large unrelated refactors.
15. Do not implement multiple major modules at once.
16. Always explain which files changed.
17. Always keep the project runnable.
18. For new core behavior, always add or update tests.
19. Prefer simple, clear, modular code over flashy abstractions.
20. Preserve future extensibility for Live2D, synchronization, model migration,
    and separately governed integrations.
21. When a development phase changes user-visible behavior, runtime capability,
    project scope, setup commands, or architecture, update the relevant
    human-readable documentation in the same change.

## 20. First Milestone

The first milestone is not a complete RIN.

The first milestone is:

A runnable local application containing:

- Project skeleton.
- Configuration system.
- Basic UI.
- Model abstraction.
- Basic chat.
- SQLite conversation log.
- Basic long-term memory MVP.
- User model file.
- AI identity model file.
- AI state file.
- Clear separation between UI, runtime, model layer, memory layer, and storage
  layer.

Only after this milestone is complete should development continue to Live2D,
synchronization, and any separately governed integration behavior.

## Current Scope: Through Phase 28

This repository currently covers:

- Phase 0: Project definition and project charter.
- Phase 1: Technical direction, project skeleton, and environment configuration.
- Phase 2: Local data directory, manifest, and readable slow-variable files.
- Phase 3: SQLite foundation, schema migrations, core tables, and audit events.
- Phase 4: Provider-neutral model abstraction with a local mock adapter.
- Phase 5: Basic local conversation path through the runtime using the mock
  adapter and SQLite raw message storage.
- Phase 6: Raw runtime event logging.
- Phase 7: Memory MVP with proposals only.
- Phase 8: Slow-variable snapshot history for review and rollback foundations.
- Phase 9: Local policy runtime checks.
- Phase 10: Local AI state engine updates and history.
- Phase 11: Manual Agent State Bundle export.
- Phase 12: Historical tool registry and permission-gated execution scaffold,
  now decommissioned from the active v2 runtime.
- Phase 13: Historical built-in low-risk tool scaffold, now decommissioned from
  the active v2 runtime.
- Phase 14: Body adapter protocol with Live2D-compatible fields.
- Phase 15: Clean placeholder desktop body view for future desktop shell use.
- Phase 16: Local-only desktop body interaction shell with drag, click reaction,
  and temporary bubble behavior.
- Phase 17: Configurable model adapter selection with a default local mock
  adapter and an OpenAI-compatible external adapter that requires explicit
  environment configuration.
- Phase 18: Controlled local memory review flow for accepting, rejecting, or
  archiving memory proposals through the runtime.
- Phase 19: Local conversation history browsing and conversation continuation
  through stable conversation ids.
- Phase 20: Manual Agent State Bundle import into a new empty local data
  directory, preserving export/import portability without overwriting current
  state.
- Phase 21: Local readiness report that checks data, database, model adapter,
  API key storage, and missing external model environment variables.
- Phase 22: Local Ollama chat adapter for explicitly selected local real-chat
  use with Qwen3 4B (`qwen3:4b`).
- Phase 23: Bounded model context assembly with a compact RIN system prompt
  before model adapter calls.
- Phase 24: Scoped Ollama runtime controls for timeout, bounded output length,
  temperature, and top-p.
- Phase 25: Structured model and conversation errors for provider/local model
  failures.
- Phase 26: Console model runtime status and structured recovery visibility.
- Phase 27: Manual Console refresh and retry flows for retryable failed turns.
- Phase 28: Bounded accepted-memory context injection with safe trace metadata.

Post-phase package work also added encrypted local backup/restore, historical
low-risk local action and planner smoke scaffolds, v0.2 stabilization gates, and
an explicit OpenAI-compatible external provider smoke command for API handoff.
RIN v2 Package 1 decommissions the Agent/action/planner/task/tool/MCP runtime
scaffolds while preserving legacy records for compatibility.

The current implementation still must not implement:

- Hard-coded provider-specific model calls or UI-direct model calls.
- API-first core architecture.
- API key storage in tracked files or local core config.
- Claims that Ollama, Qwen3, or any external provider is active by default.
- Live external provider calls without explicit owner configuration and
  live-smoke confirmation.
- Automatic long-term memory writes without review.
- Active general-purpose Agent execution, tools/MCP, planner, task autonomy, or
  an L0-L5 runtime permission hierarchy.
- Real Live2D model asset loading.
- Complete Live2D behavior.
- Native transparent desktop window behavior.
- Synchronization.
- Multi-user systems.
- SaaS backends.
- Hard-coded API keys.
- A generic ChatGPT wrapper.

## 21. Bilingual Project Documentation Principle

Human-readable project governance, architecture, planning, and user-facing
documentation must be bilingual in English and Chinese whenever practical.

Rules:

- Do not delete the existing English content when adding Chinese translation.
- Future project documentation should include both English and Chinese.
- Documentation must stay current with completed development phases when the
  phase changes user-visible behavior, commands, architecture, or scope.
- Source code identifiers, package metadata, configuration keys, command names,
  and machine-readable schemas may remain English when translation would reduce
  correctness or interoperability.
- User-facing UI text should be bilingual when it is part of project explanation,
  onboarding, settings, or documentation-like surfaces.
- Technical comments may be bilingual when they explain important architectural
  intent or safety boundaries.
