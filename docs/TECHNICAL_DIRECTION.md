# RIN Technical Direction

# RIN 技术方向

This document captures the Phase 1 technical direction. It is subordinate to
`PROJECT_CHARTER.md` and `AGENTS.md`.

本文档记录 Phase 1 的技术方向。本文档从属于 `PROJECT_CHARTER.md` 和
`AGENTS.md`。

It also records the first Phase 2 storage boundary: local data directory
initialization and schema manifest tracking.

本文档也记录 Phase 2 的第一个存储边界：本地数据目录初始化和 schema
manifest 跟踪。

## Stack

## 技术栈

- Language: TypeScript.
- 语言：TypeScript。
- UI shell: React with Vite.
- UI 外壳：React 与 Vite。
- Test runner: Vitest with jsdom.
- 测试运行器：Vitest 与 jsdom。
- Linting: ESLint flat config.
- 代码检查：ESLint flat config。
- Runtime direction: local-first modular runtime with clear boundaries between
UI, core runtime, model layer, memory layer, storage layer, policy, state, and
future tools.
- 运行时方向：本地优先的模块化运行时，并在 UI、核心运行时、模型层、
记忆层、存储层、策略、状态和未来工具之间保持清晰边界。

React and Vite are the early UI shell, not the entire RIN runtime. TypeScript is
the Phase 1 stack choice, but the architecture must not prevent future local
services, native desktop runtimes, or tool executors from being added.

React 和 Vite 只是早期 UI 外壳，不是完整的 RIN 运行时。TypeScript 是
Phase 1 的技术栈选择，但架构不得阻碍未来加入本地服务、原生桌面运行时或
工具执行器。

## Why This Stack

## 为什么选择这个技术栈

- TypeScript gives explicit module contracts for slow-variable boundaries.
- TypeScript 可以为慢变量边界提供明确的模块契约。
- Vite keeps the early local UI shell small and runnable.
- Vite 让早期本地 UI 外壳保持轻量并可运行。
- React is a practical UI layer for the future desktop companion surface.
- React 是未来桌面伴侣界面的实用 UI 层。
- Vitest gives fast local tests before storage, model, and memory behavior exist.
- 在存储、模型和记忆行为实现之前，Vitest 能提供快速的本地测试。
- Future desktop runtime may use Tauri, Electron, a Node.js backend, a Python
sidecar, or other local services if needed.
- 如果需要，未来桌面运行时可以使用 Tauri、Electron、Node.js 后端、
Python sidecar 或其他本地服务。

## Boundary Rules

## 边界规则

- RIN core runtime must remain independent from UI components.
- RIN 核心运行时必须独立于 UI 组件。
- UI must call core runtime through explicit interfaces.
- UI 必须通过明确接口调用核心运行时。
- UI components must not contain model, memory, storage, tool, or policy logic.
- UI 组件不得包含模型、记忆、存储、工具或策略逻辑。
- UI code must not call external model providers directly.
- UI 代码不得直接调用外部模型服务商。
- Model providers must enter through future model adapters.
- 模型服务商必须通过未来的模型适配器接入。
- Memory writes must go through a future local memory manager.
- 记忆写入必须通过未来的本地记忆管理器。
- Tool execution must go through a future permission gateway.
- 工具执行必须通过未来的权限网关。
- Tool execution and device or application control must never be implemented
directly inside React components.
- 工具执行以及设备或应用控制绝不能直接实现在 React 组件中。
- Slow variables must be local, versioned where appropriate, and protected from
direct overwrite by fast variables.
- 慢变量必须保存在本地，在适当位置进行版本化，并防止被快变量直接覆盖。
- Live2D is a future body and interface layer, not RIN's identity or core
runtime.
- Live2D 是未来的身体和接口层，不是 RIN 的身份或核心运行时。

## Local Runtime and State

## 本地运行时与状态

- Browser `localStorage` must not be used for core RIN state such as memory,
identity, user model, permissions, or audit logs.
- 浏览器 `localStorage` 不得用于保存 RIN 核心状态，例如记忆、身份、
用户模型、权限或审计日志。
- Core state must live in local files or databases under controlled data
directories.
- 核心状态必须保存在受控数据目录下的本地文件或数据库中。
- Core state must be exportable, importable, backed up, and eventually
synchronized.
- 核心状态必须能够导出、导入、备份，并最终支持同步。
- Local data directories must be treated as owner-controlled state, not browser
cache.
- 本地数据目录必须被视为所有者控制的状态，而不是浏览器缓存。
- UI state may remain temporary, but it must not become the source of truth for
RIN's slow variables.
- UI 状态可以是临时的，但不得成为 RIN 慢变量的事实来源。

## Phase 2 Storage Foundation

## Phase 2 存储基础

- The first storage step is a Node-side initializer for controlled local data
directories.
- 第一个存储步骤是 Node 侧的受控本地数据目录初始化器。
- The initializer may create directories and a `manifest.json` that records the
storage schema version, owner id, device id, and directory layout.
- 初始化器可以创建目录和 `manifest.json`，用于记录存储 schema 版本、
owner id、device id 和目录布局。
- The initializer must not implement chat logs, long-term memory behavior,
model calls, tool execution, or synchronization.
- 初始化器不得实现聊天日志、长期记忆行为、模型调用、工具执行或同步。
- Existing local manifests must not be blindly overwritten in ways that erase
owner or device identity.
- 已存在的本地 manifest 不得被盲目覆盖，尤其不能抹除 owner 或 device 身份。
- UI code must not import Node filesystem storage modules directly.
- UI 代码不得直接导入 Node 文件系统存储模块。

