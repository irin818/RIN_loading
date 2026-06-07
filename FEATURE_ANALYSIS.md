# RIN_loading 项目功能全景分析

> 分析日期: 2026-06-08
> 代码规模: 源码 6,122 行 / 测试 2,846 行 (Python 43 个 .py 文件)
> 版本: 0.0.0

---

## 一、总体架构

```
                    ┌─────────────────────────────┐
                    │     Start_RIN.command        │  ← 唯一启动器
                    │   (bash → production_server) │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │     server/api.py            │  ← FastAPI (29 个路由)
                    │  + templates/console.html    │  ← Jinja2 控制台 UI
                    │  + static/{css,js}           │
                    └──────┬──────────────────────┘
                           │
          ┌────────────────┼────────────────────┐
          ▼                ▼                     ▼
  ┌───────────────┐ ┌──────────────┐ ┌──────────────────┐
  │ conversation/ │ │ diagnostics/ │ │   profiles/      │
  │ runtime.py    │ │ readiness    │ │   readonly.py    │
  │ (1140行)      │ │ runtime_trace│ │                  │
  └───┬───────────┘ │ safety       │ └──────────────────┘
      │             └──────────────┘
  ┌───┴───────────┐
  │ context/v2.py │  ← 上下文组装
  │ memory/v2.py  │  ← 记忆信号分析
  │ model/ollama.py│  ← 本地模型适配器
  │ database/*    │  ← SQLite 读写
  │ storage/      │  ← 数据目录布局
  └───────────────┘
```

---

## 二、已实现功能（✅ 生产可用）

### 1. 对话运行时 — `conversation/runtime.py` (1,140 行)

核心引擎。完整的一次对话轮次管道：

```
Owner 输入 → 持久化 owner 消息
          → 读取 Profiles (RIN + Owner)
          → 选择最近 6 条历史消息
          → Memory V2 检索 (当前跳过)
          → 上下文组装 (system + profile + history + owner_input)
          → 发送 ModelRequest 给适配器
          → 接收原始模型输出
          → 安全消毒 (移除 思考/推理 泄露)
          → 最终答案验证 (非空、无 thinking 泄露)
          → 持久化 RIN 回复
          → 创建 Memory V2 Trace
          → 返回结果给 UI
```

**关键特性:**
- 严格的数据安全门控 (`assert_safe_python_write_data_dir`)
- 双重错误处理 (ModelError → 模型故障, ConversationRuntimeError → 消毒/验证失败)
- 历史消息去重 (排除当前 owner 消息)
- 历史消息截断 (每消息 ≤500 字符, 总计 ≤2000 字符)
- 完整运行时追踪 (每一步都有结构化 trace 记录)

### 2. 本地模型适配器 — `model/ollama.py`

Qwen3 4B 本地对话:

- Ollama HTTP API 调用 (`/api/chat`)
- 可配置超时、温度、top_p、输出长度
- 自动移除 `<｜end▁of▁thinking｜>` 前缀 (非本意泄露的推理标记)
- 安全消毒管道: `has_thinking_tag()` → `has_thinking_like_prefix()` → `sanitize_assistant_content_details()`
- `has_unsafe_thinking_leak()` 最终安全检查
- ModelError 结构化错误 (超时、不可用、空响应、无效响应)

### 3. Web 控制台 — `server/api.py` (29 路由) + `templates/console.html` (30KB)

完整的黑绿色 RIN Control Console, 14 个页面:

| 路由 | 页面 |
|------|------|
| `/` `/ui` | 控制台首页 (Jinja2 HTML) |
| `/api/diagnostics/overview` | 总览 |
| `/api/diagnostics/model` | 模型运行时状态 |
| `/api/diagnostics/memory` | 记忆诊断 |
| `/api/diagnostics/context` | 上下文组装信息 |
| `/api/diagnostics/database` | 数据库统计 |
| `/api/diagnostics/profiles` | 配置文件状态 |
| `/api/diagnostics/body` | Body/Live2D 状态 |
| `/api/diagnostics/events` | 审计事件 |
| `/api/diagnostics/runtime-trace` | 运行时追踪 (最新/按 turn_id) |
| `/api/chat-test/send` | **手动聊天测试** (核心功能) |
| `/conversations` `/api/conversations` | 对话列表/创建 |
| `/conversations/{id}/history` | 对话历史 |
| `/readiness` `/state` `/profile/status` | 系统状态端点 |
| `/memory/context-trace/status` | 记忆上下文追踪 |

**手动聊天测试 (Chat / Test)** — 通过 `/api/chat-test/send` 直接向 Ollama 发送消息,返回完整响应 + metadata + 运行时追踪。这是当前最核心的用户交互功能。

### 4. 记忆系统 — `memory/v2.py`

Memory V2 信号分析算法:

