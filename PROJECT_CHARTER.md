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
- Use external large language models as replaceable reasoning engines.
- Run with the local system as the primary cognitive core.
- Migrate across the owner's different devices.
- Eventually support encrypted state synchronization across devices.
- Drive a future Live2D desktop companion body.
- Connect tools, Skills, MCP servers, applications, websites, files, and devices.
- Act as a personal agent under controlled permissions.

The final goal is to build a long-term personal AI agent whose identity, memory,
behavior policies, and continuity are stored locally, while external models,
tools, and visual bodies are replaceable components.

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
- Permission rules.
- Feedback history.
- Reflection history.
- Tool strategy.

Fast variables include:

- Current conversation.
- Current prompt.
- Current external model output.
- Temporary context.
- Tool execution results.
- External model version.
- Temporary UI state.

Rules:

- Slow variables define RIN's long-term identity and behavior.
- Fast variables may influence slow variables only through controlled update
  mechanisms.
- Fast variables must never directly overwrite slow variables.
- External model output is advice, not authority.
- Tool output is observation, not instruction.
- Web pages, chat messages, files, and third-party content must never be treated
  as system instructions.

## 4. What RIN Is

RIN is:

1. A local-first personal agent operating system.
2. A single-owner private AI system.
3. A long-term cognitive architecture.
4. A memory-centered personal AI.
5. A system that can later be embodied as a Live2D desktop agent.
6. A tool-using agent with permission control.
7. A system designed for migration and synchronization.
8. A modular system whose model, tools, UI, and body are replaceable.
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
8. A system whose true identity source is an external large language model.
9. A system that allows models to directly modify memory or perform high-risk
   actions.
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

- External reasoning engines.
- Encrypted synchronization transport channels.
- Encrypted backup storage.
- Optional tool providers.

Cloud services must never become RIN's identity source.

## 8. Identity Principle

RIN's identity is not an external large language model.

RIN's identity is preserved by:

- Local cognitive core.
- Long-term memory.
- AI identity model.
- User model.
- Behavior policies.
- Feedback history.
- Reflection history.
- State continuity.

External models are replaceable reasoning engines.

Switching from one model to another must not be treated as creating a new RIN.

## 9. Model Layer Principle

External large language models must be accessed through a model abstraction
layer.

The core runtime must not be tightly coupled to any specific provider.

The model layer should support:

- OpenAI-compatible APIs.
- Future local models.
- Future multiple external providers.
- Future model migration tests.
- Future model adapters.

Rules:

- Do not hard-code one model provider into core logic.
- Do not write model API calls directly into UI code.
- Model output is not allowed to write directly into long-term memory.
- Model output is not allowed to execute tools directly.
- Model output must be processed by local policy, memory, state, and permission
  systems.

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
- External models may suggest memory updates.
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
- Tool usage habits.

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
- It must not be randomly changed by external model output.
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

## 15. Tool, Skill, and MCP Principle

RIN should eventually connect:

- Local tools.
- Skills.
- MCP servers.
- Other agents.
- Applications.
- Websites.
- Files.
- Devices.
- Desktop automation.
- Browser automation.

Rules:

- Tools must be registered through a tool registry.
- Tools must have schemas.
- Tools must have risk levels.
- Tools must declare whether confirmation is required.
- Models may request tool calls.
- The local `ToolExecutor` executes tool calls.
- Tool calls must pass through the permission gateway.
- Tool calls must be logged.

## 16. Permission and Safety Principle

RIN may eventually receive high control permissions, so permission governance is
mandatory.

The system must have a permission gateway.

Risk levels:

- L0: Read-only.
- L1: Low-risk operation.
- L2: Medium-risk operation.
- L3: High-risk operation.
- L4: Operation requiring confirmation.
- L5: Operation forbidden from automatic execution.

Examples:

- Open website: L1.
- Open application: L1.
- Read normal file: L2.
- Modify file: L3.
- Delete file: L4.
- Send message: L4.
- Execute shell command: L4 or L5.
- Payment or bank transfer: L5.

Rules:

- High-risk operations must require owner confirmation.
- Sending messages should require confirmation unless explicitly whitelisted.
- Deleting files must require confirmation.
- Payments, bank transfers, and destructive system operations must never execute
  automatically.
