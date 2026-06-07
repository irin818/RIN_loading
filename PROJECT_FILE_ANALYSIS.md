# RIN_loading 项目文件结构解析清单

> 分析日期：2026-06-08
> 总文件数：约 20,000（含 .git, node_modules, .venv 等）
> 实际源码文件：约 80 个 Python 源文件

---

## 一、顶层目录总览

```
RIN_loading/                          (总大小约 360MB，其中 304MB 为可删除/非必要数据)
├── .claude/                           Claude Code 本地配置
├── .git/                              版本控制（不计入分析）
├── .rin-data/                         **生产运行时数据** (3.0MB, git-忽略)
├── .rin-python-backups/               **数据备份** (2.0MB, git-忽略)
├── .rin-python-cutover-state/         **迁移切换状态** (16KB, git-忽略)
├── .rin-python-preview-data/          **预览/测试数据** (184KB, git-忽略)
├── dist/                              [⚠ 可删除] 旧 TypeScript 构建产物 (3.7MB)
├── docs/                              [⚠ 已清空] 仅剩 .DS_Store (所有文档已删除)
├── live2d-development/                Live2D 开发工作区 (33MB)
├── node_modules/                      [⚠ 可删除] 遗留 Node.js 依赖 (152MB)
├── public/                            静态运行时资源 (3.4MB)
├── python/                            **主动 Python 运行时** (主代码)
├── scripts/                           开发辅助脚本 (20KB)
├── tests/                             [⚠ 空壳] 仅 .gitkeep (实际测试在 python/tests/)
├── tmp/                               [⚠ 空] 仅有 .DS_Store
├── .DS_Store                          macOS 元数据
├── .env.example                       环境变量模板 (安全占位值)
├── .gitignore                         Git 忽略规则
├── AGENTS.md                          AI 开发代理行为指南 (210行)
├── ARCHITECTURE.md                    架构说明 (76行)
├── DEVELOPMENT_PROTOCOL.md            开发流程协议 (209行)
├── PROJECT_CHARTER.md                 项目宪章/最高约束 (624行)
├── README.md                          项目说明 (119行)
└── Start_RIN.command                  **启动脚本** (可执行)
```

---

## 二、各目录详细分析

### 2.1 `python/` — 主动运行时（核心源码目录）

