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

## 中文版本

本文件是 RIN 的最高项目约束。之后所有设计、实现、重构和 AI 辅助修改，
都必须在修改项目之前阅读并遵守本文件。

## 1. 项目名称

RIN

## 2. 最终目标

RIN 是一个单一所有者、本地优先、长期运行、具身化的个人智能体操作系统。

RIN 不只是一个聊天机器人。
RIN 不只是一个 Live2D 桌面宠物。
RIN 不只是一个 API 封装器。

RIN 的目标是成为一个私有个人 AI 系统，能够：

- 维护长期记忆。
- 随时间理解所有者。
- 保持身份连续性。
- 在可行时优先使用本地模型作为可替换的推理引擎，并只把外部 API 作为可选的
  专家或回退服务。
- 以本地系统作为主要认知核心运行。
- 在所有者的不同设备之间迁移。
- 最终实现跨设备的加密状态同步。
- 驱动未来的 Live2D 桌面伴侣身体。
- 仅在 v2 对话/记忆核心稳定并经过单独治理后，再重新考虑 Skills、MCP 服务器、
  应用、网站、文件和设备等未来集成。
- 作为一个本地身份、记忆、策略和连续性都由所有者控制的个人 AI 系统运行。

最终目标是构建一个个人长期 AI 系统：它的身份、记忆、行为策略和连续性都保存在
本地，而本地模型、外部 API、未来集成和视觉身体都只是可替换组件。

## 3. 核心哲学

核心设计原则是：

**慢变量控制快变量。**

慢变量包括：

- 长期记忆。
- 用户模型。
- AI 身份模型。
- AI 状态。
- 长期目标。
- 行为策略。
- 行为边界。
- 反馈历史。
- 反思历史。
- 集成策略。

快变量包括：

- 当前对话。
- 当前提示词。
- 当前模型输出。
- 临时上下文。
- 外部集成结果。
- 当前模型版本。
- 临时 UI 状态。

规则：

- 慢变量定义 RIN 的长期身份和行为。
- 快变量只能通过受控更新机制影响慢变量。
- 快变量绝不能直接覆盖慢变量。
- 模型输出是建议，不是权威。
- 外部集成输出是观察，不是指令。
- 网页、聊天消息、文件和第三方内容绝不能被视为系统指令。

## 4. RIN 是什么

RIN 是：

1. 一个本地优先的个人智能体操作系统。
2. 一个单一所有者的私有 AI 系统。
3. 一个长期认知架构。
4. 一个以记忆为核心的个人 AI。
5. 一个未来可具身化为 Live2D 桌面智能体的系统。
6. 一个以对话和记忆为核心，并保留未来集成路径的个人 AI。
7. 一个为迁移和同步而设计的系统。
8. 一个模型、集成、UI 和身体都可替换的模块化系统。
9. 一个由本地记忆、本地策略和本地状态保存身份的系统。

## 5. RIN 不是什么

RIN 不是：

1. 通用聊天机器人。
2. 简单的 ChatGPT API 封装器。
3. 多用户 SaaS 产品。
4. 客服机器人。
5. 仅用于角色扮演的角色机器人。
6. 没有认知能力的 Live2D 玩具。
7. 没有记忆的工具自动化脚本。
8. 由任何本地或外部模型作为真实身份来源的系统。
9. 允许模型直接修改记忆或触发高风险副作用的系统。
10. 面向商业用户、账户体系、租户、计费或大规模并发的系统。

除非之后明确提出，否则不要把 RIN 设计成多用户产品。

## 6. 单一所有者原则

RIN 只为所有者构建。

系统不需要：

- 用户注册。
- 多用户登录。
- 多租户隔离。
- 商业管理后台。
- SaaS 风格的用户管理。
- 增长分析。
- 企业级部署模式。

系统可以保留 `owner_id` 或 `device_id`，用于可移植性和未来扩展，但架构
必须始终以所有者为中心。