## Still Deferred After Phase 19

## Phase 19 后仍延后实现的内容

The following are intentionally still not implemented after Phase 19:

以下内容在 Phase 19 后仍然有意不实现：

- UI-direct model provider calls.
- UI 直接调用模型服务商。
- Hard-coded provider-specific model calls.
- 硬编码的特定服务商模型调用。
- API key storage in tracked files or local core config.
- 在已跟踪文件或本地核心配置中存储 API Key。
- Automatic long-term memory writes without review.
- 未经审查的自动长期记忆写入。
- Medium-risk or high-risk automatic tool execution.
- 中高风险工具自动执行。
- Real Live2D asset loading.
- 真实 Live2D 资产加载。
- Native transparent desktop window.
- 原生透明桌面窗口。
- State synchronization.
- 状态同步。
- Multi-user accounts.
- 多用户账户。
- SaaS administration.
- SaaS 管理后台。

## Phase 3-19 Current Runtime Template

## Phase 3-19 当前运行时模板

- Phase 3 adds a local SQLite foundation with schema migrations, conversation,
  message, memory placeholder, and audit event tables.
- Phase 3 增加本地 SQLite 地基，包括 schema migration、conversation、message、
  memory 占位和 audit event 表。
- Phase 4 adds a provider-neutral model abstraction with only a local mock
  adapter enabled.
- Phase 4 增加服务商中立的模型抽象层，目前只启用本地 mock adapter。
- Phase 5 adds a basic local conversation path through the runtime. It writes
  raw messages to SQLite and uses the mock adapter only.
- Phase 5 增加通过 runtime 的基础本地对话路径。它会把原始消息写入 SQLite，
  并且只使用 mock adapter。
- Phase 5 did not call external models, write long-term memory, execute tools,
  or integrate Live2D. Later phases add auditable boundaries before broadening
  any of those capabilities.
- Phase 5 未调用外部模型、写入长期记忆、执行工具或集成 Live2D。后续阶段会先添加
  可审计边界，再逐步扩大这些能力。
- Phase 6 records raw runtime events for traceability.
- Phase 6 记录原始 runtime 事件，用于可追踪性。
- Phase 7 supports memory proposals only; Phase 18 adds local review before any
  proposal can become accepted memory.
- Phase 7 仅支持记忆提案；Phase 18 增加本地审查，提案必须通过审查才能成为已接受
  记忆。
- Phase 8 snapshots slow variables for future review and rollback.
- Phase 8 快照慢变量，用于未来审查和回退。
- Phase 9 evaluates model responses through local policy checks.
- Phase 9 通过本地策略检查评估模型回复。
- Phase 10 updates local AI state through a local state engine.
- Phase 10 通过本地状态引擎更新 AI 状态。
- Phase 11 exports manual local Agent State Bundles.
- Phase 11 导出手动本地 Agent State Bundle。
- Phase 12-13 register tools and allow only built-in L0 tools to auto-execute
  through the permission gate.
- Phase 12-13 注册工具，并且只允许内置 L0 工具通过权限网关自动执行。
- Phase 14-15 define a body adapter and provide an original chibi SVG rig at
  `/body`. This is Live2D-compatible in state fields, but it is not a Cubism
  `.moc3` asset.
- Phase 14-15 定义身体 adapter，并在 `/body` 提供原创 Q 版 SVG rig。它在状态
  字段上兼容 Live2D，但不是 Cubism `.moc3` 资产。
- Phase 16 adds a local-only desktop body interaction shell for `/body`. Drag
  position, click reaction, and bubble visibility are UI fast variables; they do
  not write memory, execute tools, or become RIN identity.
- Phase 16 增加 `/body` 的仅本地桌面身体交互壳。拖拽位置、点击反应和气泡可见性
  都是 UI 快变量；它们不会写入记忆、执行工具或成为 RIN 身份。
- Phase 17 adds configurable model adapter selection. The default remains
  `rin-mock-local`; OpenAI-compatible providers require explicit environment
  configuration and still pass through runtime, model adapter, policy, raw log,
  state, and snapshot boundaries.
- Phase 17 增加可配置的模型 adapter 选择。默认仍是 `rin-mock-local`；
  OpenAI-compatible 服务商必须通过环境变量显式配置，并且仍会经过 runtime、
  模型 adapter、policy、raw log、state 和 snapshot 边界。
- Phase 18 adds local memory proposal review. A `/remember ` message still only
  creates a proposal; acceptance, rejection, and archiving happen through local
  runtime review routes and are audited.
- Phase 18 增加本地记忆提案审查。`/remember ` 消息仍然只创建提案；接受、拒绝
  和归档必须通过本地 runtime 审查路由完成，并会被审计。
- Phase 19 adds local conversation history routes and UI continuation. Existing
  conversations can be selected, read, and continued by passing their stable
  conversation id back through the runtime.
- Phase 19 增加本地对话历史路由和 UI 续聊能力。已有对话可以被选择、读取，并通过
  稳定 conversation id 回传 runtime 来继续。
