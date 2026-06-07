# RIN_loading 项目文件结构解析清单

> 更新日期：2026-06-08（第二次扫描，清理后）
> 分支：`main`（唯一分支）
> 工作树：clean

---

## 一、顶层目录总览

```
RIN_loading/                          (源码 + 资源约 43MB，不含 .git)
├── .claude/                           Claude Code 本地配置
├── .git/                              版本控制（不计入分析）
├── .rin-data/                         **生产运行时数据** (3.0MB, git-忽略)
├── .rin-python-backups/               **数据备份** (1.0MB, git-忽略)
├── .rin-python-cutover-state/         **迁移切换状态** (16KB, git-忽略)
├── .rin-python-preview-data/          **预览/测试数据** (176KB, git-忽略)
├── docs/                              (空目录，所有历史文档已删除并提交)
├── live2d-development/                Live2D 开发工作区 (32MB)
├── public/                            静态运行时资源 (3.4MB)
├── python/                            **主动 Python 运行时** (核心)
├── scripts/                           开发辅助脚本 (仅 .gitkeep)
├── .env.example                       环境变量模板
├── .gitignore                         Git 忽略规则
├── AGENTS.md                          AI 开发代理行为指南
├── ARCHITECTURE.md                    架构说明
├── DEVELOPMENT_PROTOCOL.md            开发流程协议
├── PROJECT_CHARTER.md                 项目宪章/最高约束
├── PROJECT_FILE_ANALYSIS.md           本文件
├── README.md                          项目说明
└── Start_RIN.command                  **唯一启动器** (可执行)
```

### 清理前后对比

| 目录/文件 | 清理前 | 清理后 |
|-----------|--------|--------|
| `node_modules/` | 152MB (遗留 Node 依赖) | **已删除** |
| `dist/` | 3.7MB (旧 TS 构建产物) | **已删除** |
| `tests/` (顶层) | 空壳 (.gitkeep) | **已删除** |
| `tmp/` | 仅 .DS_Store | **已删除** |
| `scripts/python-preview/` | 2 个旧启动器 | **已删除** |
| `.DS_Store` 文件 | 分布各处 | **全部删除** |
| `docs/` | 50+ 历史文档 | **已清空** |
| `live2d-development/06_tests/` | 16 张图片 (含旧版) | **11 张** (仅 final 版) |
| `live2d-development/03_cubism_project/` | 3 个 .cmo3 | **2 个** (移除未命名测试) |
| `.rin-python-backups/` | 2 份完全重复 | **1 份** |
| `.gitignore` | 57 行 (含 TS/Node 规则) | **39 行** |
| 本地 Git 分支 | 29 个 | **1 个** (`main`) |
| 远程 Git 分支 | 88 个 | **1 个** (`origin/main`) |
| `DEVELOPMENT_PROTOCOL.md` | 209 行 (含 TS/npm 引用) | **142 行** (Python-only) |
| `python/README.md` | 过时 (Package 0 Candidate) | **已更新** (生产运行时) |

---

## 二、各目录详细分析

### 2.1 `python/` — 主动运行时（核心源码目录）

