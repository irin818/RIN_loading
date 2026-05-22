# Codex Device Handoff - 2026-05-22

This document is the cross-device handoff for continuing RIN development in a
new Codex conversation on a new Mac.

本文档用于在新 Mac 的新 Codex 对话中继续 RIN 开发，避免因为旧设备的 Codex
对话记录、旧项目路径或本机未提交文件缺失而破坏已有进度。

## Current Repository State

- Repository: `https://github.com/4b9yjqpbyn-cloud/RIN_loading.git`
- GitHub visibility: private
- Previous local path on old Mac: `/Users/cyline/Documents/RIN-loading`
- The Codex app cwd may incorrectly appear as `/Users/cyline/Documents/New project 2`.
  That folder was only a cache-like folder and is not the real project.
- Current stable remote branch: `origin/main`
- `origin/main` at fetch time: `2ef2017 Merge pull request #1 from 4b9yjqpbyn-cloud/codex/live2d-cubism-pipeline`
- Historical Live2D work branch: `origin/codex/live2d-cubism-pipeline`
- Device handoff branch: `origin/codex/device-handoff`

Important: use the actual repo directory on the new Mac. Do not hard-code the
old path. In commands and code review, treat the current working directory as
the project root after confirming it contains `package.json` and `.git`.

## Local-Only Files Captured For Handoff

Before this handoff, the old Mac had project files that were not present on
GitHub. They have been intentionally captured on the `codex/device-handoff`
branch so the new Mac can recover them by fetching that branch.

- `live2d-development/03_cubism_project/rin-layered-source.cmo3`
  - Existing tracked Cubism project file, locally modified after the last
    pushed Live2D commit.
  - SHA-256 on old Mac: `87ab0356fbce8b69a0d8415d0863f48a676c9d93d7c3c43dfd2090e5c77585ed`
- `live2d-development/03_cubism_project/Untitled Model.cmo3`
  - Local Cubism project artifact.
  - SHA-256 on old Mac: `a07c8a330dccb9fc10faf2a07f84d559e9425b65675a6fa52cc06396f282cf21`
- `live2d-development/03_cubism_project/smoke-flat-no-composite.cmo3`
  - Local Cubism smoke-test project artifact from the PSD/Cubism import checks.
  - SHA-256 on old Mac: `686e2fb9c1b425a3c994e63e4d1476aa88166c03e6b096132fe58e1ec351bb8b`
- `打开RIN项目.command`
  - Relative-path macOS helper script for starting the local RIN console.
  - SHA-256 on old Mac: `407cadcee9f4f045e074efbc3ebbd7819593973f30b10eb50aef05cc2782de39`

Do not copy or commit old-machine private state such as `.rin-data/`,
`node_modules/`, `dist/`, `~/.codex/auth.json`, Codex logs, API keys, tokens, or
local databases. If the owner explicitly wants real local RIN state migration,
handle that as a separate secure export/import task, not through Git.

## Conversation And Development Summary

The old Codex conversations established these project facts:

- RIN is a single-owner, local-first, long-running, embodied personal agent
  system. It is not a generic chatbot, not a SaaS product, and not a simple
  ChatGPT API wrapper.
- `PROJECT_CHARTER.md` is the highest project constraint. Read it before
  architecture, memory, identity, policy, storage, synchronization, tools,
  model-provider, or Live2D work.
- Human-readable project documents should remain bilingual where practical.
- Slow variables control fast variables. Memory, identity, user model, AI state,
  policy, permissions, and audit history must remain locally governed.
- External model output is advice, not authority. Model output must not directly
  write long-term memory or execute tools.
- Tools must go through the permission gateway.
- Live2D/body state is a visual interface layer, not RIN identity.

Implemented project phases and milestones:

- Phase 0-1: project charter, technical direction, React + Vite + TypeScript
  project skeleton.
- Phase 2: controlled `.rin-data` directory layout and `manifest.json`.
- Phase 3: SQLite foundation with schema migration and audit events.
- Phase 4: provider-neutral model abstraction with local mock adapter only.
- Phase 5: basic local conversation path through runtime, writing raw messages
  to SQLite and not calling external models.
- Phase 6: raw runtime event logging.
- Phase 7: memory proposal MVP only; no automatic accepted long-term writes.
- Phase 8: slow-variable snapshot history.
- Phase 9: local policy runtime.
- Phase 10: local AI state engine.
- Phase 11: manual Agent State Bundle export.
- Phase 12-13: tool registry and permission-gated built-in L0 low-risk tools.
- Phase 14-15: body adapter protocol and original chibi SVG body rig.
- Phase 16: local-only `/body` shell with dragging, click reactions, and
  temporary bilingual bubble layer. These are UI fast variables only.
- GitHub bootstrap: private repo `4b9yjqpbyn-cloud/RIN_loading` created and
  `main` pushed.
