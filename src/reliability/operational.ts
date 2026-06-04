import { stat, readFile } from "node:fs/promises";
import {
  buildBackupDryRunManifest,
  validateRestoreDryRun,
  type RestoreDryRunReport,
} from "../backup";
import {
  loadEnvironment,
  loadEnvironmentSource,
  type EnvironmentSource,
} from "../config/loadEnvironment";
import { databasePathFor, inspectRinDatabase, RIN_DATABASE_TABLES } from "../database";
import { readRinReadiness } from "../readiness";
import {
  createDataLayout,
  parseRinDataManifest,
  type RinDataLayout,
} from "../storage";

export type ReliabilityStatus = "ready" | "degraded";

export type IntegrityCheckReport = {
  mode: "integrity-check";
  status: ReliabilityStatus;
  manifestPresent: boolean;
  manifestValid: boolean;
  databasePresent: boolean;
  databaseInspectable: boolean;
  missingTables: string[];
  schemaVersion: number | null;
  automaticRepairApplied: false;
  dataMutated: false;
  providerCallCount: 0;
  fullTextIncluded: false;
  errorCode: string | null;
};

export type RecoverySmokeReport = {
  mode: "recovery-smoke";
  status: ReliabilityStatus;
  backupDryRunStatus: "ready" | "degraded";
  restoreDryRunStatus: RestoreDryRunReport["status"];
  restoreWouldOverwrite: boolean;
  automaticRepairApplied: false;
  dataMutated: false;
  destructiveActionAttempted: false;
  providerCallCount: 0;
  fullTextIncluded: false;
  errorCode: string | null;
};

export type OpsHealthReport = {
  mode: "ops-health-report";
  status: ReliabilityStatus;
  readinessOk: boolean;
  integrityStatus: ReliabilityStatus;
  recoveryStatus: ReliabilityStatus;
  hiddenErrorsSuppressed: false;
  automaticRepairApplied: false;
  dataMutated: false;
  providerCallCount: 0;
  fullTextIncluded: false;
};

export async function buildIntegrityCheckReport(
  layout: RinDataLayout = createDefaultLayout(),
): Promise<IntegrityCheckReport> {
  const manifestPresent = await fileExists(layout.manifestPath);
  const manifestValid = manifestPresent
    ? await readManifestValidity(layout.manifestPath)
    : false;
  const databasePresent = await fileExists(databasePathFor(layout));
  const databaseStatus = databasePresent ? readDatabaseIntegrity(layout) : null;
  const missingTables = databaseStatus
    ? databaseStatus.missingTables
    : [...RIN_DATABASE_TABLES];
  const databaseInspectable = databaseStatus?.inspectable ?? false;
  const schemaVersion = databaseStatus?.schemaVersion ?? null;
  const errorCode = readIntegrityErrorCode({
    manifestPresent,
    manifestValid,
    databasePresent,
    databaseInspectable,
    missingTables,
  });

  return {
    mode: "integrity-check",
    status: errorCode ? "degraded" : "ready",
    manifestPresent,
    manifestValid,
    databasePresent,
    databaseInspectable,
    missingTables,
    schemaVersion,
    automaticRepairApplied: false,
    dataMutated: false,
    providerCallCount: 0,
    fullTextIncluded: false,
    errorCode,
  };
}

export async function buildRecoverySmokeReport(
  layout: RinDataLayout = createDefaultLayout(),
): Promise<RecoverySmokeReport> {
  const backupStatus = await readBackupDryRunStatus(layout);
  const restoreReport = await validateRestoreDryRun({});
  const errorCode =
    backupStatus === "ready" && restoreReport.dataMutated === false
      ? null
      : "RECOVERY_SMOKE_DEGRADED";

  return {
    mode: "recovery-smoke",
    status: errorCode ? "degraded" : "ready",
    backupDryRunStatus: backupStatus,
    restoreDryRunStatus: restoreReport.status,
    restoreWouldOverwrite: restoreReport.overwriteWouldOccur,
    automaticRepairApplied: false,
    dataMutated: false,
    destructiveActionAttempted: false,
    providerCallCount: 0,
    fullTextIncluded: false,
    errorCode,
  };
}