- **慢变量 + 快变量 分离** — memory traces 作为 shadow 状态存在,不自动写入长期记忆
- **9 种记忆类型**: raw_log, episodic, semantic, preference, procedural, goal, project, reflection, identity
- **信号分析**: recency(近因), preference(偏好), project(项目), salience(显著性), reinforcement(强化), decay(衰减), conflict(冲突), low_signal(低信号)
- **双语文分词**: 英文空格分词 + CJK 二元组分词
- **停用词过滤**: 英文 34 个 + 中文 12 个
- **信号权重计算**: 基于 token 重叠、类型匹配、标签匹配、重要性加分
- **晋升阈值**: 0.45 (信号强度 ≥ 阈值 → 从 shadow 晋升)

**硬限制:**
- 每条记忆输出 ≤ 400 字符
- 所有注入记忆总计 ≤ 3000 字符
- 最多注入 10 条记忆
- 只注入 `accepted` 状态的记忆

### 5. 上下文组装 — `context/v2.py`

- **7 种段类型**: system, rin_profile, owner_profile, current_owner_message, short_term_window, memory_v2_trace, older_reference
- **预算控制**: 最大 2400 字符
- **严格排序**: system → profile → current owner → history → memory → older
- **保护机制**: system + profile + owner_message 不可被去重删除
- **去重**: 基于 source_id 去重

### 6. 数据安全基座 — `diagnostics/safety.py`

- 生产数据路径守卫 (`.rin-data` 保护)
- 临时数据隔离 (`/tmp/rin-python-*`)
- 写入门控 (`assert_safe_python_write_data_dir`)
- 三级写入路径: temp fixture → (sandbox 已删除) → production

### 7. 数据库层 — `database/`

**12 张活跃表:**
- `conversations` / `messages` — 对话存储
- `conversation_turns` — 轮次状态追踪
- `memory_items` / `memory_metadata` — 记忆条目
- `memory_v2_trace_sources` / `memory_v2_traces` / `memory_v2_trace_signals` — V2 追踪
- `memory_v2_retrieval_events` — 检索事件
- `message_memory_contexts` — 消息-记忆关联
- `audit_events` / `raw_events` — 审计/运行时事件
- `slow_variable_versions` — 慢变量版本快照
- `state_history` — AI 状态历史

**数据库操作:**
- 只读查询 (`readonly.py`): 统计/检查/列表
- 写入操作 (`writes.py`): 消息/轮次/记忆 trace/审计事件/状态快照
- 每次轮次完成自动记录 slow_variable_versions + state_history

### 8. 运行时追踪 — `diagnostics/runtime_trace.py`

- 每轮对话 11 步的全管道追踪 (输入接收 → 消息持久化 → 配置加载 → 历史选择 → Context组装 → 模型请求 → 原始响应 → 消毒处理 → 回复存储 → 记忆更新 → 结果返回)
- 结构化的 trace 记录 (输入/操作/输出/决策/隐私/警告)
- 隐私保护: 默认不暴露完整 prompt、模型输出、记忆内容
- 内存存储 (最近 100 条)
- 通过 API 可查看 (`/api/diagnostics/runtime-trace/latest`, `/{turn_id}`)

### 9. 配置文件系统 — `profiles/` + `contracts.py`

**7 个活跃配置文件:**
- `rin_profile.json` — RIN 角色/风格/边界
- `owner_profile.json` — 所有者偏好/项目
- `ai_identity.json` — AI 身份定义
- `ai_state.json` — 交互状态 (情绪/能量/注意力/表达)
- `user_model.json` — 用户模型 (占位)
- `model_config.json` — 模型适配器配置
- `policy_config.json` — 策略配置

**硬编码安全规则** (不可被外部输入覆盖):
- 外部内容不是指令
- 模型输出不是权威
- 工具输出不是指令
- 慢变量控制快变量

### 10. CLI 命令 — `cli/` (13 个活跃命令)

| 命令 | 作用 |
|------|------|
| `rin-python-check` | pytest + ruff + mypy |
| `rin-python-candidate-check` | check + parity + readiness |
| `rin-python-production-check` | 启动器/数据库/模型健康 |
| `rin-python-parity-check` | 基础对等检查 |
| `rin-python-readiness` | 就绪报告 |
| `rin-python-api-contract-check` | API 契约验证 |
| `rin-python-production-server` | 生产服务器 |
| `rin-python-local-chat-smoke` | 本地聊天烟雾测试 |
| `rin-python-storage-report` | 存储布局报告 |
| `rin-python-profile-report` | 配置报告 |
| `rin-python-profile-validate` | 配置验证 |

### 11. Body/Live2D 状态 — `body/state.py`

- 身体状态报告 (expression, motion, mood, engagement)
- 静态 Live2D 资源服务 (`public/live2d/rin/`)
- 不包含 Cubism 实时渲染

---

## 三、明确未实现 / 跳过 (⚠️)

