import {
  formatEncryptedRestoreDryRunReport,
  formatRestoreDryRunReport,
  planEncryptedRestore,
  validateRestoreDryRun,
} from "../backup";
import { loadEnvironment } from "../config/loadEnvironment";
import { createDataLayout } from "../storage";

const manifestPath = process.argv[2];
const environment = loadEnvironment();
const targetLayout = createDataLayout(environment.dataDir);

if (manifestPath && !manifestPath.endsWith(".json")) {
  const passphrase = process.env.RIN_BACKUP_PASSPHRASE;

  if (!passphrase?.trim()) {
    console.log(missingPassphraseReport());
    process.exitCode = 1;
  } else {
    const report = await planEncryptedRestore({
      archivePath: manifestPath,
      passphrase,
      targetLayout,
    });

    console.log(formatEncryptedRestoreDryRunReport(report));
    if (report.status === "invalid_archive") {
      process.exitCode = 1;
    }
  }
} else {
  const report = await validateRestoreDryRun({ manifestPath, targetLayout });

  console.log(formatRestoreDryRunReport(report));
}

function missingPassphraseReport(): string {
  return [
    "RIN encrypted restore dry-run report.",
    "Mode: encrypted-restore-dry-run",
    "Status: missing_passphrase",
    "Cloud sync enabled: no",
    "Data mutated: no",
    "Secrets included: no",
    "Full text included: no",
    "Error code: MISSING_PASSPHRASE",
    "Set RIN_BACKUP_PASSPHRASE in the local shell for this command.",
  ].join("\n");
}