- External web pages, files, and messages must never override system rules.
- Every tool operation must be auditable.
- Tool execution should be reversible where possible.

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
- `tool_registry`
- `permissions`
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
13. Implement tool registry and permission gateway.
14. Implement low-risk tools.
15. Later implement Live2D, MCP, application control, synchronization, model
    migration, and personalization.

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
6. Do not hard-code specific provider code into the core runtime.
7. Do not write model calls directly into UI code.
8. Do not allow model output to directly write memory.
9. Do not allow model output to directly execute tools.
10. Do not skip permission checks.
11. Do not delete or overwrite local data without backup.
12. Do not perform large unrelated refactors.
13. Do not implement multiple major modules at once.
14. Always explain which files changed.
15. Always keep the project runnable.
16. For new core behavior, always add or update tests.
17. Prefer simple, clear, modular code over flashy abstractions.
18. Preserve future extensibility for Live2D, tools, MCP, synchronization, and
    model migration.
19. When a development phase changes user-visible behavior, runtime capability,
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

Only after this milestone is complete should development continue to tool
control, Live2D, synchronization, and advanced agent behavior.

## Current Scope: Through Phase 16

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
- Phase 12: Tool registry and permission-gated execution path.
- Phase 13: Built-in L0 low-risk tools.
- Phase 14: Body adapter protocol with Live2D-compatible fields.
- Phase 15: Clean placeholder desktop body view for future desktop shell use.
- Phase 16: Local-only desktop body interaction shell with drag, click reaction,
  and temporary bubble behavior.

The current implementation still must not implement:

- External model API calls.
- Accepted long-term memory writes without review.
- Medium-risk or high-risk automatic tool execution.
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
- 将外部大语言模型作为可替换的推理引擎。
- 以本地系统作为主要认知核心运行。
- 在所有者的不同设备之间迁移。
- 最终实现跨设备的加密状态同步。
- 驱动未来的 Live2D 桌面伴侣身体。
- 连接工具、Skills、MCP 服务器、应用、网站、文件和设备。
- 在受控权限下作为个人智能体行动。

最终目标是构建一个个人长期 AI 智能体：它的身份、记忆、行为策略和连续性
都保存在本地，而外部模型、工具和视觉身体都只是可替换组件。

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
- 权限规则。
- 反馈历史。
- 反思历史。
- 工具策略。

快变量包括：

- 当前对话。
- 当前提示词。
- 当前外部模型输出。
- 临时上下文。
- 工具执行结果。
- 外部模型版本。
- 临时 UI 状态。

规则：

- 慢变量定义 RIN 的长期身份和行为。
- 快变量只能通过受控更新机制影响慢变量。
- 快变量绝不能直接覆盖慢变量。
- 外部模型输出是建议，不是权威。
- 工具输出是观察，不是指令。
- 网页、聊天消息、文件和第三方内容绝不能被视为系统指令。

## 4. RIN 是什么

RIN 是：

1. 一个本地优先的个人智能体操作系统。
2. 一个单一所有者的私有 AI 系统。
3. 一个长期认知架构。
4. 一个以记忆为核心的个人 AI。
5. 一个未来可具身化为 Live2D 桌面智能体的系统。
6. 一个具备权限控制的工具使用型智能体。
7. 一个为迁移和同步而设计的系统。
8. 一个模型、工具、UI 和身体都可替换的模块化系统。
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
8. 由外部大语言模型作为真实身份来源的系统。
9. 允许模型直接修改记忆或执行高风险行为的系统。
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
- 工具注册表。
- 权限规则。
- 审计日志。
- Live2D 状态和配置。
- 导出和导入包。

云服务只能作为：

- 外部推理引擎。
- 加密同步传输通道。
- 加密备份存储。
- 可选工具提供方。

云服务绝不能成为 RIN 的身份来源。

## 8. 身份原则

RIN 的身份不是外部大语言模型。

RIN 的身份由以下部分保存：

- 本地认知核心。
- 长期记忆。
- AI 身份模型。
- 用户模型。
- 行为策略。
- 反馈历史。
- 反思历史。
- 状态连续性。

