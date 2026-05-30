# RIN Project Map

# RIN 项目地图

This document explains the current project in plain language. It is meant to
help the owner understand what exists now and decide what should change next.

本文档用直白语言解释当前项目，帮助所有者理解现在已经有什么，以及下一步应该
怎么改。

## Current State

## 当前状态

RIN is not a full agent yet. It is currently a local-first foundation with a
basic local conversation template:

RIN 现在还不是完整智能体。当前它是一个本地优先基础系统，并带有基础本地
对话模板：

- A project charter that defines the long-term rules.
- 一份定义长期规则的项目宪章。
- A React + Vite UI shell for visibility and future interaction.
- 一个 React + Vite UI 外壳，用于可视化和未来交互。
- A read-only local RIN Console served by the local runtime.
- 一个由本地 runtime 提供的只读 RIN Console。
- A basic local conversation template using the configured model adapter.
- 一个使用已配置模型 adapter 的基础本地对话模板。
- Configurable model adapter selection that defaults to the local mock adapter
  and can use an OpenAI-compatible adapter only when explicitly configured.
- 可配置的模型 adapter 选择；默认使用本地 mock adapter，只有显式配置后才会使用
  OpenAI-compatible adapter。
- Controlled memory proposal review for accepting, rejecting, or archiving
  long-term memory candidates.
- 受控的记忆提案审查流程，可接受、拒绝或归档长期记忆候选项。
- Recent conversation browsing and continuation through stable conversation ids.
- 通过稳定 conversation id 浏览最近对话并继续对话。
- Manual export and safe import for Agent State Bundles.
- Agent State Bundle 的手动导出和安全导入。
- A Node-side local data initializer.
- 一个 Node 侧本地数据初始化器。
- A controlled `.rin-data` directory.
- 一个受控的 `.rin-data` 数据目录。
- Readable JSON files for slow variables and safety boundaries.
- 用于慢变量和安全边界的可读 JSON 文件。
- SQLite raw logs, memory proposals, state history, audit events, tool
  invocations, and export records.
- SQLite 原始日志、记忆提案、状态历史、审计事件、工具调用和导出记录。
- An original chibi SVG body rig at `/body`.
- 位于 `/body` 的原创 Q 版 SVG 身体 rig。
- A local-only body interaction shell with dragging, click reactions, and
  temporary bubbles.
- 一个仅本地运行的身体交互壳，支持拖拽、点击反应和临时气泡。

## Useful Commands

## 常用命令

Install dependencies:

安装依赖：

```sh
npm install
```

Start the UI shell:

启动 UI 外壳：

```sh
npm run dev
```

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

Start the read-only local RIN Console:

启动只读本地 RIN Console：

```sh
npm run rin:console
```

Open:

打开：

```text
http://127.0.0.1:4173
```

Run tests:

运行测试：

```sh
npm test
```

Export local state:

导出本地状态：

```sh
npm run rin:export
```

Run a safe built-in tool:

运行安全内置工具：

```sh
npm run rin:tool
```

Import a local Agent State Bundle into a new data directory:

导入本地 Agent State Bundle 到新的数据目录：

```sh
RIN_BUNDLE_PATH=/absolute/path/to/agent-state-bundle \
RIN_IMPORT_DATA_DIR=.rin-imported-data \
npm run rin:import
```

## Local Data Files

## 本地数据文件

After `npm run rin:init`, RIN creates `.rin-data`.

运行 `npm run rin:init` 后，RIN 会创建 `.rin-data`。

- `.rin-data/manifest.json`
- Records schema version, owner id, device id, and directory layout.
- 记录 schema 版本、owner id、device id 和目录布局。

- `.rin-data/databases/rin.sqlite`
- Stores schema migrations, raw conversation messages, memory placeholders, and
  audit events, raw runtime events, state history, tool invocations, and export
  bundle records.
- 保存 schema migration、原始对话消息、记忆占位、审计事件、原始 runtime 事件、
  状态历史、工具调用和导出包记录。

- `.rin-data/config/user_model.json`
- Placeholder for the owner's long-term model.
- 所有者长期模型的占位文件。

- `.rin-data/config/ai_identity.json`
- Placeholder for RIN's local identity model.
- RIN 本地身份模型的占位文件。

- `.rin-data/config/ai_state.json`
- Placeholder for future embodied state such as mood, attention, and expression.
- 未来具身化状态的占位文件，例如 mood、attention 和 expression。

- `.rin-data/config/policy_config.json`
- Placeholder for local policy rules.
- 本地策略规则的占位文件。

- `.rin-data/config/model_config.json`
- Provider-neutral model adapter selection. It must not contain API keys.
- 服务商中立的模型 adapter 选择文件。它不得包含 API Key。

- `.rin-data/config/tool_registry.json`
- Placeholder for future custom tools. Built-in L0 tools are registered in code.
- 未来自定义工具的占位文件。内置 L0 工具在代码中注册。

- `.rin-data/config/permissions.json`
- Placeholder for risk levels and confirmation rules.
- 风险等级和确认规则的占位文件。

- `.rin-data/logs/audit_log.jsonl`
- Placeholder for future append-only audit logs.
- 未来追加式审计日志的占位文件。

