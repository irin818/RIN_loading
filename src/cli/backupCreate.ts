import { join } from "node:path";
import {
  createEncryptedBackupArchive,
  formatEncryptedBackupCreateReport,
} from "../backup";
import { loadEnvironment } from "../config/loadEnvironment";
import { initializeRinStorage } from "../storage";

const passphrase = process.env.RIN_BACKUP_PASSPHRASE;

if (!passphrase?.trim()) {
  console.log(missingPassphraseReport("encrypted-backup-create"));
  process.exitCode = 1;
} else {
  try {
    const now = new Date();
    const storage = await initializeRinStorage(loadEnvironment());
    const archivePath =
      process.argv[2] ??
      join(
        storage.layout.directories.bundles,
        `rin-backup-${now.toISOString().replaceAll(":", "-")}.rinbackup`,
      );
    const report = await createEncryptedBackupArchive({
      layout: storage.layout,
      archivePath,
      passphrase,
      now,
    });

    console.log(formatEncryptedBackupCreateReport(report));
  } catch {
    console.log(commandFailureReport("encrypted-backup-create"));
    process.exitCode = 1;
  }
}

function missingPassphraseReport(mode: string): string {
  return [
    "RIN encrypted backup command report.",
    `Mode: ${mode}`,
    "Status: missing_passphrase",
    "Archive created: no",
    "Cloud sync enabled: no",
    "Secrets included: no",
    "Full text included: no",
    "Error code: MISSING_PASSPHRASE",
    "Set RIN_BACKUP_PASSPHRASE in the local shell for this command.",
  ].join("\n");
}

function commandFailureReport(mode: string): string {
  return [
    "RIN encrypted backup command report.",
    `Mode: ${mode}`,
    "Status: failed",
    "Archive created: no",
    "Cloud sync enabled: no",
    "Secrets included: no",
    "Full text included: no",
    "Error code: BACKUP_CREATE_FAILED",
  ].join("\n");
}