- Live2D/Cubism pipeline:
  - Created `live2d-development/` workspace.
  - Used design/reference images under `live2d-development/photo/`.
  - Researched Live2D/Cubism tooling and documented it.
  - Added reproducible runtime PNG asset generation.
  - Added `rin-asset-model.json`, `rin-runtime-manifest.json`, and verification
    scripts.
  - Generated a Cubism handoff PSD from current assets.
  - Installed and used Live2D Cubism Editor 5.3.02 on macOS Apple Silicon.
  - Diagnosed Cubism PSD import failure caused by unsupported PSD compression
    `Zip(Without Prediction)`.
  - Updated PSD generation to Cubism-compatible RGB / 8-bit / non-zip output.
  - Imported the PSD into Cubism, saved a baseline `.cmo3`, generated a single
    texture atlas, and exported baseline `.moc3`, `.model3.json`, `.cdi3.json`,
    and texture.
  - Mirrored the export into `public/live2d/rin/cubism/`.
  - Verified `/body?expression=listening` can render the current high-fidelity
    asset-layered RIN body and that Cubism export files are served over HTTP.
  - PR #1 was merged into `main` as `2ef2017`.

Current body status:

- The integrated app currently uses a high-fidelity asset-layered PNG rig through
  the body adapter boundary, plus a baseline official Cubism export.
- The baseline `.moc3` export is static/composite-layer quality. It is not the
  final fully rigged production Live2D model.
- Real Cubism SDK rendering in the React app is not implemented yet.
- Future real Cubism loading must be added through a small Live2D/body adapter
  boundary without making Live2D identity, memory, or reasoning source.

## Prompt To Send In New Mac Codex

Copy the following instruction into the new Mac Codex conversation after opening
the local `RIN_loading` repository folder.

