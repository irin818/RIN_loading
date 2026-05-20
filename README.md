# RIN

RIN is a local-first, single-owner personal agent system.

RIN 是一个本地优先、单一所有者的个人智能体系统。

Before modifying this project, read [PROJECT_CHARTER.md](./PROJECT_CHARTER.md).

修改本项目之前，必须先阅读 [PROJECT_CHARTER.md](./PROJECT_CHARTER.md)。

## Current Scope

## 当前范围

This repository currently contains Phase 0 through Phase 16 as local MVP
templates:

当前仓库包含 Phase 0 到 Phase 16 的本地 MVP 模板：

- Project definition and charter.
- 项目定义与项目宪章。
- Technical direction.
- 技术方向。
- Project skeleton.
- 项目骨架。
- Environment configuration.
- 环境配置。
- Local data directory layout and schema manifest.
- 本地数据目录布局与 schema manifest。
- SQLite database foundation with schema migrations and audit events.
- 带 schema migration 和审计事件的 SQLite 数据库地基。
- Provider-neutral model abstraction with a local mock adapter.
- 服务商中立的模型抽象层，以及本地 mock adapter。
- Basic local conversation path through the runtime.
- 通过 runtime 的基础本地对话路径。
- Raw logs, memory proposals, policy checks, state history, export bundles,
  permission-gated low-risk tools, an original chibi SVG body rig, and a
  local-only body interaction shell.
- 原始日志、记忆提案、策略检查、状态历史、导出包、受权限控制的低风险工具，
  原创 Q 版 SVG 身体 rig，以及仅本地运行的身体交互壳。

It intentionally does not implement external model calls, accepted long-term
memory writes without review, medium-risk or high-risk automatic tools, real
Live2D asset loading, synchronization, multi-user systems, SaaS backends, or
provider-specific model calls. It also does not yet implement a native
transparent desktop window.

当前阶段有意不实现外部模型调用、未经审查接受的长期记忆写入、中高风险工具
自动执行、真实 Live2D 模型资产加载、同步、多用户系统、SaaS 后台，也不实现
任何特定模型服务商调用。当前也尚未实现原生透明桌面窗口。

## Install

## 安装依赖

```sh
npm install
```

## Run Empty Project

## 启动空项目

```sh
npm run dev
```

## Local Data Foundation

## 本地数据基础

Phase 2 introduced a Node-side storage foundation that initializes a controlled
local data directory and writes a `manifest.json` with the storage schema
version. Phase 3 added SQLite persistence. Phase 4 added model abstraction.
Phase 5 added a basic local conversation path through the runtime. Phase 6-16
added raw logs, memory proposals, policy checks, state history, export bundles,
permission-gated L0 tools, an original chibi SVG body rig, and a local-only
body interaction shell.

Phase 2 引入 Node 侧存储基础，可以初始化受控本地数据目录，并写入带有存储
schema 版本的 `manifest.json`。Phase 3 增加 SQLite 持久化。Phase 4 增加模型
抽象层。Phase 5 增加通过 runtime 的基础本地对话路径。Phase 6-16 增加原始
日志、记忆提案、策略检查、状态历史、导出包、受权限控制的 L0 工具和原创 Q 版
SVG 身体 rig，以及仅本地运行的身体交互壳。

Initialize local RIN data:

初始化本地 RIN 数据：

```sh
npm run rin:init
```

Inspect local RIN data:

检查本地 RIN 数据：

```sh
npm run rin:inspect
```

Start the local read-only RIN Console:

启动本地只读 RIN Console：

```sh
npm run rin:console
```

Open the clean body view:

打开干净身体视图：

```text
http://127.0.0.1:4173/body
```

The current body is not a Cubism `.moc3` file. It is an original layered SVG rig
with chibi anime styling, blinking, breathing, hair sway, and state mapping.
The `/body` view now also supports local-only dragging, click reactions, and a
temporary bilingual bubble layer. Future real Live2D assets can replace it
through the body adapter boundary.

当前身体不是 Cubism `.moc3` 文件。它是原创分层 SVG rig，具备 Q 版动漫风格、
眨眼、呼吸、头发轻摆和状态映射。`/body` 视图现在还支持仅本地的拖拽、点击
反应和临时双语气泡层。未来真实 Live2D 资产可以通过 body adapter 边界替换它。

Export a local Agent State Bundle:

导出本地 Agent State Bundle：

```sh
npm run rin:export
```

Run a built-in L0 low-risk tool:

运行内置 L0 低风险工具：

```sh
npm run rin:tool
```

The console serves the built UI and local runtime APIs on
`http://127.0.0.1:4173`. The UI does not read files directly. Conversation
submission goes through the runtime, uses the mock model adapter, and writes raw
messages to SQLite.

Console 会在 `http://127.0.0.1:4173` 提供构建后的 UI 和本地 runtime API。UI
不会直接读取文件。对话提交会经过 runtime，使用 mock 模型适配器，并把原始消息
写入 SQLite。

The Console now includes a basic local conversation template. It uses only the
mock model adapter, writes raw messages to SQLite, and does not call external
models. Messages beginning with `/remember ` create memory proposals only.

Console 现在包含一个基础本地对话模板。它只使用 mock 模型适配器，会把原始
消息写入 SQLite，不会调用外部模型。以 `/remember ` 开头的消息只会创建记忆提案。

The initializer creates readable JSON files for the owner model, AI identity,
AI state, policy config, model config, tool registry, and permissions. These are
starter state files only; they do not implement memory behavior, tool execution,
external model calls, or Live2D.

初始化器会创建可读的 JSON 文件，包括所有者模型、AI 身份、AI 状态、策略配置、
模型配置、工具注册表和权限配置。这些只是起步状态文件；它们不实现记忆行为、
工具执行、外部模型调用或 Live2D。

## Test

## 运行测试

```sh
npm test
```