```
python/
├── pyproject.toml                     Python 项目配置（依赖、脚本入口点、26 个 CLI 命令）
├── README.md                          当前生产运行时说明
├── .venv/                             (git-忽略) Python 虚拟环境
├── .mypy_cache/                       (git-忽略) 类型检查缓存
├── .pytest_cache/                     (git-忽略) 测试缓存
├── .ruff_cache/                       (git-忽略) Lint 缓存
├── src/rin/                           **活跃源码** (约 980KB, 46 个 .py 文件)
│   ├── __init__.py
│   ├── version.py                     版本号
│   ├── api_contract.py                API 契约定义
│   ├── contracts.py                   数据契约
│   ├── cutover.py                     切换门控逻辑
│   ├── migration_dry_run.py           迁移预演
│   ├── preview.py                     预览逻辑
│   ├── sandbox.py                     沙箱环境
│   ├── shadow.py                      影子验证
│   ├── api/__init__.py
│   ├── body/                           身体/Live2D 状态边界
│   │   ├── __init__.py
│   │   └── state.py
│   ├── cli/                            **CLI 命令集** (25 个命令)
│   │   ├── __init__.py
│   │   ├── _runner.py
│   │   ├── check.py, candidate_check.py, production_check.py
│   │   ├── production_server.py, preview_server.py, sandbox_server.py
│   │   ├── readiness.py
│   │   ├── api_contract_check.py, parity_check.py
│   │   ├── local_chat_smoke.py, preview_local_model_smoke.py
│   │   ├── preview_smoke.py, sandbox_smoke.py
│   │   ├── sandbox_init.py, sandbox_reset_dry_run.py
│   │   ├── real_data_backup.py, real_data_migration_apply.py
│   │   ├── real_data_migration_dry_run.py, real_data_preflight.py
│   │   ├── production_migration_dry_run.py, rollback_rehearsal.py
│   │   ├── copy_data_shadow_report.py
│   │   ├── profile_report.py, profile_validate.py
│   │   └── storage_report.py
│   ├── config/__init__.py
│   ├── context/                        上下文组装
│   │   ├── __init__.py
│   │   └── v2.py
│   ├── conversation/                   对话运行时
│   │   ├── __init__.py
│   │   └── runtime.py
│   ├── database/                       数据库层
│   │   ├── __init__.py
│   │   ├── readonly.py               只读查询
│   │   └── writes.py                 写入操作（含安全守卫）
│   ├── diagnostics/                    诊断模块
│   │   ├── __init__.py
│   │   ├── readiness.py
│   │   ├── runtime_trace.py
│   │   └── safety.py
│   ├── memory/                         记忆系统
│   │   ├── __init__.py
│   │   └── v2.py
│   ├── model/                          模型适配器
│   │   ├── __init__.py
│   │   ├── ollama.py                 Ollama 本地模型适配器
│   │   └── local_chat_smoke.py
│   ├── profiles/                       配置文件
│   │   ├── __init__.py
│   │   └── readonly.py
│   ├── server/                         **Web 服务器**
│   │   ├── __init__.py
│   │   ├── api.py                    FastAPI 路由
│   │   ├── static/console.css
│   │   ├── static/console.js
│   │   └── templates/console.html
│   └── storage/                        存储布局
│       ├── __init__.py
│       └── layout.py
└── tests/                              **测试目录** (约 704KB, 22 个 .py 文件)
    ├── parity/
    │   └── test_foundation_parity.py
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
│   ├── rin-layered-source.1024/
│   │   └── texture_00.png             纹理贴图
│   ├── rin-layered-source.moc3        模型文件
│   ├── rin-layered-source.model3.json 模型描述
│   └── rin-layered-source.cdi3.json   显示信息
├── rin-asset-model.json                资源清单
├── rin-runtime-manifest.json           运行时清单
└── *.png                               11 张预览/组件图片
```

### 2.3 `live2d-development/` — Live2D 开发工作区 (32MB)

```
live2d-development/
├── README.md
├── 00_reference/README.md
├── 01_source_art/                      源艺术文件
│   ├── README.md
│   ├── rin-layered-source-manifest.json
│   └── rin-layered-source.psd (5MB)   主源文件
├── 02_layered_assets/                  分层导出资源
│   ├── README.md
│   └── rin-cubism-source-layers/ (10 个 PNG)
├── 03_cubism_project/                  Cubism 编辑器项目
│   ├── README.md
│   ├── rin-layered-source.cmo3 (4.3MB)
│   └── smoke-flat-no-composite.cmo3
├── 04_exports/                         运行时导出文件
│   ├── README.md
│   └── rin-layered-source/ (4 个文件)
├── 05_integration/                     集成规格
│   ├── README.md
│   └── rin-live2d-layered-mvp-spec.json
├── 06_tests/                           表情测试截图
│   ├── README.md
│   ├── qa-notes.md
│   └── final-rin-live2d-*.png (11 张, 仅保留最终版)
├── docs/                               Live2D 相关文档 (5 个 MD)
└── photo/                              参考照片 (5 张, 约 12MB)
```

### 2.4 `.rin-data/` — 生产运行时数据 (3.0MB, git-忽略)

```
.rin-data/
├── manifest.json
├── config/
│   ├── ai_identity.json, ai_state.json
│   ├── model_config.json, permissions.json, policy_config.json
│   ├── tool_registry.json, user_model.json
│   ├── owner_profile.json, rin_profile.json
│   └── python_cutover_marker.json      **切换标记** (生产写入门控)
├── databases/
│   └── rin.sqlite (含 WAL/SHM)
├── logs/
│   └── audit_log.jsonl
├── attachments/                        (空)
└── bundles/                             4 个时间戳状态快照
```