```
python/
├── pyproject.toml                     Python 项目配置（依赖、脚本入口点）
├── README.md                          [⚠ 过时] 仍描述为 "Package 0 Candidate"
├── .venv/                             (152MB, git-忽略) Python 虚拟环境
├── .mypy_cache/                       (git-忽略) 类型检查缓存
├── .pytest_cache/                     (git-忽略) 测试缓存
├── .ruff_cache/                       (git-忽略) Lint 缓存
├── src/rin/                           **活跃源码** (约 980KB)
│   ├── __init__.py                    包初始化 + 版本信息入口
│   ├── version.py                     版本号
│   ├── api_contract.py                API 契约定义
│   ├── contracts.py                   数据契约
│   ├── cutover.py                     切换门控逻辑
│   ├── migration_dry_run.py           迁移预演
│   ├── preview.py                     预览逻辑
│   ├── sandbox.py                     沙箱环境
│   ├── shadow.py                      影子验证
│   ├── api/__init__.py                API 基础
│   ├── body/                           身体/Live2D 状态边界
│   │   ├── __init__.py
│   │   └── state.py                   身体状态管理
│   ├── cli/                            **CLI 命令集** (25 个命令)
│   │   ├── __init__.py
│   │   ├── _runner.py                 命令运行器
│   │   ├── check.py                   基础检查
│   │   ├── candidate_check.py         候选检查
│   │   ├── production_check.py        生产检查
│   │   ├── production_server.py       生产服务器入口
│   │   ├── preview_server.py          预览服务器
│   │   ├── sandbox_server.py          沙箱服务器
│   │   ├── readiness.py               就绪检查
│   │   ├── api_contract_check.py      API 契约检查
│   │   ├── parity_check.py            对等检查
│   │   ├── local_chat_smoke.py        本地聊天烟雾测试
│   │   ├── preview_local_model_smoke.py
│   │   ├── preview_smoke.py
│   │   ├── sandbox_smoke.py
│   │   ├── sandbox_init.py            沙箱初始化
│   │   ├── sandbox_reset_dry_run.py
│   │   ├── real_data_backup.py        真实数据备份
│   │   ├── real_data_migration_apply.py
│   │   ├── real_data_migration_dry_run.py
│   │   ├── real_data_preflight.py
│   │   ├── production_migration_dry_run.py
│   │   ├── rollback_rehearsal.py
│   │   ├── copy_data_shadow_report.py
│   │   ├── profile_report.py          配置文件报告
│   │   ├── profile_validate.py        配置文件验证
│   │   └── storage_report.py          存储布局报告
│   ├── config/__init__.py             配置管理
│   ├── context/                        上下文组装
│   │   ├── __init__.py
│   │   └── v2.py                      v2 上下文算法
│   ├── conversation/                   对话运行时
│   │   ├── __init__.py
│   │   └── runtime.py                 对话运行时核心
│   ├── database/                       数据库层
│   │   ├── __init__.py
│   │   ├── readonly.py                只读查询
│   │   └── writes.py                  写入操作（含安全守卫）
│   ├── diagnostics/                    诊断模块
│   │   ├── __init__.py
│   │   ├── readiness.py              就绪诊断
│   │   ├── runtime_trace.py           运行时追踪
│   │   └── safety.py                  安全检查
│   ├── memory/                         记忆系统
│   │   ├── __init__.py
│   │   └── v2.py                      v2 记忆算法
│   ├── model/                          模型适配器
│   │   ├── __init__.py
│   │   ├── ollama.py                  Ollama 本地模型适配器
│   │   └── local_chat_smoke.py        本地聊天烟雾测试
│   ├── profiles/                       配置文件
│   │   ├── __init__.py
│   │   └── readonly.py               只读配置访问
│   ├── server/                         **Web 服务器**
│   │   ├── __init__.py
│   │   ├── api.py                     FastAPI 路由
│   │   ├── static/console.css         控制台样式
│   │   ├── static/console.js          控制台 JS
│   │   └── templates/console.html     Jinja2 模板
│   └── storage/                        存储布局
│       ├── __init__.py
│       └── layout.py                  本地数据布局
└── tests/                              **测试目录** (约 704KB)
    ├── parity/
    │   └── test_foundation_parity.py   基础对等测试
    └── unit/
        ├── test_api_contract.py
        ├── test_body.py
        ├── test_candidate_validation.py
        ├── test_context_v2_algorithms.py
        ├── test_contracts.py
        ├── test_conversation_runtime.py
        ├── test_cutover_gate.py
        ├── test_database_readonly.py
        ├── test_database_writes_temp_only.py
        ├── test_fastapi_compatibility.py
        ├── test_foundation_import.py
        ├── test_memory_v2_algorithms.py
        ├── test_migration_dry_run.py
        ├── test_ollama_adapter.py
        ├── test_preview.py
        ├── test_readiness.py
        ├── test_runtime_trace.py
        ├── test_safety.py
        ├── test_sandbox.py
        ├── test_shadow_validation.py
        └── test_storage_profiles_readonly.py
```

### 2.2 `public/` — 静态运行时资源 (3.4MB)

```
public/live2d/rin/
├── cubism/rin-layered-source/          Cubism 运行时文件
│   ├── rin-layered-source.1024/       纹理目录
│   │   └── texture_00.png             纹理贴图
│   ├── rin-layered-source.moc3        模型文件
│   ├── rin-layered-source.model3.json 模型描述
│   └── rin-layered-source.cdi3.json   显示信息
├── rin-asset-model.json                资源清单
├── rin-runtime-manifest.json           运行清单
└── *.png                               13 张预览/组件图片
```

### 2.3 `live2d-development/` — Live2D 开发工作区 (33MB)