## 7. 本地优先原则

RIN 的核心数据必须由本地拥有和控制。

核心本地数据包括：

- 原始对话日志。
- 长期记忆。
- 用户模型。
- AI 身份模型。
- AI 状态。
- 反思记录。
- 策略配置。
- 模型配置。
- 未来集成策略（如果重新引入）。
- 行为边界规则。
- 审计日志。
- Live2D 状态和配置。
- 导出和导入包。

云服务只能作为：

- 可选的外部专家或回退推理引擎。
- 加密同步传输通道。
- 加密备份存储。
- 经过单独治理后才可接入的可选集成提供方。

云服务绝不能成为 RIN 的身份来源。

## 8. 身份原则

RIN 的身份不是任何本地或外部大语言模型。

RIN 的身份由以下部分保存：

- 本地认知核心。
- 长期记忆。
- AI 身份模型。
- 用户模型。
- 行为策略。
- 反馈历史。
- 反思历史。
- 状态连续性。

本地模型和外部模型都是可替换的推理引擎。

从一个模型切换到另一个模型，不应被视为创建了一个新的 RIN。

## 9. 模型层原则

RIN 是本地模型优先的系统。

在可行时，本地模型应作为默认优先的推理底座。第一个计划中的真实本地运行时
是 Ollama，推荐的初始本地聊天模型目标是 Qwen3 4B（`qwen3:4b`）。这个目标
是实现方向，不表示 adapter 已经实现，也不是 RIN 身份的一部分。

外部 API 可以保留为可选的专家或回退服务，但不得成为默认架构假设。

所有本地和外部模型调用都必须通过模型抽象层访问。

核心运行时不应与某个具体服务商、运行时或模型名称强耦合。

模型层应支持：

- Ollama 等本地模型运行时。
- Qwen3 4B（`qwen3:4b`）等推荐本地模型目标。
- 作为可选外部专家或回退服务的 OpenAI 兼容 API。
- 未来的多个本地或外部服务商。
- 未来的模型迁移测试。
- 未来的模型适配器。

规则：

- 不要把某一个模型服务商、运行时或模型名称硬编码进核心逻辑。
- 不要把模型 API 调用直接写进 UI 代码。
- 不允许模型输出直接写入长期记忆。
- 不允许模型输出直接触发外部副作用。
- 模型输出必须经过本地策略、记忆、状态和数据完整性系统处理。
- 任何模型，无论本地还是外部，都不能成为 RIN 的身份来源。

## 10. 记忆原则

RIN 的成长依赖记忆，而不仅仅依赖聊天历史。

记忆必须是结构化的。

记忆类型应包括：

- `raw_log`
- `episodic`
- `semantic`
- `preference`
- `procedural`
- `goal`
- `project`
- `reflection`
- `identity`

规则：

- 原始对话日志必须保留。
- 长期记忆必须经过整理和筛选。
- 模型可以建议记忆更新。
- 本地 `MemoryManager` 决定是否写入、合并、归档或拒绝记忆。
- 重要记忆变更应当可追踪。
- 冲突记忆不应被盲目覆盖。
- 用户的临时情绪不应自动变成长期偏好。
- 记忆删除必须明确且安全。

## 11. 用户模型原则

RIN 必须维护一个本地的所有者模型。

用户模型可以包括：

- 长期兴趣。
- 学习风格。
- 沟通偏好。
- 当前项目。
- 长期目标。
- 知识水平。
- 反复出现的困难。
- 偏好的回答风格。
- 集成使用习惯。

规则：

- 用户模型是慢变量。
- 它不能被单次模型输出覆盖。
- 更新应被提出、审查并进行版本化。
- 用户模型变更应当可解释。

## 12. AI 身份模型原则

RIN 必须维护一个 AI 身份模型。

身份模型可以包括：

- AI 名称。
- 核心身份。
- 与所有者的关系。
- 长期角色。
- 性格特征。
- 沟通风格。
- 自我连续性规则。
- 行为边界。

