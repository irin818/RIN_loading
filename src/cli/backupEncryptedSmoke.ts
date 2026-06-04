import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyEncryptedRestore,
  createEncryptedBackupArchive,
  planEncryptedRestore,
  RESTORE_APPLY_CONFIRMATION_TOKEN,
  verifyEncryptedBackupArchive,
} from "../backup";
import { defaultEnvironment } from "../config/environment";
import { createDataLayout, initializeRinStorage } from "../storage";

type EncryptedBackupSmokeReport = {
  mode: "encrypted-backup-smoke";
  status: "ready" | "failed";
  archiveCreated: boolean;
  verifyStatus: string;
  dryRunStatus: string;
  unconfirmedApplyStatus: string;
  confirmedApplyStatus: string;
  conflictDryRunStatus: string;
  manifestRewrittenForTarget: boolean;
  secretFixtureExcluded: boolean;
  cloudSyncEnabled: false;
  fullTextIncluded: false;
  errorCode: string | null;
};

const passphrase = "fixture-passphrase-not-secret";
const root = await mkdtemp(join(tmpdir(), "rin-v0-2-backup-smoke-"));

try {
  const sourceRoot = join(root, "source");
  const targetRoot = join(root, "target");
  const archivePath = join(root, "backup.rinbackup");
  const source = await initializeRinStorage(defaultEnvironment, { cwd: sourceRoot });
  const targetLayout = createDataLayout(".rin-restored-data", targetRoot);

  await writeFile(join(source.layout.rootDir, ".env.local"), "SECRET=value", "utf8");
  await writeFile(
    join(source.layout.directories.logs, "private.log"),
    "secret log",
    "utf8",
  );

  const createReport = await createEncryptedBackupArchive({
    layout: source.layout,
    archivePath,
    passphrase,
    now: new Date("2026-01-01T00:00:00.000Z"),
  });
  const archiveText = await readFile(archivePath, "utf8");
  const verifyReport = await verifyEncryptedBackupArchive({ archivePath, passphrase });
  const dryRun = await planEncryptedRestore({
    archivePath,
    passphrase,
    targetLayout,
  });
  const unconfirmedApply = await applyEncryptedRestore({
    archivePath,
    passphrase,
    targetLayout,
  });
  const confirmedApply = await applyEncryptedRestore({
    archivePath,
    passphrase,
    targetLayout,
    confirmationToken: RESTORE_APPLY_CONFIRMATION_TOKEN,
    targetDeviceId: "v0-2-smoke-target",
    now: new Date("2026-01-02T00:00:00.000Z"),
  });
  const conflictDryRun = await planEncryptedRestore({
    archivePath,
    passphrase,
    targetLayout,
  });
  const secretFixtureExcluded =
    !archiveText.includes("SECRET=value") &&
    !archiveText.includes("secret log") &&
    !archiveText.includes(source.layout.rootDir);

  await expectFileMissing(join(targetLayout.rootDir, ".env.local"));

  const status =
    createReport.status === "created" &&
    verifyReport.status === "valid" &&
    dryRun.status === "valid" &&
    unconfirmedApply.status === "confirmation_required" &&
    confirmedApply.status === "applied" &&
    conflictDryRun.status === "conflict" &&
    confirmedApply.manifestRewrittenForTarget &&
    secretFixtureExcluded
      ? "ready"
      : "failed";

  const report: EncryptedBackupSmokeReport = {
    mode: "encrypted-backup-smoke",
    status,
    archiveCreated: createReport.archiveCreated,
    verifyStatus: verifyReport.status,
    dryRunStatus: dryRun.status,
    unconfirmedApplyStatus: unconfirmedApply.status,
    confirmedApplyStatus: confirmedApply.status,
    conflictDryRunStatus: conflictDryRun.status,
    manifestRewrittenForTarget: confirmedApply.manifestRewrittenForTarget,
    secretFixtureExcluded,
    cloudSyncEnabled: false,
    fullTextIncluded: false,
    errorCode: status === "ready" ? null : "ENCRYPTED_BACKUP_SMOKE_FAILED",
  };

  console.log(formatEncryptedBackupSmokeReport(report));
  if (report.status !== "ready") {
    process.exitCode = 1;
  }
} catch {
  console.log(
    formatEncryptedBackupSmokeReport({
      mode: "encrypted-backup-smoke",
      status: "failed",
      archiveCreated: false,
      verifyStatus: "unknown",
      dryRunStatus: "unknown",
      unconfirmedApplyStatus: "unknown",
      confirmedApplyStatus: "unknown",
      conflictDryRunStatus: "unknown",
      manifestRewrittenForTarget: false,
      secretFixtureExcluded: false,
      cloudSyncEnabled: false,
      fullTextIncluded: false,
      errorCode: "ENCRYPTED_BACKUP_SMOKE_FAILED",
    }),
  );
  process.exitCode = 1;
} finally {
  await rm(root, { recursive: true, force: true });
}

function formatEncryptedBackupSmokeReport(
  report: EncryptedBackupSmokeReport,
): string {
  return [
    "RIN encrypted backup smoke report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Archive created: ${report.archiveCreated ? "yes" : "no"}`,
    `Verify status: ${report.verifyStatus}`,
    `Dry-run status: ${report.dryRunStatus}`,
    `Unconfirmed apply status: ${report.unconfirmedApplyStatus}`,
    `Confirmed apply status: ${report.confirmedApplyStatus}`,
    `Conflict dry-run status: ${report.conflictDryRunStatus}`,
    `Manifest rewritten for target: ${
      report.manifestRewrittenForTarget ? "yes" : "no"
    }`,
    `Secret fixture excluded: ${report.secretFixtureExcluded ? "yes" : "no"}`,
    `Cloud sync enabled: ${report.cloudSyncEnabled ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    `Error code: ${report.errorCode ?? "none"}`,
  ].join("\n");
}

async function expectFileMissing(path: string): Promise<void> {
  try {
    await stat(path);
    throw new Error("Expected file to be missing.");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}