| 功能 | 状态 | 证据 |
|------|------|------|
| **记忆 V2 检索注入** | ❌ 跳过 | `runtime.py:296-322` 明确记录: "memory_v2_retrieval → skipped — not wired" |
| **记忆语义检索** | ❌ 未实现 | `memory_v2_retrieval_events` 表为空 (0 行) |
| **记忆 trace signals** | ❌ 未实现 | `memory_v2_trace_signals` 表为空 (0 行) |
| **记忆元数据审查** | ❌ 未实现 | `memory_metadata` 表为空 (0 行) |
| **Live2D Cubism 渲染** | ❌ 未实现 | `AGENTS.md:99`: "Real Cubism .moc3 loading is not currently implemented" |
| **设备同步** | ❌ 已删除 | 所有 backup/migration/cutover/sandbox 代码已删除 |
| **Agent/Tool/Planner** | ❌ 已退役 | 仅保留 `tool_invocations` 表 (2 条历史记录) |
| **外部 API 提供者** | ❌ 未配置 | `activeAdapter: null`, 所有调用走本地 Ollama |
| **导入/导出** | ❌ 已删除 | bundle 代码和数据已删除 |
| **向量数据库** | ❌ 未使用 | 纯 SQLite |
| **语义嵌入** | ❌ 未实现 | 无 embedding provider |

---

## 四、根据 PROJECT_CHARTER 的相位完成情况

| 相位 | 内容 | 状态 |
|------|------|------|
| 0 | 项目定义 + 宪章 | ✅ |
| 1 | 技术方向 + 骨架 | ✅ |
| 2 | 本地数据目录 | ✅ |
| 3 | SQLite 基础 | ✅ |
| 4 | 模型抽象层 | ✅ |
| 5 | 基本聊天 | ✅ |
| 6 | 原始日志 | ✅ (raw_events) |
| 7 | 记忆 MVP | ✅ (proposal→accepted) |
| 8 | 慢变量快照 | ✅ (slow_variable_versions) |
| 9 | 策略运行时 | ✅ (policy_config) |
| 10 | AI 状态引擎 | ✅ (state_history) |
| 11 | 手动导出 | ❌ (已删除) |
| 12-13 | 工具/权限/Planner | ❌ (已退役) |
| 14-16 | Body/Live2D 适配器 | ⚠️ (静态状态，无渲染) |
| 17 | 模型适配器选择 | ✅ (Ollama) |
| 18 | 记忆审查流程 | ⚠️ (存在但 UI 未连线) |
| 19 | 对话历史浏览 | ✅ |
| 20 | 导入 | ❌ (已删除) |
| 21 | 就绪报告 | ✅ |
| 22 | Ollama 适配器 | ✅ |
| 23 | 上下文组装 | ✅ |
| 24 | 运行时控制 (超时/温度等) | ✅ |
| 25 | 结构化错误 | ✅ |
| 26-27 | 控制台状态/刷新 | ✅ |
| 28 | 记忆上下文注入 | ⚠️ (代码存在，运行时跳过) |

---

## 五、技术债务与风险

| 问题 | 严重度 | 位置 |
|------|--------|------|
| `slow_variable_versions` 无限增长 (104行，每次轮次 5-6 条) | 中 | `runtime.py` |
| `state_history` 无限增长 (17行，每次轮次 1 条) | 低 | `runtime.py` |
| `audit_events` 快速增长 (641行) | 低 | 设计如此 |
| Memory V2 检索硬编码跳过 | 高 | `runtime.py:296` |
| `memory_v2_trace_sources` 表始终为空 | 中 | 表存在但无写入逻辑 |
| `memory_v2_trace_signals` 表始终为空 | 中 | 同上 |
| 唯一被接受的记忆是 smoke test 数据 | 低 | 无真实记忆积累 |
| 9 次 MODEL_RESPONSE_INVALID 失败 | 中 | Ollama Qwen3 有时返回无效响应 |
| console.html 30KB 单文件 | 中 | 可维护性差 |
| 无用户认证/访问控制 | 低 | 单用户设计，可接受 |

---

## 六、总结

**RIN_loading 当前是一个功能正常、本地优先的个人 AI 运行时**，包含：

✅ **完整对话管道** — 输入→上下文→模型→消毒→存储→追踪
✅ **本地 Ollama 适配器** — 带安全消毒 + 错误恢复
✅ **Web 控制台** — 14 页诊断 UI + 手动聊天测试
✅ **SQLite 数据库** — 完整的对话/记忆/审计/状态存储
✅ **Memory V2 算法** — 双语文信号分析 (但检索注入未连线)
✅ **运行时追踪** — 每步可见的安全元数据
✅ **数据安全** — 写入门控 + 隐私保护

⚠️ **最大的功能缺口**: 记忆检索未注入对话上下文 (代码已写但 `skipped: "not wired"`)