```
live2d-development/
├── 00_reference/README.md              参考文档
├── 01_source_art/                      源艺术文件
│   ├── README.md
│   ├── rin-layered-source-manifest.json
│   └── rin-layered-source.psd (5MB)    主源文件
├── 02_layered_assets/                  分层导出资源
│   ├── README.md
│   └── rin-cubism-source-layers/ (10 个 PNG 参考/引导图)
├── 03_cubism_project/                  Cubism 编辑器项目
│   ├── README.md
│   ├── rin-layered-source.cmo3 (4.3MB) 主项目文件
│   ├── smoke-flat-no-composite.cmo3
│   └── Untitled Model.cmo3             [⚠ 未命名测试项目]
├── 04_exports/                         运行时导出文件
│   ├── README.md
│   └── rin-layered-source/             (与 public/ 相同的格式)
├── 05_integration/                     集成规格
│   ├── README.md
│   └── rin-live2d-layered-mvp-spec.json
├── 06_tests/                           测试截图
│   ├── README.md
│   ├── qa-notes.md
│   ├── final-rin-live2d-*.png (11 张)  **最终版** 表情测试
│   └── rin-live2d-*.png (5 张)         **迭代版** 表情测试 [⚠ 重复/旧版]
├── docs/                               Live2D 相关文档 (5 个 MD)
├── photo/                              参考照片 (5 张, 约 12MB)
└── README.md
```

### 2.4 `.rin-data/` — 生产运行时数据 (3.0MB, git-忽略)

```
.rin-data/
├── manifest.json                       数据清单
├── config/                             活跃配置
│   ├── ai_identity.json                AI 身份
│   ├── ai_state.json                   AI 状态
│   ├── model_config.json               模型配置
│   ├── permissions.json                权限
│   ├── policy_config.json             策略配置
│   ├── tool_registry.json             工具注册
│   ├── user_model.json                 用户模型
│   ├── owner_profile.json              所有者配置
│   ├── rin_profile.json                RIN 配置
│   └── python_cutover_marker.json      **切换标记** (生产写入门控)
├── databases/
│   └── rin.sqlite                      SQLite 数据库 (含 WAL/SHM)
├── logs/
│   └── audit_log.jsonl                 审计日志
├── attachments/                        (空)
└── bundles/                             4 个时间戳状态快照
    ├── agent-state-2026-05-22T13-27-20.519Z/
    ├── agent-state-2026-05-22T13-53-00.602Z/
    ├── agent-state-2026-05-30T18-47-06.788Z/
    └── agent-state-2026-05-30T18-48-01.486Z/
    (每个含 config/, databases/, manifest.json)
```

### 2.5 `.rin-python-backups/` — 备份目录 (2.0MB, git-忽略)

```
.rin-python-backups/
├── rin-data-backup-20260606T173144Z/    备份 1 (完整 .rin-data 副本)
└── rin-data-backup-20260606T173720Z/    备份 2 (完整 .rin-data 副本, 与备份 1 基本相同)
```

---

## 三、内容重复分析

### 3.1 完全相同的文件（逐字节一致）

| 位置 A | 位置 B | 说明 |
|--------|--------|------|
| `dist/live2d/rin/` 全部文件 | `public/live2d/rin/` 全部文件 | **完全重复** — dist/ 是旧 TypeScript 构建产物，public/ 是当前运行时使用版本 |
| `.rin-data/bundles/` | `.rin-python-backups/*/bundles/` | 备份是 `.rin-data` 的完整副本（设计如此） |
| `.rin-data/bundles/` 的 4 个快照之间 | — | 每个快照的 config JSON 文件完全相同（数据库不同） |

### 3.2 内容高度重叠的 Markdown 文件

| 文件对 | 重叠度 | 重复主题 |
|--------|--------|----------|
| `AGENTS.md` ↔ `DEVELOPMENT_PROTOCOL.md` | **高 (~60%)** | 分支策略、提交策略、受保护文件清单、最终报告格式、v2 延续协议、检查命令 |
| `ARCHITECTURE.md` ↔ `README.md` | **中 (~40%)** | 启动器说明、Python-first 描述、TypeScript 回滚、Active Runtime |
| `AGENTS.md` ↔ `ARCHITECTURE.md` | **中 (~30%)** | Live2D 策略、Python 结构、TypeScript 回滚、数据安全 |
| `AGENTS.md` ↔ `PROJECT_CHARTER.md` | **低 (~15%)** | 项目名、本地优先原则、Live2D 角色 |

**具体重复内容：**
- "Protected Governance Files" 列表在 `AGENTS.md` 和 `DEVELOPMENT_PROTOCOL.md` 中几乎逐字相同
- "Stage Completion Report Format" 在 `AGENTS.md` (第185-206行) 和 `DEVELOPMENT_PROTOCOL.md` (第187-209行) 中完全相同
- "RIN v2.0 Continuation Protocol" 在 `AGENTS.md` (第160-183行) 和 `DEVELOPMENT_PROTOCOL.md` (第54-74行) 中高度重复
- 检查命令 (`pytest`, `ruff`, `mypy`, `candidate-check`, `production-check`) 在 3 个文件中都有列出
- TypeScript 回滚说明 (`typescript-final-fallback` 标签) 在 `ARCHITECTURE.md` 和 `README.md` 中重复

