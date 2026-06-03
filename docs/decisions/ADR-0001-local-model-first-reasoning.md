# ADR-0001: Local-Model-First Reasoning

# ADR-0001：本地模型优先推理

## Status

Accepted.

已接受。

## Context

RIN is a single-owner, local-first, long-running personal agent system. Its
identity, memory, policy, state, and continuity are slow variables that must
remain locally governed.

RIN 是单一所有者、本地优先、长期运行的个人智能体系统。它的身份、记忆、
策略、状态和连续性都是慢变量，必须由本地治理。

Earlier implementation phases added a provider-neutral model abstraction, a
local mock adapter, and an explicitly configured OpenAI-compatible external
adapter boundary. That work is useful, but it must not turn RIN into an
API-first system.

此前阶段已经加入服务商中立的模型抽象层、本地 mock adapter，以及需要显式配置的
OpenAI-compatible 外部 adapter 边界。这些工作仍然有价值，但不能让 RIN 变成
API 优先的系统。

## Decision

RIN is local-model-first.

RIN 是本地模型优先的系统。

Local models are the preferred default reasoning substrate when feasible. The
first intended real local runtime is Ollama, and the recommended initial local
chat model target is Qwen3 4B (`qwen3:4b`).

在可行时，本地模型是默认优先的推理底座。第一个计划中的真实本地运行时是
Ollama，推荐的初始本地聊天模型目标是 Qwen3 4B（`qwen3:4b`）。

External APIs remain optional expert or fallback providers. They may be useful
for stronger specialized reasoning, comparison, migration tests, or temporary
fallbacks, but they must not become RIN's identity source or default
architectural assumption.

外部 API 仍然只是可选的专家或回退服务。它们可以用于更强的专门推理、对比、
迁移测试或临时回退，但不能成为 RIN 的身份来源，也不能成为默认架构假设。

All model calls, whether local or external, must pass through the model adapter
boundary. UI code, memory code, policy code, state code, and storage code must
not call Ollama, OpenAI-compatible APIs, or any other provider directly.

无论本地还是外部，所有模型调用都必须经过模型 adapter 边界。UI、记忆、策略、
状态和存储代码不得直接调用 Ollama、OpenAI-compatible API 或任何其他服务商。

No model, local or external, is RIN's identity source. RIN's identity and memory
remain local slow variables governed by local policy, review, state, storage,
and explicit owner-controlled migration.

任何模型，无论本地还是外部，都不是 RIN 的身份来源。RIN 的身份和记忆仍然是
本地慢变量，由本地策略、审查、状态、存储和所有者控制的显式迁移机制治理。

## Consequences

- Future real-chat implementation should prioritize an Ollama adapter path.
- External API support should remain adapter-isolated and optional.
- Provider-specific configuration must remain outside tracked secrets and core
  identity files.
- Runtime, UI, memory, policy, state, and storage must depend on model adapter
  contracts, not provider SDKs or direct HTTP calls.
- Readiness checks may mention optional external API configuration, but should
  not frame external APIs as the main path to RIN's real reasoning.

- 后续真实聊天实现应优先推进 Ollama adapter 路径。
- 外部 API 支持应保持 adapter 隔离，并且只是可选能力。
- 特定服务商配置必须留在已忽略的本地密钥或环境中，不能进入已跟踪文件或核心身份文件。
- Runtime、UI、记忆、策略、状态和存储必须依赖模型 adapter 契约，而不是服务商 SDK
  或直接 HTTP 调用。
- 就绪检查可以提到可选外部 API 配置，但不应把外部 API 描述成 RIN 真实推理的主线。

## Non-Goals

- This ADR does not implement an Ollama adapter.
- This ADR does not pull or install Qwen3 4B.
- This ADR does not remove the existing OpenAI-compatible adapter boundary.
- This ADR does not choose a permanent model identity for RIN.
- This ADR does not change runtime behavior by itself.

- 本 ADR 不实现 Ollama adapter。
- 本 ADR 不拉取或安装 Qwen3 4B。
- 本 ADR 不移除现有 OpenAI-compatible adapter 边界。
- 本 ADR 不为 RIN 选择永久模型身份。
- 本 ADR 本身不改变运行时行为。

## Follow-Up Implementation Phases

1. Add an Ollama model adapter behind the existing model abstraction.
2. Add local configuration and readiness checks for Ollama availability and the
   `qwen3:4b` model target.
3. Preserve the local mock adapter as the default for deterministic tests.
4. Keep OpenAI-compatible providers as explicitly configured optional expert or
   fallback providers.
5. Add tests that prove UI and runtime paths still go through the adapter
   boundary and do not call providers directly.

1. 在现有模型抽象层后面增加 Ollama model adapter。
2. 增加 Ollama 可用性和 `qwen3:4b` 模型目标的本地配置与就绪检查。
3. 保留本地 mock adapter 作为确定性测试默认值。
4. 将 OpenAI-compatible 服务商保留为需要显式配置的可选专家或回退服务。
5. 添加测试，证明 UI 和 runtime 路径仍然经过 adapter 边界，不会直接调用服务商。