### 2.5 `.rin-python-backups/` — 备份目录 (1.0MB, git-忽略)

```
.rin-python-backups/
└── rin-data-backup-20260606T173720Z/    唯一备份 (完整 .rin-data 副本)
```

### 2.6 其他数据目录

| 目录 | 大小 | 说明 |
|------|------|------|
| `.rin-python-cutover-state/` | 16KB | 迁移切换状态 (4 个 JSON) |
| `.rin-python-preview-data/` | 176KB | 预览/测试数据 |
| `docs/` | 0B | 空目录（所有历史文档已删除并提交） |
| `scripts/` | 4KB | 仅 `.gitkeep` 占位 |

---

## 三、重复内容分析

### 3.1 已解决的重复

| 问题 | 处理 |
|------|------|
| `dist/live2d/rin/` = `public/live2d/rin/` | ✅ `dist/` 已整体删除 |
| `DEVELOPMENT_PROTOCOL.md` 与 `AGENTS.md` 重复 4 个章节 | ✅ 已替换为交叉引用 |
| `rin-live2d-*.png` vs `final-rin-live2d-*.png` | ✅ 旧版 5 张已删除 |
| `.rin-python-backups/` 两份完全相同 | ✅ 仅保留最新一份 |

### 3.2 仍存在的轻微重叠

| 文件对 | 重叠度 | 说明 |
|--------|--------|------|
| `ARCHITECTURE.md` ↔ `README.md` | ~30% | 启动器说明、TypeScript 回滚 — 各自受众不同，保持现状合理 |
| `AGENTS.md` ↔ `ARCHITECTURE.md` | ~15% | Live2D 策略引用 — 已通过交叉引用减少 |
| `AGENTS.md` ↔ `PROJECT_CHARTER.md` | ~10% | 项目名、本地优先原则 — 宪章引用，必要 |

---

## 四、文件数量统计（清理后）

| 类别 | 文件数 |
|------|--------|
| Python 源文件 (.py) | 46 |
| Python 测试文件 | 22 |
| HTML/CSS/JS 前端 | 3 |
| Python 配置 (pyproject.toml) | 1 |
| 顶层治理文档 (.md) | 6 |
| 启动脚本 (.command) | 1 |
| 环境模板 + gitignore | 2 |
| Live2D 开发文件 | 42 |
| 运行时 Live2D 资源 | 15 |
| 运行时数据（.rin-data 等，git-忽略） | ~70 |
| Claude Code 配置 | 1 |
| **Git 跟踪的有效文件** | **约 140** |

---

## 五、Git 状态

| 项目 | 状态 |
|------|------|
| 分支 | `main`（唯一） |
| 远程 | `origin/main`（唯一） |
| 工作树 | clean |
| 同步 | 已推送，完全同步 |

---

## 六、已验证清单

### ✅ 已删除（共释放约 156MB 磁盘 + 185 个分支引用）

- `node_modules/` (152MB 旧 Node 依赖)
- `dist/` (3.7MB 旧构建产物)
- `tests/`（顶层空壳）
- `tmp/`（空目录）
- `scripts/python-preview/`（2 个旧启动器）
- 所有 `.DS_Store` 文件
- 5 张旧 Live2D 迭代测试图片
- `Untitled Model.cmo3`（未命名测试项目）
- 1 份重复备份
- 28 个本地旧分支 + 88 个远程旧分支

### ✅ 已更新

- `.gitignore` — 移除 8 条 TypeScript/Node 规则
- `DEVELOPMENT_PROTOCOL.md` — 去重 4 个章节，替换所有 `npm`/TS 引用为 Python
- `python/README.md` — 重写为当前生产运行时说明
- `PROJECT_FILE_ANALYSIS.md` — 本文件

### ✅ 无残留确认

- 零 TypeScript 文件 (`.ts` / `.tsx`)
- 零 Node.js 配置 (`package.json` / `tsconfig*` / `vite.config.*`)
- 零 `npm` 引用（治理文件中已全部替换）
- 零 `node_modules/` 或 `dist/` 目录

---

*本分析基于 2026-06-08 清理后的文件系统快照。*