- `.rin-data/bundles/`
- Stores local Agent State Bundle exports.
- 保存本地 Agent State Bundle 导出包。

## What Is Intentionally Missing

## 当前有意缺失的内容

The following are not implemented yet:

以下内容尚未实现：

- UI-direct model provider calls or hard-coded provider-specific calls.
- UI 直接调用模型服务商，或硬编码的特定服务商调用。
- API keys in tracked files or local core config.
- 已跟踪文件或本地核心配置中的 API Key。
- Automatic long-term memory writes without review.
- 未经审查的自动长期记忆写入。
- Medium-risk or high-risk automatic tool execution.
- 中高风险工具自动执行。
- Real Live2D model assets.
- 真实 Live2D 模型资产。
- Native transparent desktop window.
- 原生透明桌面窗口。
- Sync.
- 同步。
- Multi-user accounts.
- 多用户账户。
- SaaS backend.
- SaaS 后台。

## How To Guide The Next Step

## 如何指导下一步

The most useful files for owner feedback right now are:

当前最适合所有者反馈的文件是：

- `PROJECT_CHARTER.md`
- Defines what RIN must and must not become.
- 定义 RIN 必须成为什么，以及不能变成什么。

- `docs/TECHNICAL_DIRECTION.md`
- Defines the runtime and architecture boundaries.
- 定义运行时和架构边界。

- `docs/PROJECT_MAP.md`
- Explains the current system in plain language.
- 用直白语言解释当前系统。

- `.rin-data/config/ai_identity.json`
- Shows the first local identity placeholder.
- 展示第一版本地身份占位文件。

- `.rin-data/config/user_model.json`
- Shows the first owner model placeholder.
- 展示第一版所有者模型占位文件。

If any wording feels wrong, the next development step should adjust these local
state files, schemas, and model adapter settings before broadening agent
behavior.

如果这些文字有任何不对，下一步应先调整这些本地状态文件、schema 和模型
adapter 设置，再扩大智能体行为。

## Local Console Template

## 本地 Console 模板

The current Console reads local runtime state and can submit a basic local test
message. Conversation messages are stored in SQLite through the runtime.

当前 Console 会读取本地 runtime 状态，也可以提交一条基础本地测试消息。对话
消息会通过 runtime 存入 SQLite。

It displays:

它会展示：

- Runtime connection status.
- Runtime 连接状态。
- Manifest status.
- Manifest 状态。
- Core local files.
- 核心本地文件。
- RIN identity summary.
- RIN 身份摘要。
- AI state summary.
- AI 状态摘要。
- Feature gates for explicit external model configuration, memory writes, and
  tool execution.
- 显式外部模型配置、记忆写入和工具执行这些功能开关。
- Recent memory proposals and review actions.
- 最近的记忆提案和审查操作。
- Recent conversation list and selected conversation messages.
- 最近对话列表和已选择对话的消息。
- Enabled local feature gates for the mock conversation runtime, controlled
  memory review path, L0 tool execution, and body interaction shell.
- 已启用的本地功能开关包括 mock 对话 runtime、受控记忆审查路径、L0 工具执行和
  身体交互壳。

The conversation template is intentionally limited:

对话模板被有意限制：

- It defaults to `rin-mock-local`.
- 它默认使用 `rin-mock-local`。
- It calls external models only when the model adapter is explicitly configured.
- 只有在模型 adapter 被显式配置后，它才会调用外部模型。
- It does not automatically accept long-term memory.
- 它不会自动接受长期记忆。
- Owner-reviewed proposals can be accepted or rejected locally.
- 经所有者审查的提案可以在本地接受或拒绝。
- Existing conversations can be reopened and continued locally.
- 已存在的对话可以在本地重新打开并继续。
- It only allows built-in L0 tools to auto-execute.
- 它只允许内置 L0 工具自动执行。

## Body MVP

## 身体 MVP

The current body layer is an original chibi SVG rig and a body adapter. It maps
local AI state into Live2D-compatible fields:

当前身体层是原创 Q 版 SVG rig 和身体 adapter。它会把本地 AI 状态映射为 Live2D
兼容字段：

- `emotion`
- `expression`
- `motion`
- `voiceStyle`
- `mouthSync`
- `idleBehavior`

It is not a Cubism `.moc3` model yet. It is a replaceable adapter boundary for
the future desktop body. It already has layered face, hair, body, accessory,
blink, breathing, and hair-sway motion. The `/body` view now adds a clean
local-only interaction shell: the body can be dragged, clicked, and can show a
temporary bilingual bubble without writing memory or calling tools.

它还不是 Cubism `.moc3` 模型。它是未来桌面身体的可替换 adapter 边界。它已经
具备分层脸部、头发、身体、配饰、眨眼、呼吸和头发轻摆动作。`/body` 视图现在
增加了干净的仅本地交互壳：身体可以被拖拽、点击，也可以显示临时双语气泡，
但不会写入记忆或调用工具。

The Console must remain separate from the future desktop body. It is an owner
control and inspection surface, not the final pet body.

Console 必须与未来桌面身体保持分离。它是所有者控制和检查界面，不是最终宠物
身体。