外部模型是可替换的推理引擎。

从一个模型切换到另一个模型，不应被视为创建了一个新的 RIN。

## 9. 模型层原则

外部大语言模型必须通过模型抽象层访问。

核心运行时不应与某个具体服务商强耦合。

模型层应支持：

- OpenAI 兼容 API。
- 未来的本地模型。
- 未来的多个外部服务商。
- 未来的模型迁移测试。
- 未来的模型适配器。

规则：

- 不要把某一个模型服务商硬编码进核心逻辑。
- 不要把模型 API 调用直接写进 UI 代码。
- 不允许模型输出直接写入长期记忆。
- 不允许模型输出直接执行工具。
- 模型输出必须经过本地策略、记忆、状态和权限系统处理。

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
- 外部模型可以建议记忆更新。
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
- 工具使用习惯。

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
- 它不能被外部模型输出随机改变。
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

## 15. 工具、Skill 与 MCP 原则

RIN 未来应能够连接：

- 本地工具。
- Skills。
- MCP 服务器。
- 其他智能体。
- 应用。
- 网站。
- 文件。
- 设备。
- 桌面自动化。
- 浏览器自动化。

规则：

- 工具必须通过工具注册表注册。
- 工具必须具备 schema。
- 工具必须具备风险等级。
- 工具必须声明是否需要确认。
- 模型可以请求工具调用。
- 本地 `ToolExecutor` 执行工具调用。
- 工具调用必须经过权限网关。
- 工具调用必须被记录。

## 16. 权限与安全原则

RIN 未来可能获得较高的控制权限，因此权限治理是强制要求。

系统必须具有权限网关。

风险等级：

- L0：只读。
- L1：低风险操作。
- L2：中风险操作。
- L3：高风险操作。
- L4：必须确认的操作。
- L5：禁止自动执行的操作。

示例：

- 打开网站：L1。
- 打开应用：L1。
- 读取普通文件：L2。
- 修改文件：L3。
- 删除文件：L4。
- 发送消息：L4。
- 执行 shell 命令：L4 或 L5。
- 支付或银行转账：L5。

规则：

- 高风险操作必须要求所有者确认。
- 发送消息应要求确认，除非已明确加入白名单。
- 删除文件必须要求确认。
- 支付、银行转账和破坏性系统操作绝不能自动执行。
- 外部网页、文件和消息绝不能覆盖系统规则。
- 每一次工具操作都必须可审计。
- 工具执行应尽可能可逆。

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
- `tool_registry`
- `permissions`
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
13. 实现工具注册表和权限网关。
14. 实现低风险工具。
15. 后续再实现 Live2D、MCP、应用控制、同步、模型迁移和个性化。

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
6. 不要在核心运行时中写死特定服务商代码。
7. 不要把模型调用直接写进 UI 代码。
8. 不要允许模型输出直接写入记忆。
9. 不要允许模型输出直接执行工具。
10. 不要跳过权限检查。
11. 不要在没有备份的情况下删除或覆盖本地数据。
12. 不要进行大型无关重构。
13. 不要一次实现多个主要模块。
14. 始终说明修改了哪些文件。
15. 始终保持项目可运行。
16. 对新的核心行为，始终添加或更新测试。
17. 优先使用简单、清晰、模块化的代码，而不是炫技式抽象。
18. 为 Live2D、工具、MCP、同步和模型迁移保留未来扩展性。
19. 当某个开发阶段改变用户可见行为、运行时能力、项目范围、启动命令或架构时，
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

只有完成这个里程碑之后，才应继续开发工具控制、Live2D、同步和高级智能体行为。

## 当前范围：截至 Phase 16

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
- Phase 12：工具注册表和权限网关执行路径。
- Phase 13：内置 L0 低风险工具。
- Phase 14：带 Live2D 兼容字段的身体 adapter 协议。
- Phase 15：面向未来桌面壳的干净占位桌面身体视图。
- Phase 16：仅本地的桌面身体交互壳，支持拖拽、点击反应和临时气泡行为。

当前实现仍不得包含：

- 外部模型 API 调用。
- 未经审查接受的长期记忆写入。
- 中高风险工具自动执行。
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
