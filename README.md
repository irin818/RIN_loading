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

## Development Checks

## 开发检查

Use the aggregate local check before final reports or PRs when practical:

在最终报告或 PR 前，尽量运行聚合本地检查：

```sh
npm run rin:check
```

`npm run rin:check` runs typecheck, tests, lint, build, default mock readiness,
and `npm run rin:memory-eval` in order. It exits non-zero on the first failing
step, does not require Ollama, does not call external APIs, and does not use real
owner memory beyond normal test fixture behavior.

`npm run rin:check` 会依次运行 typecheck、tests、lint、build、默认 mock readiness
以及 `npm run rin:memory-eval`。任一步失败都会以非零状态退出。它不需要 Ollama，
不调用外部 API，也不会使用真实所有者记忆（正常测试 fixture 行为除外）。

If the aggregate check fails, run the individual commands to diagnose:

如果聚合检查失败，可分别运行以下命令定位问题：

```sh
npm run typecheck
npm test
npm run lint
npm run build
npm run rin:readiness
npm run rin:memory-eval
npm run rin:semantic-eval
npm run rin:semantic-readiness
npm run rin:semantic-index-report
npm run rin:semantic-live-index-report
npm run rin:hybrid-retrieval-report
npm run rin:semantic-trace-list
npm run rin:semantic-trace-read
npm run rin:memory-maintenance-report
npm run rin:planner-smoke
npm run rin:backup-dry-run
npm run rin:backup-create
npm run rin:backup-verify
npm run rin:restore-dry-run
npm run rin:restore-apply
npm run rin:full-check
```

For changes that affect memory retrieval, bounded context assembly,
memoryContext traceability/persistence, or conversation runtime paths that shape
model context, `npm run rin:memory-eval` remains especially important and should
be reported explicitly:

如果改动影响记忆检索、有界上下文组装、memoryContext 追溯/持久化，或会影响模型上下文的
conversation runtime 路径，`npm run rin:memory-eval` 仍然特别重要，并应在报告中明确说明：

```sh
npm run rin:memory-eval
```

Current successful output includes `Total: 29`, `Passed: 29`, `Failed: 0`, and
`providerCallCount: 0`, plus category-level pass/fail lines. This check uses
in-memory fixtures only: it does not call model providers, does not require
Ollama, and does not use real owner data. It protects accepted-only retrieval,
budget limits, privacy, traceability, type-aware ranking, metadata-aware
ranking, token-dominance, and near-miss behavior alongside the normal
type/test/lint/build/readiness checks.

当前成功输出包含 `Total: 29`、`Passed: 29`、`Failed: 0` 和
`providerCallCount: 0`，并包含按类别统计的通过/失败行。该检查只使用内存
fixture：不会调用模型服务商，不需要 Ollama，也不会使用真实所有者数据。它与常规
type/test/lint/build/readiness 检查一起保护 accepted-only 检索、预算限制、隐私、
可追溯性、type-aware ranking、metadata-aware ranking、token-dominance 和 near-miss 行为。

Semantic retrieval comparison is a separate fixture-only report command:

语义检索比较是一个单独的 fixture-only 报告命令：

```sh
npm run rin:semantic-eval
```

`npm run rin:semantic-eval` compares the current deterministic injected memory
IDs with explicit fixture-only semantic candidate IDs and report-only hybrid
candidate IDs. It reports false positives, false negatives, accepted-only
violations, zero-overlap semantic candidates, privacy checks, and
`providerCallCount: 0`. It does not require Ollama, does not call model
providers, does not read real `.rin-data`, and does not connect semantic
candidates to production retrieval or context injection.

`npm run rin:semantic-eval` 会比较当前 deterministic 注入记忆 ID、显式
fixture-only semantic candidate ID，以及仅用于报告的 hybrid candidate ID。它会报告
false positives、false negatives、accepted-only violations、zero-overlap
semantic candidates、privacy checks 和 `providerCallCount: 0`。它不需要 Ollama，
不调用模型 provider，不读取真实 `.rin-data`，也不会把 semantic candidates 接入生产检索
或 context injection。

Semantic retrieval readiness is also report-only:

语义检索 readiness 也是仅报告命令：

```sh
npm run rin:semantic-readiness
```

It reports the deterministic baseline status, semantic eval availability,
fixture prototype availability, disabled local embedding provider scaffold, no
vector DB, no real `.rin-data` indexing, no production integration, and
`providerCallCount: 0`.

它会报告 deterministic baseline 状态、semantic eval 可用性、fixture prototype 可用性、
disabled local embedding provider scaffold、无 vector DB、无真实 `.rin-data` indexing、
无生产集成，以及 `providerCallCount: 0`。

Local Ollama readiness is a separate optional live-model check when local model
behavior is in scope:

当任务涉及本地模型行为时，本地 Ollama readiness 是一个单独的可选真实模型检查：

```sh
RIN_MODEL_ADAPTER=rin-ollama-local RIN_OLLAMA_BASE_URL=http://127.0.0.1:11434 RIN_OLLAMA_MODEL=qwen3:4b npm run rin:readiness
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
model adapter calls.

RIN 不会把无界对话历史发送给本地模型。Phase 23 在模型 adapter 调用前加入第一版
基于字符数的上下文预算和紧凑 RIN system prompt。

Phase 28 lets explicitly accepted long-term memories begin influencing model
context in a bounded, auditable way. Before each model call, RIN selects a small,
deterministic subset of accepted memories relevant to the current owner message
(first version: keyword overlap with recency as a tiebreaker) and injects them as
a compact system-level memory block placed after the RIN system prompt and before
conversation messages. Only memories explicitly accepted through the existing
review flow are ever used; pending, rejected, and archived memories are never
injected, and no memories are auto-written or auto-accepted. Injection is limited
(by default at most 5 memories and 2000 characters) and always yields to the
budget priority order: RIN system prompt, latest owner message, accepted memories,
then recent conversation messages — so memories can never push out the latest
owner message. Injected memory ids, count, and character size are recorded in the
raw/audit logs for traceability. There is no embeddings or vector database yet.

Phase 28 让经过明确接受的长期记忆开始以有界、可审计的方式影响模型上下文。在每次
模型调用前，RIN 会针对当前所有者消息选择一小批确定性的相关已接受记忆（第一版：
关键词重叠并以时间近因作为并列排序依据），并将它们作为紧凑的系统级记忆块注入，
位置在 RIN system prompt 之后、对话消息之前。只有通过现有审查流程被明确接受的记忆
才会被使用；待审、被拒绝和已归档的记忆绝不会被注入，也不会自动写入或自动接受记忆。
注入是有限的（默认最多 5 条记忆、2000 个字符），并始终服从预算优先级：RIN system
prompt、最新所有者消息、已接受记忆，然后才是最近的对话消息——因此记忆永远不会挤掉
最新的所有者消息。被注入的记忆 id、数量和字符大小会记录在原始/审计日志中以便追溯。
目前还没有 embeddings 或向量数据库。

Phase 29 adds safe, read-only traceability for memory context injection. The
Console and conversation turn metadata can show how many memories were injected,
which memory IDs were used, matched keywords, overlap counts, and why other
accepted memories were skipped (zero relevance, max count, or memory budget).
Full memory text is not exposed in logs or the Console by default. There is still
no memory editor, no embeddings/vector database, and no semantic search service.

Phase 29 为记忆上下文注入增加了安全的只读追溯能力。Console 与对话回合元数据可显示
注入数量、使用的记忆 ID、匹配关键词、重叠计数，以及其他已接受记忆被跳过的原因（零相关、
数量上限或记忆预算）。默认情况下，完整记忆文本不会出现在日志或 Console 中。仍然没有
记忆编辑器、embeddings/向量数据库或语义搜索服务。

Phase 30 improves deterministic accepted-memory retrieval without embeddings.
Retrieval now applies lightweight normalization: lowercase and punctuation cleanup,
conservative English plural folding (for example `models`→`model`, `APIs`→`api`),
slash/hyphen token splitting (`Ollama/Qwen3`, `local-model-first`), a small
English/Chinese stopword list that preserves technical tokens, and simple CJK
bigram overlap for mixed Chinese/English queries. Scoring remains explainable
(Latin token matches weighted above CJK bigram matches, recency as tie-break).
Memory injection trace can show normalized matched tokens plus Latin/CJK match
counts. Full memory text is still not exposed in Console or logs by default.

Phase 30 在不使用 embeddings 的前提下改进了确定性的已接受记忆检索。检索现在会进行轻量
归一化：大小写与标点清理、保守的英文复数折叠（例如 `models`→`model`、`APIs`→`api`）、
斜杠/连字符分词（`Ollama/Qwen3`、`local-model-first`）、保留技术词的小规模中英文停用词过滤，
以及对中英混合查询的简单 CJK 二元组重叠匹配。评分仍可解释（拉丁词匹配权重高于 CJK
二元组匹配，时间近因作为并列依据）。记忆注入追溯可显示归一化后的匹配词以及拉丁/CJK
匹配计数。完整记忆文本默认仍不会暴露在 Console 或日志中。

Phase 31 adds a deterministic local memory-injection evaluation harness. The
`npm run rin:memory-eval` script runs built-in in-memory fixtures that check
expected injected memory ids, excluded pending/rejected/irrelevant memories,
matched normalized tokens, skip reasons, privacy constraints, and budget/count
limits. The harness does not call LLMs, does not require Ollama, and does not use
real owner data. It exists to protect retrieval quality before any future
embeddings or semantic retrieval work.

Phase 31 增加了确定性的本地记忆注入评估 harness。`npm run rin:memory-eval`
会运行内置的内存 fixture，用于检查预期注入的记忆 ID、被排除的待审/拒绝/无关记忆、
归一化匹配 token、跳过原因、隐私约束以及预算/数量限制。该 harness 不调用 LLM，
不需要 Ollama，也不使用真实所有者数据。它用于在未来引入 embeddings 或语义检索之前
保护检索质量。

Phase 32 persists the safe `memoryContext` trace for successful RIN turns and
reloads it with conversation history. The persisted trace stores memory IDs,
counts, normalized matched tokens, score components, skip reasons, and character
counts, but not full memory text, model context snippets, or raw prompt text. Old
conversations without stored memory traces continue to load normally. The
Console can show the most recent reloaded successful turn with stored memory
context, still read-only and without a memory editor. `npm run rin:memory-eval`
should remain part of retrieval-related review checks.

Phase 32 会为成功的 RIN 回合持久化安全的 `memoryContext` 追溯信息，并在加载对话历史时
重新取回。持久化内容只包含记忆 ID、计数、归一化匹配 token、评分组成、跳过原因和字符数，
不保存完整记忆文本、模型上下文片段或原始 prompt 文本。没有存储记忆追溯的旧对话仍可正常
加载。Console 可以显示最近一个已加载且带有存储记忆上下文的成功回合，仍然只读且不提供
记忆编辑器。涉及检索的 review checks 应继续包含 `npm run rin:memory-eval`。

Phase 34 makes persisted `memoryContext` traces inspectable per historical RIN
response in the Console. RIN replies that have stored trace metadata show a
read-only Memory context affordance, allowing the owner to switch between
historical turns and view injected memory counts, shortened IDs, matched tokens,
overlap counts, score components, and skip reasons. The Console uses only the
persisted generation-time trace: it does not recompute memoryContext, query
memory retrieval, call model providers, expose full memory text, or add a memory
editor.

Phase 34 让 Console 可以按历史 RIN 回复查看已持久化的 `memoryContext` 追溯。带有存储
追溯元数据的 RIN 回复会显示只读的 Memory context 入口，所有者可以在历史回合之间切换，
查看注入数量、缩短后的记忆 ID、匹配 token、重叠计数、评分组成和跳过原因。Console 只使用
生成当时已持久化的追溯：不会重新计算 memoryContext，不会再次查询记忆检索，不会调用模型
provider，不会暴露完整记忆文本，也不会增加记忆编辑器。

Milestone 4 adds deterministic type-aware ranking for accepted-memory retrieval.
The existing `memoryType` field can add a small `typeMatchBonus` only after
memory content already has token overlap, so token relevance remains primary and
type alone cannot inject a memory. Trace metadata may show the memory type, type
bonus, and matched type signals, but it still excludes full memory text. This
adds no schema fields, migrations, embeddings, vector database, semantic
retrieval service, memory editor, or provider calls. `npm run rin:memory-eval`
now protects the type-aware ranking behavior with in-memory fixtures.

Milestone 4 为 accepted-memory 检索增加了确定性的 type-aware ranking。现有的
`memoryType` 字段只有在记忆内容已经存在 token 重叠时，才能增加一个很小的
`typeMatchBonus`，因此 token 相关性仍是主信号，单靠类型不会注入记忆。追溯元数据可以显示
记忆类型、类型 bonus 和匹配到的类型信号，但仍不会包含完整记忆文本。该改动不增加 schema
字段、migration、embeddings、向量数据库、语义检索服务、记忆编辑器或 provider 调用。
`npm run rin:memory-eval` 现在通过内存 fixture 保护 type-aware ranking 行为。

Mega-Milestone 5 adds the owner-reviewed memory metadata foundation. Memory
items can now carry locally stored metadata (`tags`, `importance`, `confidence`,
`source`, `reviewedAt`, and `acceptedAt`) in a side table, and the Console memory
review area provides compact owner-editable controls. Metadata writes are
audited, validated, and tied to owner review/edit actions; model output does not
become trusted metadata. This milestone does not make metadata affect retrieval
ranking, does not inject metadata into model context, and does not add
embeddings, vector search, or semantic retrieval. Future metadata-aware ranking
must be designed separately and protected by `npm run rin:memory-eval`.

Mega-Milestone 5 增加了 owner-reviewed memory metadata foundation。记忆条目现在
可以在 side table 中保存本地元数据（`tags`、`importance`、`confidence`、`source`、
`reviewedAt` 和 `acceptedAt`），Console 的记忆审查区域也提供了紧凑的所有者编辑控件。
元数据写入会经过审计和校验，并绑定到所有者审查/编辑动作；模型输出不会自动成为可信元数据。
本 milestone 不让元数据影响检索排序，不把元数据注入模型上下文，也不增加 embeddings、
向量搜索或语义检索。未来 metadata-aware ranking 必须单独设计，并由
`npm run rin:memory-eval` 保护。

Mega-Milestone 6 adds metadata-aware accepted-memory retrieval under the
evaluation gate. Retrieval may now use only owner-reviewed metadata after content
already has lexical overlap: matching tags and `high` importance can add small
bounded bonuses, while `low` confidence dampens metadata bonus. Source and review
timestamps remain trace/explanation-only. Metadata cannot inject zero-overlap
memories, cannot override materially stronger token relevance, and still does
not add embeddings, vector search, semantic retrieval, provider calls, or
model-generated metadata. Memory context trace can show safe metadata score
fields such as matched tags, metadata bonus, and metadata signals without full
memory text or raw metadata JSON. At the end of Mega-Milestone 6,
`npm run rin:memory-eval` covered 24 provider-free fixtures for this behavior.

Mega-Milestone 6 在 evaluation gate 下加入 metadata-aware accepted-memory
retrieval。检索现在只能在记忆内容已经存在词汇重叠之后使用 owner-reviewed
metadata：匹配到的 tags 和 `high` importance 可以增加小的有界 bonus，而 `low`
confidence 会削弱 metadata bonus。source 与 review timestamps 仍只用于追溯/解释。
metadata 不能注入零词汇重叠的记忆，不能覆盖明显更强的 token relevance，也不会增加
embeddings、向量搜索、语义检索、provider 调用或模型生成的 metadata。memory context
trace 可以显示安全的 metadata score 字段，例如 matched tags、metadata bonus 和
metadata signals，但不包含完整记忆文本或原始 metadata JSON。在 Mega-Milestone 6
结束时，`npm run rin:memory-eval` 用 24 个 provider-free fixtures 保护该行为。

Mega-Milestone 7 improves memory quality visibility before semantic retrieval.
`npm run rin:memory-eval` now reports fixture categories, category pass/fail
counts, failed case IDs, and `providerCallCount` while keeping reports concise
and free of full memory text. The Console Memory context panel remains read-only
and uses persisted generation-time `memoryContext` data to show trace item
counts, memory-context characters, lexical overlap components, type bonus,
metadata bonus components, matched tags, confidence/importance contributions,
and skipped reasons. It does not run eval in the browser, call providers,
recompute retrieval, expose raw JSON, or add a memory editor. The evaluation
suite now covers 29 provider-free fixtures, including metadata near-misses, CJK
near-misses, metadata-rich budget behavior, metadata source privacy, and
type+metadata interaction.

Mega-Milestone 7 在引入 semantic retrieval 之前改进 memory quality visibility。
`npm run rin:memory-eval` 现在会报告 fixture 类别、每个类别的通过/失败数量、
失败用例 ID 和 `providerCallCount`，同时保持输出精简且不包含完整记忆文本。
Console 的 Memory context 面板仍然只读，并只使用生成当时持久化的
`memoryContext` 数据来显示 trace item 数、memory-context 字符数、lexical overlap
组成、type bonus、metadata bonus 组成、matched tags、confidence/importance 贡献和
跳过原因。它不会在浏览器中运行 eval，不会调用 provider，不会重新计算检索，不会暴露
raw JSON，也不会增加记忆编辑器。评估套件现在包含 29 个 provider-free fixtures，覆盖
metadata near-miss、CJK near-miss、metadata-rich budget、metadata source privacy
和 type+metadata interaction。

Mega-Milestone 8 defines the local semantic retrieval boundary without adding
semantic retrieval to production. Deterministic accepted-memory retrieval remains
the production baseline. Future semantic work must be local-first, optional,
accepted-only, provider-free by default, and eval-gated before it can affect
context injection. The design is captured in
[`ADR-0002`](./docs/decisions/ADR-0002-local-semantic-memory-retrieval.md),
[`SEMANTIC_RETRIEVAL_PROTOTYPE_PLAN.md`](./docs/SEMANTIC_RETRIEVAL_PROTOTYPE_PLAN.md),
and
[`MEMORY_RETRIEVAL_EVALUATION_PLAN.md`](./docs/MEMORY_RETRIEVAL_EVALUATION_PLAN.md).
This milestone adds no embeddings, vector DB, schema migration, provider calls,
dependencies, or UI behavior.

Mega-Milestone 8 定义本地 semantic retrieval 边界，但不把 semantic retrieval
加入生产检索。确定性的 accepted-memory retrieval 仍是生产基线。未来 semantic 工作
必须保持本地优先、可选、accepted-only、默认不调用 provider，并在影响 context
injection 前通过 evaluation gate。设计记录在
[`ADR-0002`](./docs/decisions/ADR-0002-local-semantic-memory-retrieval.md)、
[`SEMANTIC_RETRIEVAL_PROTOTYPE_PLAN.md`](./docs/SEMANTIC_RETRIEVAL_PROTOTYPE_PLAN.md)
和
[`MEMORY_RETRIEVAL_EVALUATION_PLAN.md`](./docs/MEMORY_RETRIEVAL_EVALUATION_PLAN.md)。
本 milestone 不增加 embeddings、vector DB、schema migration、provider calls、
dependencies 或 UI 行为。

Mega-Milestone 9 adds a fixture-only semantic retrieval comparison harness. The
`npm run rin:semantic-eval` command runs synthetic, in-memory cases that
compare deterministic injected IDs, fixture semantic candidate IDs, and
report-only hybrid candidates. It detects false positives, false negatives,
accepted-only violations, zero-overlap semantic candidates, privacy leaks, and
provider calls while keeping production retrieval unchanged. The semantic
candidates are fixture annotations only; they are not embeddings, vector search,
runtime behavior, UI behavior, or context injection.

Mega-Milestone 9 增加了 fixture-only semantic retrieval comparison harness。
`npm run rin:semantic-eval` 会运行 synthetic in-memory cases，比较
deterministic 注入 ID、fixture semantic candidate ID 和仅用于报告的 hybrid
candidates。它会检测 false positives、false negatives、accepted-only
violations、zero-overlap semantic candidates、privacy leaks 和 provider calls，
同时保持生产检索不变。这里的 semantic candidates 只是 fixture 注解；它们不是
embeddings、vector search、runtime behavior、UI behavior 或 context injection。

Ultra-Milestone 10 adds the semantic retrieval readiness program. It introduces
a deterministic fixture/mock embedding provider, vector math utilities, an
in-memory vector index, fixture-only prototype semantic candidate generation,
harder `npm run rin:semantic-eval` reporting, and
`npm run rin:semantic-readiness`. It also documents future local embedding
providers, semantic index lifecycle, hybrid retrieval integration, and opt-in
production gates. Production semantic retrieval remains disabled: no real
embedding dependency, vector DB, provider call, schema migration, real
`.rin-data` indexing, server API, Console behavior, runtime path, or context
injection is added.

Ultra-Milestone 10 增加 semantic retrieval readiness program。它加入确定性的
fixture/mock embedding provider、vector math utilities、in-memory vector index、
fixture-only prototype semantic candidate generation、更严格的
`npm run rin:semantic-eval` 报告，以及 `npm run rin:semantic-readiness`。同时补充
未来 local embedding provider、semantic index lifecycle、hybrid retrieval
integration 和 opt-in production gates 文档。生产 semantic retrieval 仍然禁用：没有
新增真实 embedding dependency、vector DB、provider call、schema migration、真实
`.rin-data` indexing、server API、Console behavior、runtime path 或 context
injection。

Ultra-Milestone 11 and Super-Milestone 12-14 add report-only semantic provider
and accepted-memory report commands without changing production retrieval.
`npm run rin:semantic-live-readiness` is an explicit, skippable local embedding
readiness probe. `npm run rin:semantic-index-report`,
`npm run rin:semantic-live-index-report`, and
`npm run rin:hybrid-retrieval-report` are explicit report commands that are
disabled by default. Without owner opt-in they do not read real `.rin-data`, do
not list memories, do not call providers, and print ID/count/status fields only.
With explicit opt-in, they remain report-only, accepted-only, in-memory, and
never inject semantic candidates into model context.

Package 2 adds semantic trace persistence and an explicit semantic context
candidate-expansion gate. Report commands can persist sanitized semantic/hybrid
trace records only when `--record-semantic-trace` or
`RIN_SEMANTIC_TRACE=record` is supplied; traces are stored as safe audit records
and can be inspected with `npm run rin:semantic-trace-list` and
`npm run rin:semantic-trace-read`. The trace payload stores IDs, counts, status,
provider mode, safe error codes, and safety flags only. It does not store full
memory text, raw prompts, model context snippets, raw metadata JSON, embedding
vectors, secrets, environment dumps, or local paths.

Semantic context candidate expansion remains disabled by default. To enable the
bounded candidate-expansion path locally:

```sh
RIN_SEMANTIC_CONTEXT=candidate-expansion \
RIN_SEMANTIC_CONTEXT_MAX_CANDIDATES=2 \
RIN_SEMANTIC_CONTEXT_MAX_CHARACTERS=600 \
npm run rin:console
```

When enabled, deterministic accepted-memory retrieval still runs first and
remains the baseline. Semantic candidates are accepted-only, deduped, capped,
counted against memory and whole-context budgets, and traced separately from
deterministic memory IDs. The generated system prompt and latest owner message
remain preserved. Default checks and default report commands remain
provider-free and do not call Ollama.

Package 3 adds suggestion-only memory maintenance, a dry-run action permission
foundation, and a finite local planner smoke loop:

```sh
npm run rin:memory-maintenance-report
npm run rin:planner-smoke
```

The maintenance report reads local memory records and prints IDs, statuses,
types, counts, and safe reason codes only; it does not mutate, archive, delete,
or rewrite memory. The action permission scaffold is deny-by-default for unknown,
destructive, and external actions, and all Package 3 registry actions are
dry-run-only. The planner smoke command runs a deterministic fixture plan,
dry-runs actions through the permission layer, starts no background loop, calls no
providers, and executes no real actions.

Package 4 adds read-only operational status to the Console snapshot for model,
memory, semantic context, permissions, planner, and backup readiness. It also
adds local continuity dry-runs:

```sh
npm run rin:backup-dry-run
npm run rin:restore-dry-run
```

Backup dry-run reports a safe manifest with relative file names, sizes, and
hashes for local RIN data that would be included. It creates no archive, performs
no cloud sync, and excludes logs, dependency/build output, environment files, and
secret-like paths. Restore dry-run validates a manifest when supplied and reports
overwrite risk without copying or mutating data.

v0.2-A adds a guarded encrypted local backup and restore workflow while keeping
the dry-run commands as the safe default. Encrypted backup creation and
verification use only local files and a shell-provided `RIN_BACKUP_PASSPHRASE`;
the passphrase must not be committed or printed. Restore dry-run decrypts the
archive locally, reports target file conflicts, and mutates nothing. Restore
apply requires the explicit `RIN_RESTORE_APPLY_EMPTY_TARGET` confirmation token,
refuses any target conflict, never performs cloud sync, and rewrites restored
`manifest.json` directory paths for the target data layout instead of preserving
old absolute paths.

v0.2-A 增加受保护的本地加密备份与恢复流程，同时保留 dry-run 命令作为安全默认值。
加密备份创建与校验只使用本地文件，并从 shell 环境变量 `RIN_BACKUP_PASSPHRASE`
读取口令；口令不得提交或打印。恢复 dry-run 会在本地解密归档、报告目标文件冲突且不变更
数据。恢复 apply 必须提供明确的 `RIN_RESTORE_APPLY_EMPTY_TARGET` 确认 token，
遇到任何目标冲突都会拒绝写入，不执行云同步，并会把恢复后的 `manifest.json` 目录路径改写为
目标数据 layout，避免保留旧设备绝对路径。

```sh
RIN_BACKUP_PASSPHRASE="local passphrase" npm run rin:backup-create -- /tmp/rin.rinbackup
RIN_BACKUP_PASSPHRASE="local passphrase" npm run rin:backup-verify -- /tmp/rin.rinbackup
RIN_BACKUP_PASSPHRASE="local passphrase" npm run rin:restore-dry-run -- /tmp/rin.rinbackup
RIN_BACKUP_PASSPHRASE="local passphrase" npm run rin:restore-apply -- /tmp/rin.rinbackup RIN_RESTORE_APPLY_EMPTY_TARGET
```

For v0.1 stabilization and release readiness, use:

```sh
npm run rin:full-check
```

See `docs/RIN_V0_1_READINESS_CHECKLIST.md`,
`docs/RIN_V0_1_PRIVACY_AUDIT.md`, `docs/RIN_V0_1_OPERATIONS_GUIDE.md`, and
`docs/RIN_V0_1_RELEASE_NOTES.md` for the release checklist, privacy boundaries,
standard operations, and known limitations.

Ultra-Milestone 11 和 Super-Milestone 12-14 增加仅报告的 semantic provider 与
accepted-memory report 命令，但不改变生产检索。`npm run
rin:semantic-live-readiness` 是显式、可跳过的本地 embedding readiness probe。
`npm run rin:semantic-index-report`、`npm run
rin:semantic-live-index-report` 和 `npm run rin:hybrid-retrieval-report` 是显式
report 命令，默认禁用。没有 owner opt-in 时，它们不会读取真实 `.rin-data`、不会列出
memory、不会调用 provider，并且只输出 ID/count/status 字段。即使显式 opt-in，它们也仍然
是 report-only、accepted-only、in-memory，并且绝不把 semantic candidates 注入模型上下文。

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

Phase 25 turns these failures into structured conversation errors instead of a
generic HTTP 500. When `adapter.generate()` fails, the conversation runtime
returns a JSON payload with a stable `error.code`
(`LOCAL_MODEL_TIMEOUT`, `LOCAL_MODEL_UNAVAILABLE`, `LOCAL_MODEL_MISSING`,
`MODEL_RESPONSE_INVALID`, `MODEL_PROVIDER_ERROR`, or
`CONVERSATION_RUNTIME_ERROR`), a concise `error.message`, `error.recovery`
guidance, and the active `modelAdapter`, `provider`, and `retryable` flag. The
local console route returns a matching HTTP status (for example 504 for
timeout, 503 for unavailable or missing model, 502 for invalid/provider
responses). Failed turns do not store a fake RIN reply; the whole turn is rolled
back and a `conversation.turn_failed` event is recorded for audit. Structured
errors never include stack traces, secrets, or local filesystem paths.

Phase 25 把这些故障变成结构化对话错误，而不是通用的 HTTP 500。当
`adapter.generate()` 失败时，对话 runtime 会返回一个 JSON 负载，包含稳定的
`error.code`（`LOCAL_MODEL_TIMEOUT`、`LOCAL_MODEL_UNAVAILABLE`、
`LOCAL_MODEL_MISSING`、`MODEL_RESPONSE_INVALID`、`MODEL_PROVIDER_ERROR` 或
`CONVERSATION_RUNTIME_ERROR`）、简洁的 `error.message`、`error.recovery` 恢复建议，
以及当前的 `modelAdapter`、`provider` 和 `retryable` 标记。本地 console 路由会返回
对应的 HTTP 状态（例如超时 504、不可用或缺少模型 503、无效或服务商响应 502）。
失败的对话不会存储虚假的 RIN 回复；整个对话回合会回滚，并记录一条
`conversation.turn_failed` 审计事件。结构化错误绝不包含堆栈、密钥或本地文件路径。

Phase 26 surfaces this existing information in the Console UI. The Model Runtime
panel now shows the active adapter, provider, local model status, and, when the
local Ollama adapter is selected, the model name, localhost-only base URL, and
the `timeout`, `num_predict`, `temperature`, and `top_p` settings. When a
conversation turn fails, the Console displays the structured `error.code`,
`error.message`, `retryable` flag, active adapter/provider/model, and the
`error.recovery` guidance list. The Console still does not switch models from the
UI; model selection remains environment/config driven, and the UI only reads
existing RIN local APIs (`/api/local-state` and the conversation endpoint)
without calling model providers directly.

Phase 26 把这些已有信息显示在 Console UI 中。模型运行时面板现在会显示当前
adapter、provider、本地模型状态；当选择本地 Ollama adapter 时，还会显示模型名称、
仅限 localhost 的 base URL，以及 `timeout`、`num_predict`、`temperature`、`top_p`
设置。当对话回合失败时，Console 会显示结构化的 `error.code`、`error.message`、
`retryable` 标记、当前 adapter/provider/model，以及 `error.recovery` 恢复建议列表。
Console 仍然不会从 UI 切换模型；模型选择仍由环境/配置决定，UI 只读取已有的 RIN
本地 API（`/api/local-state` 和对话端点），不会直接调用模型服务商。

Phase 27 makes local model recovery actionable from the Console. A manual
"Refresh status" action re-reads `/api/local-state` and updates the Model Runtime
panel, with a short loading state and a safe non-invasive message if the refresh
fails. When a conversation turn fails with a structured error marked
`retryable: true`, a "Retry" action resubmits the last failed message through the
normal conversation endpoint; retry never runs automatically, never polls, and is
not shown for non-retryable errors. Because failed turns roll back without storing
the owner message, the Console keeps the last failed input only in local UI state
for retry, never in long-term memory. Retry still goes through the RIN runtime and
does not call providers directly, and model selection remains environment/config
driven.

Phase 27 让本地模型恢复在 Console 中变得可操作。手动的 “Refresh status” 操作会
重新读取 `/api/local-state` 并更新模型运行时面板，带有短暂的加载状态；如果刷新
失败，会显示安全且不打扰的提示。当对话回合因结构化错误（标记为
`retryable: true`）失败时，“Retry” 操作会通过正常的对话端点重新提交上一条失败消息；
重试绝不自动执行、不轮询，并且不会对不可重试的错误显示。由于失败回合会回滚且不
存储所有者消息，Console 仅在本地 UI 状态中保留上一条失败输入用于重试，绝不写入
长期记忆。重试仍会经过 RIN runtime，不会直接调用服务商；模型选择仍由环境/配置决定。

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
