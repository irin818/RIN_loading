# Backup And Migration Policy

Status: v0.2-A policy lock.

Backup and migration are continuity slow variables. They must be local-first,
explicit, dry-run capable, and conservative about overwrite risk.

## Allowed Behavior

- Report what a local backup would include before creating or copying anything.
- Include a manifest schema version, source storage schema version, safe relative
  file names, sizes, and hashes.
- Create a local encrypted backup archive only when an explicit local
  passphrase is supplied.
- Verify encrypted archives before restore by decrypting them locally and
  checking file hashes.
- Validate a local backup manifest in restore dry-run mode.
- Run encrypted restore dry-run before apply and report target conflicts.
- Apply encrypted restore only into non-conflicting target files and only after
  the explicit confirmation token is supplied.
- Rewrite the restored `manifest.json` directory paths for the target device
  layout instead of preserving old absolute paths.
- Print rollback guidance and created-file lists after restore apply.
- Exclude dependency folders, build outputs, temporary files, logs, secrets, and
  environment files.

## Forbidden Behavior

- No default cloud sync.
- No remote export.
- No plaintext archive export.
- No automatic overwrite.
- No destructive import.
- No restore apply without explicit confirmation.
- No silent restore mutation.
- No inclusion of `node_modules`, `dist`, `.env`, `.env.*`, caches, temporary
  directories, or local logs.

## Commands

Dry-run commands remain safe defaults:

```sh
npm run rin:backup-dry-run
npm run rin:restore-dry-run
```

Encrypted archive commands require a local shell passphrase. Do not commit or
print this value:

```sh
RIN_BACKUP_PASSPHRASE="local passphrase" npm run rin:backup-create -- /tmp/rin.rinbackup
RIN_BACKUP_PASSPHRASE="local passphrase" npm run rin:backup-verify -- /tmp/rin.rinbackup
RIN_BACKUP_PASSPHRASE="local passphrase" npm run rin:restore-dry-run -- /tmp/rin.rinbackup
RIN_BACKUP_PASSPHRASE="local passphrase" npm run rin:restore-apply -- /tmp/rin.rinbackup RIN_RESTORE_APPLY_EMPTY_TARGET
```

The apply command refuses missing confirmation, invalid archives, and any target
file conflict. It writes no cloud data and performs no automatic overwrite.

## Chinese Summary

备份与迁移仍然遵守本地优先、显式操作和保守恢复原则。dry-run 命令不会创建归档、
不会变更数据。加密备份命令只有在本地 shell 提供 `RIN_BACKUP_PASSPHRASE` 时才会
创建 `.rinbackup` 文件；恢复前必须先做 dry-run，apply 必须提供
`RIN_RESTORE_APPLY_EMPTY_TARGET` 确认 token，并且遇到任何目标文件冲突都会拒绝写入。
恢复时会把 `manifest.json` 中的目录路径改写为当前目标设备 layout，避免把旧设备的绝对路径
带到新设备。

Real bundle export/import remains separate and explicit.