```text
你现在接手 RIN_loading 项目的连续开发。请先把本消息当作交接指令，但不要把它当成项目治理文件本身；项目治理以仓库里的 AGENTS.md、PROJECT_CHARTER.md、ARCHITECTURE.md、DEVELOPMENT_PROTOCOL.md、README.md 为准。

项目背景：
- RIN 是单一所有者、本地优先、长期运行、具身化的个人智能体系统。
- RIN 不是普通聊天机器人，不是 SaaS，不是 ChatGPT API 套壳，也不是只有 Live2D 的桌面宠物。
- RIN 的身份、记忆、用户模型、AI 状态、策略、权限、审计和连续性必须保存在本地慢变量中。
- 外部模型只是可替换推理引擎；模型输出不得直接写长期记忆，也不得直接执行工具。
- 工具必须经过本地权限网关。
- Live2D/身体层是视觉接口，不是 RIN 身份。

你必须先做项目接管检查：
1. 确认当前工作目录就是新 Mac 上的 RIN_loading 仓库，目录内应有 package.json、.git、PROJECT_CHARTER.md。
2. 不要依赖旧路径 /Users/cyline/Documents/RIN-loading；旧路径只用于理解历史。新 Mac 的当前仓库路径才是准。
3. 执行并报告：
   - pwd
   - git status --short --branch
   - git remote -v
   - git branch --show-current
   - git log --oneline --decorate -5
4. 先读取并遵守：
   - AGENTS.md
   - PROJECT_CHARTER.md
   - ARCHITECTURE.md
   - DEVELOPMENT_PROTOCOL.md
   - README.md
   - docs/development/CODEX_DEVICE_HANDOFF_2026-05-22.md
5. 执行 git fetch --all --prune。
6. 如果要恢复旧设备完整交接状态，请切到 origin/codex/device-handoff：
   - git switch codex/device-handoff || git switch -c codex/device-handoff origin/codex/device-handoff
   如果只想从已合并的稳定状态继续，请切到 main 并拉取：
   - git switch main
   - git pull --ff-only
   但注意：main 可能不包含旧设备本地未提交的 Cubism/command 文件；device-handoff 分支包含这些本地缺失文件。

当前 GitHub 状态：
- 远端仓库：https://github.com/4b9yjqpbyn-cloud/RIN_loading.git
- origin/main 已包含 PR #1 的 Live2D/Cubism pipeline，merge commit 是 2ef2017。
- origin/codex/live2d-cubism-pipeline 是历史开发分支，最后关键提交是 5469aa9 Add baseline Cubism export for RIN Live2D。
- origin/codex/device-handoff 是设备迁移分支，包含旧设备上 GitHub main 没有的本地文件和本交接文档。

旧设备上原本可能会丢失、现在应通过 device-handoff 分支恢复的文件：
- live2d-development/03_cubism_project/rin-layered-source.cmo3，本地修改版，SHA-256: 87ab0356fbce8b69a0d8415d0863f48a676c9d93d7c3c43dfd2090e5c77585ed
- live2d-development/03_cubism_project/Untitled Model.cmo3，SHA-256: a07c8a330dccb9fc10faf2a07f84d559e9425b65675a6fa52cc06396f282cf21
- live2d-development/03_cubism_project/smoke-flat-no-composite.cmo3，SHA-256: 686e2fb9c1b425a3c994e63e4d1476aa88166c03e6b096132fe58e1ec351bb8b
- 打开RIN项目.command，SHA-256: 407cadcee9f4f045e074efbc3ebbd7819593973f30b10eb50aef05cc2782de39

不要提交或复制这些旧设备私有/生成内容：
- .rin-data/
- node_modules/
- dist/
- .env 或 .env.*
- API key、token、credential、private key、certificate
- Codex 的 auth.json、logs sqlite、旧对话数据库
- 本地数据库和日志

如果新 Mac 需要本地运行：
1. 确认 Node.js >= 22。
2. 运行 npm install。
3. 运行 npm run rin:init 来重新创建新设备本地 .rin-data。不要从 Git 恢复旧 .rin-data，除非用户明确要求做安全迁移。
4. 常用检查：
   - npm run typecheck
   - npm test
   - npm run lint
   - npm run build
   - npm run live2d:verify-runtime
   - npm run live2d:verify-source-psd
5. 本地开发：
   - npm run dev
   - /body 预览通常在 http://127.0.0.1:5173/body
6. 本地 Console：
   - npm run rin:console
   - Console 通常在 http://127.0.0.1:4173
   - Body 通常在 http://127.0.0.1:4173/body

当前系统已完成：
- Phase 0-16 的本地 MVP 基础，包括项目宪章、双语文档、数据目录、SQLite、模型抽象、基础 runtime、raw log、memory proposal、state、policy、Agent State Bundle、L0 工具、body adapter、chibi SVG body shell、/body 拖拽/点击/气泡交互。
- Live2D/Cubism pipeline 已完成到：高保真分层 PNG runtime、asset model descriptor、source PSD handoff、baseline .cmo3、baseline .moc3/.model3.json export、public mirror、runtime verification、浏览器 QA 截图。

当前仍未完成：
- 外部模型 API 调用。
- 真实 API Key 管理。
- 未经审查接受长期记忆。
- 中/高风险工具自动执行。
- 加密同步。
- 多设备 RIN 状态迁移。
- 原生透明桌面窗口。
- 真实 Cubism SDK/Web runtime 渲染集成。
- 最终生产级 Live2D rig：ArtMesh、deformer、blink、eye gaze、mouth parameters、ears/hair/tail physics、expression files、motion files。

如果用户要求继续 Live2D，下一步应该优先：
1. 读取 docs/live2d/CUBISM_TOOLCHAIN_CHECK.md、docs/live2d/RIN_ASSET_RUNTIME.md、live2d-development/docs/production-checklist.md。
2. 检查 live2d-development/03_cubism_project/ 下当前 .cmo3 文件状态。
3. 判断 device-handoff 分支里的 Untitled Model.cmo3 和 smoke-flat-no-composite.cmo3 是否只是烟测/临时工程，避免盲目合并进 main。
4. 在新分支上继续，不要直接改 main。
5. 继续 Cubism 正式建模：清理/拆分 PSD 或 Cubism parts，建立 ArtMesh/deformer，绑定标准参数，添加 physics、expressions、motions，导出到 live2d-development/04_exports/rin-layered-source/。
6. 之后再实现真实 Cubism Web runtime loader，优先保持 adapter 边界小，并保留当前 asset-layered fallback。

工作方式要求：
- 先检查，后修改。
- 遇到 dirty worktree 时不要 reset，不要 checkout 丢弃用户改动。
- 不要把 .rin-data、本地 DB、日志、secret、node_modules、dist 提交进 Git。
- 对实质改动：创建 codex/<task-name> 分支，做最小 coherent change，跑相关检查，commit，push，必要时创建 PR。
- 最终报告必须包含 Summary、Changed Files、Tests / Checks、Git / GitHub、Risks、Next Step。

现在请先完成接管检查并告诉我：
1. 当前仓库路径和分支；
2. 是否已成功获取 origin/codex/device-handoff；
3. 当前工作区是否干净；
4. 新 Mac 上缺少什么依赖或工具；
5. 你建议从 main 继续还是从 codex/device-handoff 继续，以及理由。
```

## Recommended Next Action On New Mac

For maximum continuity, start from `codex/device-handoff`, inspect the captured
local Cubism artifacts, and then create a new task branch from the correct base
depending on the next goal.

Recommended command sequence:

```sh
cd "<new Mac path>/RIN_loading"
git fetch --all --prune
git switch codex/device-handoff || git switch -c codex/device-handoff origin/codex/device-handoff
git status --short --branch
npm install
npm run rin:init
npm run live2d:verify-runtime
npm run test
npm run lint
npm run build
```

If the next work is pure documentation or review, the full build may be
optional, but the new Codex agent should still report any skipped checks.
