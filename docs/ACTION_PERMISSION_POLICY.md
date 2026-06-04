# Action Permission Policy

Status: v0.2-B policy lock.

RIN actions must be explicit, audited, and permission-gated. Package 3 added a
local permission model and dry-run action registry scaffold. v0.2-B adds a very
small real local action envelope for low-risk project/file workflows only.

## Permission Levels

- `read-only`: observe or report only.
- `draft-only`: produce a proposed change without applying it.
- `confirm-before-action`: requires owner confirmation before any real effect.
- `autonomous-within-scope`: allowed only for narrow, previously approved,
  reversible local scopes.
- `forbidden`: never execute automatically.

## Default Policy

- Unknown actions are forbidden.
- Destructive, financial, credential, remote, filesystem mutation, and network
  actions are forbidden by default.
- Package 3 registry entries are dry-run only.
- v0.2-B real local actions must pass a permission decision before execution.
- v0.2-B real local actions are limited to read-only project inspection,
  safe-file listing, safe package/docs metadata reads, and draft note/report
  creation in an explicit safe output directory.
- Draft writes must not overwrite existing files and may only create `.md` or
  `.txt` files under allowed safe output directories.
- Safe file listing and reads must exclude secrets, `.env*`, databases, logs,
  dependency folders, build outputs, temporary folders, and local RIN data.
- Dry-run output may include action IDs, risk levels, permission decisions, and
  safe reason codes only.

## Audit Envelope

Action audit records should be safe and structured:

- action ID and kind
- requested permission level
- granted permission level
- decision: `allowed`, `requires_confirmation`, or `blocked`
- dry-run status
- safe reason codes
- timestamp
- safe relative output paths for created draft files

Do not include secrets, full file contents, private paths, raw prompts, or tool
outputs containing private data.

## Commands

```sh
npm run rin:actions-smoke
npm run rin:actions-audit-report
```

`rin:actions-smoke` uses temporary local fixture data and verifies allowed
low-risk actions, forbidden actions, and audit creation. `rin:actions-audit-report`
reads local action audit counts only and prints no payload contents.

## Chinese Summary

v0.2-B 只开放小范围真实本地动作：读取项目状态、列出安全文件、读取 package/docs
元数据，以及在明确的安全输出目录中创建 `.md`/`.txt` 草稿报告或笔记。未知动作、删除、
外部网络、账号动作、越界路径、secret 路径、覆盖已有文件都会被拒绝。所有动作都必须先经过
permission decision，并写入只包含安全摘要的 audit event。