### 3.3 Live2D 迭代文件重复

```
live2d-development/06_tests/
├── rin-live2d-happy.png          → 旧版 (389KB)
├── rin-live2d-listening.png      → 旧版 (380KB)
├── rin-live2d-sleepy.png         → 旧版 (367KB)
├── rin-live2d-warning.png        → 旧版 (394KB)
├── rin-live2d-mobile-happy.png   → 旧版 (194KB)
├── final-rin-live2d-happy.png    → 最终版 (302KB)
├── final-rin-live2d-listening.png → 最终版 (294KB)
├── final-rin-live2d-sleepy.png   → 最终版 (282KB)
└── final-rin-live2d-warning.png  → 最终版 (304KB)
```

`rin-live2d-*.png` (5 张) 是 `final-rin-live2d-*.png` (11 张) 的旧迭代版本，名称无 `final-` 前缀。

---

## 四、可删除文件清单

### 🔴 强烈建议删除（释放约 156MB）

| 路径 | 大小 | 原因 |
|------|------|------|
| **`node_modules/`** | 152MB | 遗留 Node.js 依赖。项目已完全 Python 化，无 TypeScript/Node 运行时。`.gitignore` 已排除，不在版本控制中。 |
| **`dist/`** | 3.7MB | 旧 TypeScript/Vite 构建产物。`.gitignore` 已排除（`dist/`），不在版本控制中。当前运行时从 `python/src/rin/server/` 提供服务。 |
| **`python/.venv/`** | 152MB | Python 虚拟环境（本地重建即可：`python3.12 -m venv .venv && pip install -e ".[dev]"`）。已在 `.gitignore` 中。 |

> 注：`.venv` 和 `node_modules` 虽然通常在 `.gitignore` 中，但如果你不在此项目工作可以删除。`python/.venv` 保留以便日常运行。

### 🟡 建议删除（清理冗余）

| 路径 | 大小 | 原因 |
|------|------|------|
| **`dist/` (全部)** | 3.7MB | 旧构建输出，与 `public/` 内容重复 |
| **`scripts/python-preview/Start_RIN_Python_Preview.command`** | — | README 明确声明已移除旧启动器。此为残留。 |
| **`scripts/python-preview/Start_RIN_Python_Sandbox.command`** | — | 同上 |
| **`python/.mypy_cache/`** | ~1MB | 类型检查缓存，可重建 |
| **`python/.pytest_cache/`** | <1MB | 测试缓存，可重建 |
| **`python/.ruff_cache/`** | <1MB | Lint 缓存，可重建 |
| **`python/src/rin/__pycache__/`** | — | Python 字节码缓存，可重建 |
| **`python/tests/unit/__pycache__/`, `python/tests/parity/__pycache__/`** | — | 同上 |
| **`tests/` (顶层空目录)** | 12B | 仅含 `.gitkeep`，实际测试全在 `python/tests/` |
| **`tmp/`** | 8KB | 仅含 `.DS_Store`，已在 `.gitignore` |
| **`docs/`** | 16KB | 所有文档已被删除（git status 显示 50+ 个删除），目录只剩 `.DS_Store` |
| **`live2d-development/.DS_Store`** | 10KB | macOS 元数据 |
| **`python/.DS_Store`** | — | macOS 元数据 |
| **`scripts/.DS_Store`** | 6KB | macOS 元数据 |

### 🟠 谨慎建议（内容过时或需确认）

| 路径 | 原因 |
|------|------|
| **`python/README.md`** | 仍描述为 "Package 0 foundation / Candidate"，说 TypeScript 是生产参考，与当前状态矛盾。建议更新或删除。 |
| **`live2d-development/03_cubism_project/Untitled Model.cmo3`** | 未命名的测试项目，疑似无效 |
| **`live2d-development/06_tests/rin-live2d-*.png`** (5 张) | `final-rin-live2d-*.png` 的旧迭代版本 |
| **`.rin-python-backups/rin-data-backup-20260606T173144Z/`** | 保留最新一份备份即可，两份完全重复 |

---

## 五、文件分类汇总

