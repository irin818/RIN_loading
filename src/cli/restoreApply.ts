import { applyEncryptedRestore, formatEncryptedRestoreApplyReport } from "../backup";
import { loadEnvironment } from "../config/loadEnvironment";
import { createDataLayout } from "../storage";

const archivePath = process.argv[2];
const confirmationToken = process.argv[3];
const passphrase = process.env.RIN_BACKUP_PASSPHRASE;
const environment = loadEnvironment();
const targetLayout = createDataLayout(environment.dataDir);

if (!passphrase?.trim()) {
  console.log(missingPassphraseReport());
  process.exitCode = 1;
} else {
  try {
    const report = await applyEncryptedRestore({
      archivePath,
      passphrase,
      targetLayout,
      confirmationToken,
      targetDeviceId: environment.deviceId,
    });

    console.log(formatEncryptedRestoreApplyReport(report));
    if (report.status !== "applied") {
      process.exitCode = 1;
    }
  } catch {
    console.log(commandFailureReport());
    process.exitCode = 1;
  }
}

function missingPassphraseReport(): string {
  return [
    "RIN encrypted restore apply report.",
    "Mode: encrypted-restore-apply",
    "Status: missing_passphrase",
    "Cloud sync enabled: no",
    "Data mutated: no",
    "Secrets included: no",
    "Full text included: no",
    "Error code: MISSING_PASSPHRASE",
    "Set RIN_BACKUP_PASSPHRASE in the local shell for this command.",
  ].join("\n");
}

function commandFailureReport(): string {
  return [
    "RIN encrypted restore apply report.",
    "Mode: encrypted-restore-apply",
    "Status: failed",
    "Cloud sync enabled: no",
    "Data mutated: unknown",
    "Secrets included: no",
    "Full text included: no",
    "Error code: RESTORE_APPLY_FAILED",
    "Review the target directory before retrying.",
  ].join("\n");
}