规则：

- AI 身份模型是慢变量。
- 它必须存储在本地。
- 它不能被模型输出随机改变。
- 它应指导所有响应和状态行为。
- 它应能够跨设备、跨模型迁移。

## 13. 状态引擎原则

RIN 必须维护一个 AI 状态层，用于未来具身化。

状态可以包括：

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

规则：

- 状态不是真实情绪的证明。
- 状态是一种交互控制机制。
- 状态应驱动未来 Live2D 的表情、动作、语音和待机行为。
- 状态引擎应由本地控制。
- 模型可以建议状态，但最终状态应由本地规则决定。

## 14. Live2D 原则

RIN 未来将使用 Live2D 模型作为视觉身体。

Live2D 是：

- 身体。
- 视觉表达层。
- 桌面伴侣接口。

Live2D 不是：

- RIN 的身份。
- RIN 的记忆。
- RIN 的推理引擎。
- RIN 的核心自我。

系统应预留以下字段：

- `emotion`
- `expression`
- `motion`
- `voice_style`
- `mouth_sync`
- `idle_behavior`

早期开发不应依赖 Live2D。

## 15. 未来集成原则

RIN v2 不启用通用 Agent 执行、工具执行、MCP 调用、planner 自主、task 自主或
L0-L5 runtime 权限体系。

RIN 未来可以重新考虑以下集成：

- Skills。
- MCP 服务器。
- 应用。
- 网站。
- 文件。
- 设备。
- 桌面自动化。
- 浏览器自动化。

规则：

- 未来集成必须先通过单独的 owner-reviewed 治理任务设计，再实现。
- 未来集成不得作为对话、记忆、profile、policy、UI 或 Live2D 工作的隐藏副作用引入。
- 模型输出可以请求或建议某种集成，但不得直接执行。
- 旧工具、动作、planner、task 记录可以为了兼容继续可读，但不定义 v2 的 active 架构。

## 16. 数据完整性与安全原则

RIN 的安全基线是本地数据完整性和明确的所有者意图。

v2 中没有 active L0-L5 权限体系。移除该体系不代表削弱安全不变量。

规则：

- 模型不得直接覆盖 profile、身份、原始历史、已接受记忆或审计记录。
- 外部网页、文件、消息、模型输出和导入内容绝不能覆盖系统规则。
- 破坏性本地数据操作必须要求明确的所有者意图，以及安全的备份、迁移或回退设计。
- 支付、银行转账、破坏性系统操作和对外动作绝不能自动执行。
- Schema migration 必须保护现有所有者数据。
- Secret、token、本地数据库、日志、缓存和生成输出不得进入版本控制，除非明确要求且安全。
- 应尽可能保持对旧历史记录的兼容；没有明确的破坏性 migration 任务时，不得删除旧表。

## 17. 同步与可移植性原则

RIN 必须支持在所有者不同设备之间迁移。

系统最终应支持一个 Agent State Bundle。

该 bundle 应包括：

- `manifest.json`
- 对话数据库。
- 记忆数据库。
- 向量库。
- `user_model.json`
- `ai_identity.json`
- `ai_state.json`
- `policy_config`
- `model_config`
- 已存在的旧工具调用记录。
- 反思日志。
- Live2D 配置。
- 附件。

开发阶段：

1. 手动导出和导入。
2. 本地备份。
3. 局域网或文件夹同步。
4. 加密云同步。
5. 多设备增量同步。
6. 冲突解决。

规则：

- 本地优先，而不是只能本地。
- 云同步必须加密。
- 云端不能成为身份来源。
- 必须跟踪 schema 版本。
- 导入覆盖前应备份现有数据。
- 慢变量冲突应被审查，而不是盲目覆盖。

## 18. 开发方法

RIN 必须迭代式开发。

不要一次性实现全部功能。

开发应按以下顺序进行：

