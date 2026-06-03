# RIN

RIN is a local-first, single-owner personal agent system.

RIN 是一个本地优先、单一所有者的个人智能体系统。

Before modifying this project, read [PROJECT_CHARTER.md](./PROJECT_CHARTER.md).

修改本项目之前，必须先阅读 [PROJECT_CHARTER.md](./PROJECT_CHARTER.md)。

## Current Scope

## 当前范围

This repository currently contains Phase 0 through Phase 24 as local MVP
templates:

当前仓库包含 Phase 0 到 Phase 24 的本地 MVP 模板：

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
- Provider-neutral model abstraction with local-model-first direction, local
  mock defaults, and configurable adapter selection.
- 服务商中立的模型抽象层、本地模型优先方向、本地 mock 默认值，以及可配置的
  adapter 选择。
- Basic local conversation path through the runtime.
- 通过 runtime 的基础本地对话路径。
- Raw logs, memory proposals, policy checks, state history, export bundles,
  permission-gated low-risk tools, an original chibi SVG body rig, and a
  local-only body interaction shell.
- 原始日志、记忆提案、策略检查、状态历史、导出包、受权限控制的低风险工具，
  原创 Q 版 SVG 身体 rig，以及仅本地运行的身体交互壳。
- Configurable model adapter selection with local mock defaults and an
  OpenAI-compatible adapter that is active only when explicitly configured as an
  optional external provider.
- 可配置的模型 adapter 选择；默认使用本地 mock，OpenAI-compatible adapter
  只有在作为可选外部服务显式配置后才会启用。
- Ollama local chat adapter support for explicitly selected local real-chat
  use with Qwen3 4B (`qwen3:4b`).
- Ollama 本地聊天 adapter 支持，可在显式选择后使用 Qwen3 4B
  （`qwen3:4b`）进行本地真实聊天。
- A bounded model context builder that adds a compact RIN system prompt and
  prevents unbounded conversation history from being sent to model adapters.
- 有界模型上下文构建器，会加入紧凑的 RIN system prompt，并防止把无界对话历史
  直接发送给模型 adapter。
- Local Ollama runtime controls for timeout, output length, and sampling
  stability when `rin-ollama-local` is explicitly selected.
- 本地 Ollama runtime 控制项，可在显式选择 `rin-ollama-local` 时配置超时、
  输出长度和采样稳定性。
- Controlled local memory review for accepting, rejecting, or archiving memory
  proposals.
- 受控的本地记忆审查流程，可接受、拒绝或归档记忆提案。
- Local conversation history browsing and continuation.
- 本地对话历史浏览与继续对话。
- Manual Agent State Bundle export and safe import into a new empty data
  directory.
- 手动 Agent State Bundle 导出，以及安全导入到新的空数据目录。
- A local readiness report for checking local state and remaining model/provider
  setup before live model use.
- 本地就绪检查报告，用于检查本地状态，以及真实模型使用前仍缺少的模型或服务商设置。

It intentionally does not store API keys in tracked files or local core config,
does not allow UI-direct model calls, and does not implement automatic
long-term memory writes without review, medium-risk or high-risk automatic
tools, real Live2D asset loading, synchronization, multi-user systems, SaaS
backends, API-first core architecture, hard-coded provider-specific model calls,
or UI-direct Ollama/API calls. It also does not yet implement a native
transparent desktop window.

当前阶段有意不在已跟踪文件或本地核心配置中存储 API Key，不允许 UI 直接调用
模型服务商，也不实现未经审查的自动长期记忆写入、中高风险工具自动执行、
真实 Live2D 模型资产加载、同步、多用户系统、SaaS 后台、API 优先的核心架构、
硬编码的特定模型服务商调用，以及 UI 直接调用 Ollama/API。当前也尚未实现
原生透明桌面窗口。

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
Phase 5 added a basic local conversation path through the runtime. Phase 6-24
added raw logs, memory proposals, policy checks, state history, export bundles,
permission-gated L0 tools, an original chibi SVG body rig, a local-only body
interaction shell, configurable model adapter selection, and controlled memory
review, local conversation history browsing, safe bundle import, readiness
reporting, the first Ollama local chat adapter, and bounded model context
assembly plus local runtime controls before adapter calls.