export async function buildOpsHealthReport(
  cwd: string = process.cwd(),
  source: EnvironmentSource = loadEnvironmentSource(cwd),
): Promise<OpsHealthReport> {
  const layout = createDataLayout(loadEnvironment(source).dataDir, cwd);
  const [readiness, integrity, recovery] = await Promise.all([
    readRinReadiness(cwd, source),
    buildIntegrityCheckReport(layout),
    buildRecoverySmokeReport(layout),
  ]);
  const status =
    readiness.ok && integrity.status === "ready" && recovery.status === "ready"
      ? "ready"
      : "degraded";

  return {
    mode: "ops-health-report",
    status,
    readinessOk: readiness.ok,
    integrityStatus: integrity.status,
    recoveryStatus: recovery.status,
    hiddenErrorsSuppressed: false,
    automaticRepairApplied: false,
    dataMutated: false,
    providerCallCount: 0,
    fullTextIncluded: false,
  };
}

export function formatIntegrityCheckReport(report: IntegrityCheckReport): string {
  return [
    "RIN integrity check report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Manifest present: ${report.manifestPresent ? "yes" : "no"}`,
    `Manifest valid: ${report.manifestValid ? "yes" : "no"}`,
    `Database present: ${report.databasePresent ? "yes" : "no"}`,
    `Database inspectable: ${report.databaseInspectable ? "yes" : "no"}`,
    `Schema version: ${report.schemaVersion ?? "none"}`,
    `Missing tables: ${report.missingTables.length}`,
    `Automatic repair applied: ${report.automaticRepairApplied ? "yes" : "no"}`,
    `Data mutated: ${report.dataMutated ? "yes" : "no"}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    `Error code: ${report.errorCode ?? "none"}`,
  ].join("\n");
}

export function formatRecoverySmokeReport(report: RecoverySmokeReport): string {
  return [
    "RIN recovery smoke report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Backup dry-run status: ${report.backupDryRunStatus}`,
    `Restore dry-run status: ${report.restoreDryRunStatus}`,
    `Restore would overwrite: ${report.restoreWouldOverwrite ? "yes" : "no"}`,
    `Automatic repair applied: ${report.automaticRepairApplied ? "yes" : "no"}`,
    `Data mutated: ${report.dataMutated ? "yes" : "no"}`,
    `Destructive action attempted: ${report.destructiveActionAttempted ? "yes" : "no"}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    `Error code: ${report.errorCode ?? "none"}`,
  ].join("\n");
}

export function formatOpsHealthReport(report: OpsHealthReport): string {
  return [
    "RIN ops health report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Readiness OK: ${report.readinessOk ? "yes" : "no"}`,
    `Integrity status: ${report.integrityStatus}`,
    `Recovery status: ${report.recoveryStatus}`,
    `Hidden errors suppressed: ${report.hiddenErrorsSuppressed ? "yes" : "no"}`,
    `Automatic repair applied: ${report.automaticRepairApplied ? "yes" : "no"}`,
    `Data mutated: ${report.dataMutated ? "yes" : "no"}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
  ].join("\n");
}

function createDefaultLayout(): RinDataLayout {
  const source = loadEnvironmentSource(process.cwd());
  return createDataLayout(loadEnvironment(source).dataDir, process.cwd());
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const fileStat = await stat(path);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

async function readManifestValidity(path: string): Promise<boolean> {
  try {
    parseRinDataManifest(await readFile(path, "utf8"));
    return true;
  } catch {
    return false;
  }
}

function readDatabaseIntegrity(layout: RinDataLayout): {
  inspectable: boolean;
  missingTables: string[];
  schemaVersion: number | null;
} {
  try {
    const status = inspectRinDatabase(layout);
    return {
      inspectable: true,
      missingTables: status.tables
        .filter((table) => !table.exists)
        .map((table) => table.name),
      schemaVersion: status.schemaVersion,
    };
  } catch {
    return {
      inspectable: false,
      missingTables: [...RIN_DATABASE_TABLES],
      schemaVersion: null,
    };
  }
}

async function readBackupDryRunStatus(
  layout: RinDataLayout,
): Promise<RecoverySmokeReport["backupDryRunStatus"]> {
  try {
    await buildBackupDryRunManifest(layout);
    return "ready";
  } catch {
    return "degraded";
  }
}

function readIntegrityErrorCode(input: {
  manifestPresent: boolean;
  manifestValid: boolean;
  databasePresent: boolean;
  databaseInspectable: boolean;
  missingTables: string[];
}): string | null {
  if (!input.manifestPresent) return "MISSING_MANIFEST";
  if (!input.manifestValid) return "INVALID_MANIFEST";
  if (!input.databasePresent) return "MISSING_DATABASE";
  if (!input.databaseInspectable) return "DATABASE_NOT_INSPECTABLE";
  if (input.missingTables.length > 0) return "DATABASE_TABLES_MISSING";
  return null;
}