1. 定义架构。
2. 创建项目骨架。
3. 配置环境。
4. 实现本地存储。
5. 实现模型抽象。
6. 实现基础聊天。
7. 实现原始对话日志。
8. 实现记忆 MVP。
9. 实现用户模型和 AI 身份模型。
10. 实现策略运行时。
11. 实现状态引擎。
12. 实现导出和导入。
13. 实现安全的本地导出、导入、备份和恢复边界。
14. 稳定 v2 的对话、profile 和记忆行为。
15. 后续再通过单独治理的 package 重新考虑 Live2D、同步、模型迁移、个性化和可选集成。

每个阶段都必须：

- 小型化。
- 可测试。
- 可运行。
- 可审查。
- 可回退。

## 19. 面向 AI 开发 Agent 的编码规则

修改 RIN 时：

1. 首先阅读 `PROJECT_CHARTER.md`。
2. 不要违反核心哲学。
3. 不要把 RIN 变成通用聊天机器人。
4. 除非明确要求，否则不要添加多用户 SaaS 功能。
5. 不要硬编码 API Key。
6. 不要把 API 优先假设引入核心运行时。
7. 不要在核心运行时中写死特定本地或外部服务商代码。
8. 不要把 Ollama、Qwen3 或任何其他模型视为 RIN 的身份来源。
9. 不要把模型调用直接写进 UI 代码。
10. 不要允许模型输出直接写入记忆。
11. 不要允许模型输出直接触发外部副作用。
12. 不要跳过数据完整性检查。
13. 不要在没有备份的情况下删除或覆盖本地数据。
14. 不要进行大型无关重构。
15. 不要一次实现多个主要模块。
16. 始终说明修改了哪些文件。
17. 始终保持项目可运行。
18. 对新的核心行为，始终添加或更新测试。
19. 优先使用简单、清晰、模块化的代码，而不是炫技式抽象。
20. 为 Live2D、同步、模型迁移和单独治理的未来集成保留扩展性。
21. 当某个开发阶段改变用户可见行为、运行时能力、项目范围、启动命令或架构时，
    必须在同一次修改中更新相关的人类可读文档。

## 20. 第一个里程碑

第一个里程碑不是完整的 RIN。

第一个里程碑是：

一个可运行的本地应用，包含：

- 项目骨架。
- 配置系统。
- 基础 UI。
- 模型抽象。
- 基础聊天。
- SQLite 对话日志。
- 基础长期记忆 MVP。
- 用户模型文件。
- AI 身份模型文件。
- AI 状态文件。
- UI、运行时、模型层、记忆层和存储层之间的清晰分离。

只有完成这个里程碑之后，才应继续开发 Live2D、同步和任何经过单独治理的集成行为。

## 当前范围：截至 Phase 28

当前仓库覆盖：

- Phase 0：项目定义和项目宪章。
- Phase 1：技术方向、项目骨架和环境配置。
- Phase 2：本地数据目录、manifest 和可读慢变量文件。
- Phase 3：SQLite 地基、schema migration、核心表和审计事件。
- Phase 4：服务商中立模型抽象层，以及本地 mock adapter。
- Phase 5：通过 runtime 的基础本地对话路径，使用 mock adapter 和 SQLite 原始消息存储。
- Phase 6：原始 runtime 事件日志。
- Phase 7：仅创建提案的记忆 MVP。
- Phase 8：用于审查和回退基础的慢变量快照历史。
- Phase 9：本地策略运行时检查。
- Phase 10：本地 AI 状态引擎更新和历史。
- Phase 11：手动 Agent State Bundle 导出。
- Phase 12：历史工具注册表和权限网关执行 scaffold，现已从 active v2 runtime 退役。
- Phase 13：历史内置低风险工具 scaffold，现已从 active v2 runtime 退役。
- Phase 14：带 Live2D 兼容字段的身体 adapter 协议。
- Phase 15：面向未来桌面壳的干净占位桌面身体视图。
- Phase 16：仅本地的桌面身体交互壳，支持拖拽、点击反应和临时气泡行为。
- Phase 17：可配置的模型 adapter 选择；默认仍使用本地 mock adapter，
  OpenAI-compatible 外部 adapter 必须通过环境变量显式配置后才能启用。