Phase 2 引入 Node 侧存储基础，可以初始化受控本地数据目录，并写入带有存储
schema 版本的 `manifest.json`。Phase 3 增加 SQLite 持久化。Phase 4 增加模型
抽象层。Phase 5 增加通过 runtime 的基础本地对话路径。Phase 6-24 增加原始
日志、记忆提案、策略检查、状态历史、导出包、受权限控制的 L0 工具、原创 Q 版
SVG 身体 rig、仅本地运行的身体交互壳、可配置的模型 adapter 选择，以及受控记忆
审查、本地对话历史浏览、安全 bundle 导入、就绪检查报告、第一个 Ollama 本地聊天
adapter，以及 adapter 调用前的有界模型上下文组装和本地 runtime 控制项。

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

Import an Agent State Bundle into a new empty local data directory:

导入 Agent State Bundle 到新的空本地数据目录：

```sh
RIN_BUNDLE_PATH=/absolute/path/to/agent-state-bundle \
RIN_IMPORT_DATA_DIR=.rin-imported-data \
npm run rin:import
```

Import refuses to overwrite a non-empty data directory.

导入流程会拒绝覆盖非空数据目录。

Run a built-in L0 low-risk tool:

运行内置 L0 低风险工具：

```sh
npm run rin:tool
```

Check local readiness before live model use:

真实模型使用前检查本地就绪状态：

```sh
npm run rin:readiness
```

The console serves the built UI and local runtime APIs on
`http://127.0.0.1:4173`. The UI does not read files directly. Conversation
submission goes through the runtime, uses the configured model adapter, and
writes raw messages to SQLite.

Console 会在 `http://127.0.0.1:4173` 提供构建后的 UI 和本地 runtime API。UI
不会直接读取文件。对话提交会经过 runtime，使用已配置的模型 adapter，并把
原始消息写入 SQLite。

The Console now includes a basic local conversation template. It uses the
configured model adapter, writes raw messages to SQLite, and keeps memory
writes behind proposal review. By default that adapter is still the local mock.
Messages beginning with `/remember ` create memory proposals that can be
accepted or rejected in the Console. Recent conversations can be reopened and
continued through the same local conversation id.

Console 现在包含一个基础本地对话模板。它使用已配置的模型 adapter，会把原始
消息写入 SQLite，并且通过提案审查处理记忆写入。默认 adapter 仍是本地
mock。以 `/remember ` 开头的消息会创建可在 Console 中接受或拒绝的记忆提案。
最近对话可以重新打开，并通过同一个本地 conversation id 继续。

## Model Direction and Adapter Configuration

## 模型方向与 Adapter 配置

RIN is local-model-first. The recommended first real local chat target is
Ollama with Qwen3 4B (`qwen3:4b`). The current default remains the safe local
mock adapter unless `rin-ollama-local` is explicitly selected.

RIN 是本地模型优先的系统。推荐的第一个真实本地聊天目标是 Ollama 与
Qwen3 4B（`qwen3:4b`）。除非显式选择 `rin-ollama-local`，当前默认值仍然是
安全的本地 mock adapter。

To use local Ollama chat, install and start Ollama locally, pull the model, and
select the adapter from an untracked `.env` or shell environment:

如需使用本地 Ollama 聊天，请在本机安装并启动 Ollama，拉取模型，并在未跟踪的
`.env` 或 shell 环境变量中选择 adapter：

```sh
brew install --cask ollama-app
open -ga Ollama
ollama pull qwen3:4b

RIN_MODEL_ADAPTER=rin-ollama-local
RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434
RIN_OLLAMA_MODEL=qwen3:4b
RIN_OLLAMA_TIMEOUT_MS=120000
RIN_OLLAMA_NUM_PREDICT=512
RIN_OLLAMA_TEMPERATURE=0.6
RIN_OLLAMA_TOP_P=0.9
```

Ollama does not need an API key. Keep the base URL bound to localhost unless a
future security review explicitly changes that deployment model.

Ollama 不需要 API Key。除非未来经过明确安全审查，否则 base URL 应保持在
localhost。

External APIs remain optional expert or fallback providers. To test an
OpenAI-compatible provider later, keep real secrets in an untracked `.env` or
shell environment and set:

外部 API 仍只是可选的专家或回退服务。之后如果要测试 OpenAI-compatible
服务商，真实密钥必须放在未跟踪的 `.env` 或 shell 环境变量中，并设置：

```sh
RIN_MODEL_ADAPTER=rin-openai-compatible
RIN_OPENAI_COMPATIBLE_BASE_URL=https://your-provider.example/v1
RIN_OPENAI_COMPATIBLE_MODEL=your-model-name
RIN_OPENAI_COMPATIBLE_API_KEY=your-api-key
```

The UI never calls model providers directly. Conversation requests still go
through the local runtime, model adapter, policy check, SQLite logging, state
update, and slow-variable snapshot path.

UI 永远不直接调用模型服务商。对话请求仍会经过本地 runtime、模型 adapter、
policy check、SQLite 记录、状态更新和慢变量快照路径。

RIN does not send unbounded conversation history to local models. Phase 23 adds
a first character-based context budget and compact RIN system prompt before
model adapter calls. Long-term memory retrieval is still future work.

RIN 不会把无界对话历史发送给本地模型。Phase 23 在模型 adapter 调用前加入第一版
基于字符数的上下文预算和紧凑 RIN system prompt。长期记忆检索仍是后续工作。

## Local Model Stability

## 本地模型稳定性

Phase 24 adds scoped runtime controls for the local Ollama adapter:

Phase 24 为本地 Ollama adapter 增加了有限的 runtime 控制项：

```sh
RIN_OLLAMA_TIMEOUT_MS=120000
RIN_OLLAMA_NUM_PREDICT=512
RIN_OLLAMA_TEMPERATURE=0.6
RIN_OLLAMA_TOP_P=0.9
```

Use `RIN_OLLAMA_TIMEOUT_MS` to prevent local model calls from hanging
indefinitely. Use `RIN_OLLAMA_NUM_PREDICT` to keep output length bounded; lower
it, for example to `256`, if local generation is slow. `RIN_OLLAMA_TEMPERATURE`
and `RIN_OLLAMA_TOP_P` keep sampling stable by default.

使用 `RIN_OLLAMA_TIMEOUT_MS` 防止本地模型调用无限挂起。使用
`RIN_OLLAMA_NUM_PREDICT` 控制输出长度；如果本地生成较慢，可以把它降低到
例如 `256`。`RIN_OLLAMA_TEMPERATURE` 和 `RIN_OLLAMA_TOP_P` 默认保持较稳定的
采样。

Common local failures and fixes:

常见本地故障与处理：

- Ollama not running: start it with `open -ga Ollama`, then confirm
  `curl http://127.0.0.1:11434/api/tags`.
- Ollama 未运行：用 `open -ga Ollama` 启动，然后确认
  `curl http://127.0.0.1:11434/api/tags`。
- Model not pulled: run `ollama pull qwen3:4b`.
- 模型未拉取：运行 `ollama pull qwen3:4b`。
- Local timeout: reduce prompt length, lower `RIN_OLLAMA_NUM_PREDICT`, restart
  Ollama, or try a smaller local model.
- 本地超时：缩短 prompt，降低 `RIN_OLLAMA_NUM_PREDICT`，重启 Ollama，或尝试更小
  的本地模型。
- Long prompt or slow generation: keep the context budget enabled and prefer a
  lower output limit before raising timeout.
- prompt 过长或生成过慢：保持上下文预算启用，优先降低输出长度，再考虑增加超时。

The initializer creates readable JSON files for the owner model, AI identity,
AI state, policy config, model config, tool registry, and permissions. These are
starter state files only; they do not implement memory behavior, tool execution,
external model configuration by themselves, or Live2D. Memory behavior is
implemented by the runtime and SQLite memory tables, not by blindly editing
these starter files.

初始化器会创建可读的 JSON 文件，包括所有者模型、AI 身份、AI 状态、策略配置、
模型配置、工具注册表和权限配置。这些只是起步状态文件；它们本身不实现记忆行为、
工具执行、外部模型配置或 Live2D。记忆行为由 runtime 和 SQLite 记忆表实现，
不是通过盲目编辑这些起步文件实现。

## Test

## 运行测试

```sh
npm test
```