### 源代码文件（需保留）

| 类别 | 数量 | 位置 |
|------|------|------|
| Python 源文件 (.py) | 46 | `python/src/rin/` |
| Python 测试文件 | 22 | `python/tests/` |
| 项目配置 | 1 | `python/pyproject.toml` |
| HTML 模板 | 1 | `python/src/rin/server/templates/` |
| CSS 静态资源 | 1 | `python/src/rin/server/static/` |
| JS 静态资源 | 1 | `python/src/rin/server/static/` |

### 治理/文档文件（需保留）

| 文件 | 行数 | 用途 |
|------|------|------|
| `PROJECT_CHARTER.md` | 624 | 项目宪章 — 最高约束 |
| `AGENTS.md` | 210 | AI 代理行为指南 |
| `DEVELOPMENT_PROTOCOL.md` | 209 | 开发流程协议 |
| `ARCHITECTURE.md` | 76 | 架构说明 |
| `README.md` | 119 | 项目入口说明 |
| `.env.example` | 37 | 环境变量模板 |
| `.gitignore` | 57 | Git 忽略规则 |

### 运行时数据（git-忽略，保留）

| 目录 | 大小 | 说明 |
|------|------|------|
| `.rin-data/` | 3.0MB | 生产数据 — 受保护 |
| `.rin-python-backups/` | 2.0MB | 备份 — 受保护 |
| `.rin-python-cutover-state/` | 16KB | 迁移状态 |
| `.rin-python-preview-data/` | 184KB | 预览数据 |

### Live2D 资源（保留）

| 位置 | 大小 | 说明 |
|------|------|------|
| `public/live2d/` | 3.4MB | 运行时资源 |
| `live2d-development/` | 33MB | 开发工作区 |

### 启动/脚本

| 文件 | 说明 |
|------|------|
| `Start_RIN.command` | 唯一的所有者启动器 |
| `scripts/.gitkeep` | 保留目录占位 |

---

## 六、关键发现与建议

### 6.1 立即行动

1. **删除 `node_modules/`** — 152MB 的遗留依赖，项目已无 Node.js 运行时
2. **删除 `dist/`** — 3.7MB 的旧构建产物，内容与 `public/` 完全重复
3. **清理缓存目录** — `.mypy_cache/`, `.pytest_cache/`, `.ruff_cache/`, `__pycache__/`（虽然小但冗余）

### 6.2 文档合并建议

`AGENTS.md` 和 `DEVELOPMENT_PROTOCOL.md` 有约 60% 的内容重叠。建议方案：
- **方案 A：** 合并为一个文件，以 `AGENTS.md` 作为 AI 代理的全面参考
- **方案 B：** 从 `DEVELOPMENT_PROTOCOL.md` 中移除在 `AGENTS.md` 中已完全覆盖的重复章节（分支策略、受保护文件、报告格式、v2 延续协议）

### 6.3 空/过时目录

- `docs/` — 50+ 个文档已被删除（git status 待提交），目录只剩 `.DS_Store`。应确认是否提交删除。
- `tests/` — 顶层只有 `.gitkeep`，所有测试在 `python/tests/`。可移除。
- `python/README.md` — 严重过时，需更新。
- `scripts/python-preview/` — README 明确声明已移除的旧启动器残留。

### 6.4 Live2D 迭代文件

`live2d-development/06_tests/` 中存在 5 个 `rin-live2d-*.png`（无 `final-` 前缀）是旧版本，建议删除只保留 `final-rin-live2d-*.png` 系列。

### 6.5 备份策略

`.rin-python-backups/` 中有 2 份完全相同的备份（时间戳相差 6 分钟），可保留最新一份。

---

## 七、文件数量统计

| 类别 | 文件数 |
|------|--------|
| Python 源文件 (.py) | 46 |
| Python 测试文件 | 22 |
| HTML/CSS/JS | 3 |
| 顶层文档 (.md) | 5 |
| Live2D 开发文件 | 47 |
| 运行时 Live2D 资源 | 15 |
| 配置文件 (.json, .toml 等) | ~50+ |
| **可安全删除的文件** (node_modules, dist, caches 等) | **~20,000** |

> 项目的"有效文件"（源码 + 文档 + 资源）约 150 个，其余 19,850+ 个是依赖包、缓存和构建产物。

---

*本分析基于 2026-06-08 的文件系统快照。`