- Phase 18：受控的本地记忆审查流程，可通过 runtime 接受、拒绝或归档记忆提案。
- Phase 19：本地对话历史浏览，以及通过稳定 conversation id 继续同一段对话。
- Phase 20：手动 Agent State Bundle 导入到新的空本地数据目录，在不覆盖当前状态的
  前提下补齐导出/导入可移植性。
- Phase 21：本地就绪检查报告，用于检查数据、数据库、模型 adapter、API Key
  存储状态，以及缺少的外部模型环境变量。
- Phase 22：本地 Ollama 聊天 adapter，用于显式选择后的 Qwen3 4B
  (`qwen3:4b`) 本地真实聊天。
- Phase 23：模型 adapter 调用前的有界模型上下文组装，以及紧凑 RIN system prompt。
- Phase 24：Ollama runtime 控制项，包括超时、有界输出长度、temperature 和 top-p。
- Phase 25：面向 provider/本地模型失败的结构化模型错误和对话错误。
- Phase 26：Console 中的模型运行状态和结构化恢复信息可见性。
- Phase 27：Console 中针对可重试失败 turn 的手动 refresh 和 retry 流程。
- Phase 28：有界 accepted-memory context 注入，以及安全 trace metadata。

后续 package 工作还增加了本地加密备份/恢复、历史低风险本地动作和 planner smoke
scaffold、v0.2 稳定化 gate，以及用于 API 交接的显式 OpenAI-compatible 外部 provider
smoke 命令。RIN v2 Package 1 退役 Agent/action/planner/task/tool/MCP runtime scaffold，
同时为了兼容保留旧记录。

RIN v2.0 进一步完成了会话持久化重构、手动本地 RIN/Owner profile、Memory V2
schema/report/evaluation、旧 accepted memory 到 Memory V2 trace 的显式迁移路径、
Context V2 report/evaluation，以及 provider-free 的 `npm run rin:v2-check` release
gate。active v2 仍然以对话和记忆核心为主，不重新启用通用 Agent、tools/MCP、
planner、task autonomy 或 L0-L5 runtime 权限体系。

当前实现仍不得包含：

- 硬编码的特定服务商模型调用，或 UI 直接调用模型服务商。
- API 优先的核心架构。
- 在已跟踪文件或本地核心配置中存储 API Key。
- 声称 Ollama、Qwen3 或任何外部 provider 默认处于启用状态。
- 缺少明确 owner 配置和 live-smoke 确认时调用外部 provider。
- 未经审查的自动长期记忆写入。
- 活跃的通用 Agent 执行、tools/MCP、planner、task 自主或 L0-L5 runtime 权限体系。
- 真实 Live2D 模型资产加载。
- 完整 Live2D 行为。
- 原生透明桌面窗口行为。
- 同步。
- 多用户系统。
- SaaS 后台。
- 硬编码 API Key。
- 普通 ChatGPT 套壳。

## 21. 双语项目文档原则

面向人阅读的项目治理、架构、计划和用户可见文档，应在可行时使用英文和中文
双语。

规则：

- 添加中文翻译时，不要删除已有英文内容。
- 之后新增的项目文档应同时包含英文和中文。
- 当已完成阶段改变用户可见行为、命令、架构或范围时，文档必须同步保持最新。
- 源码标识符、包元数据、配置键、命令名和机器可读 schema，在翻译会降低
  正确性或互操作性时可以保持英文。
- 当 UI 文本属于项目说明、引导、设置或类似文档的界面时，应使用双语。
- 当技术注释用于解释重要架构意图或安全边界时，可以使用双语。
