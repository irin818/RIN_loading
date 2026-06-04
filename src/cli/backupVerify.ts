import {
  formatEncryptedBackupVerifyReport,
  verifyEncryptedBackupArchive,
} from "../backup";

const archivePath = process.argv[2];
const passphrase = process.env.RIN_BACKUP_PASSPHRASE;

if (!archivePath) {
  console.log(missingArchiveReport());
  process.exitCode = 1;
} else if (!passphrase?.trim()) {
  console.log(missingPassphraseReport());
  process.exitCode = 1;
} else {
  const report = await verifyEncryptedBackupArchive({ archivePath, passphrase });

  console.log(formatEncryptedBackupVerifyReport(report));
  if (report.status !== "valid") {
    process.exitCode = 1;
  }
}

function missingArchiveReport(): string {
  return [
    "RIN encrypted backup verify report.",
    "Mode: encrypted-backup-verify",
    "Status: missing_archive",
    "Archive path: none",
    "Cloud sync enabled: no",
    "Secrets included: no",
    "Full text included: no",
    "Error code: MISSING_ARCHIVE",
  ].join("\n");
}

function missingPassphraseReport(): string {
  return [
    "RIN encrypted backup verify report.",
    "Mode: encrypted-backup-verify",
    "Status: missing_passphrase",
    "Cloud sync enabled: no",
    "Secrets included: no",
    "Full text included: no",
    "Error code: MISSING_PASSPHRASE",
    "Set RIN_BACKUP_PASSPHRASE in the local shell for this command.",
  ].join("\n");
}
