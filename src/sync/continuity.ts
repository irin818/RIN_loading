import type { BackupDryRunManifest } from "../backup";
import type { RinDataManifest } from "../storage";

export type DeviceReport = {
  mode: "device-report";
  status: "ready";
  ownerId: string;
  deviceId: string;
  storageSchemaVersion: number;
  manifestUpdatedAt: string;
  localStatePrimary: true;
  providerCallCount: 0;
  cloudSyncEnabled: false;
  fullTextIncluded: false;
};

export type SyncDryRunReport = {
  mode: "sync-dry-run";
  status: "dry_run_only";
  sourceDeviceId: string;
  fileCount: number;
  totalBytes: number;
  conflictCount: number;
  plaintextSyncEnabled: false;
  cloudSyncEnabled: false;
  dataUploaded: false;
  dataMutated: false;
  automaticMergeEnabled: false;
  automaticOverwriteEnabled: false;
  providerCallCount: 0;
  fullTextIncluded: false;
};

export type MigrationCheckReport = {
  mode: "migration-check";
  status: "ready";
  ownerId: string;
  deviceId: string;
  storageSchemaVersion: number;
  backupManifestFileCount: number;
  backupManifestTotalBytes: number;
  encryptedSyncRequiredForCloud: true;
  automaticOverwriteEnabled: false;
  providerCallCount: 0;
  fullTextIncluded: false;
};

export function buildDeviceReport(manifest: RinDataManifest): DeviceReport {
  return {
    mode: "device-report",
    status: "ready",
    ownerId: manifest.ownerId,
    deviceId: manifest.deviceId,
    storageSchemaVersion: manifest.schemaVersion,
    manifestUpdatedAt: manifest.updatedAt,
    localStatePrimary: true,
    providerCallCount: 0,
    cloudSyncEnabled: false,
    fullTextIncluded: false,
  };
}

export function buildSyncDryRunReport(input: {
  manifest: RinDataManifest;
  backupManifest: BackupDryRunManifest;
}): SyncDryRunReport {
  return {
    mode: "sync-dry-run",
    status: "dry_run_only",
    sourceDeviceId: input.manifest.deviceId,
    fileCount: input.backupManifest.fileCount,
    totalBytes: input.backupManifest.totalBytes,
    conflictCount: 0,
    plaintextSyncEnabled: false,
    cloudSyncEnabled: false,
    dataUploaded: false,
    dataMutated: false,
    automaticMergeEnabled: false,
    automaticOverwriteEnabled: false,
    providerCallCount: 0,
    fullTextIncluded: false,
  };
}

export function buildMigrationCheckReport(input: {
  manifest: RinDataManifest;
  backupManifest: BackupDryRunManifest;
}): MigrationCheckReport {
  return {
    mode: "migration-check",
    status: "ready",
    ownerId: input.manifest.ownerId,
    deviceId: input.manifest.deviceId,
    storageSchemaVersion: input.manifest.schemaVersion,
    backupManifestFileCount: input.backupManifest.fileCount,
    backupManifestTotalBytes: input.backupManifest.totalBytes,
    encryptedSyncRequiredForCloud: true,
    automaticOverwriteEnabled: false,
    providerCallCount: 0,
    fullTextIncluded: false,
  };
}

export function formatDeviceReport(report: DeviceReport): string {
  return [
    "RIN device report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Owner ID: ${report.ownerId}`,
    `Device ID: ${report.deviceId}`,
    `Storage schema version: ${report.storageSchemaVersion}`,
    `Manifest updated at: ${report.manifestUpdatedAt}`,
    `Local state primary: ${report.localStatePrimary ? "yes" : "no"}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Cloud sync enabled: ${report.cloudSyncEnabled ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
  ].join("\n");
}

export function formatSyncDryRunReport(report: SyncDryRunReport): string {
  return [
    "RIN sync dry-run report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Source device ID: ${report.sourceDeviceId}`,
    `Files: ${report.fileCount}`,
    `Total bytes: ${report.totalBytes}`,
    `Conflicts: ${report.conflictCount}`,
    `Plaintext sync enabled: ${report.plaintextSyncEnabled ? "yes" : "no"}`,
    `Cloud sync enabled: ${report.cloudSyncEnabled ? "yes" : "no"}`,
    `Data uploaded: ${report.dataUploaded ? "yes" : "no"}`,
    `Data mutated: ${report.dataMutated ? "yes" : "no"}`,
    `Automatic merge enabled: ${report.automaticMergeEnabled ? "yes" : "no"}`,
    `Automatic overwrite enabled: ${report.automaticOverwriteEnabled ? "yes" : "no"}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
  ].join("\n");
}

export function formatMigrationCheckReport(
  report: MigrationCheckReport,
): string {
  return [
    "RIN migration check report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Owner ID: ${report.ownerId}`,
    `Device ID: ${report.deviceId}`,
    `Storage schema version: ${report.storageSchemaVersion}`,
    `Backup manifest files: ${report.backupManifestFileCount}`,
    `Backup manifest bytes: ${report.backupManifestTotalBytes}`,
    `Encrypted sync required for cloud: ${report.encryptedSyncRequiredForCloud ? "yes" : "no"}`,
    `Automatic overwrite enabled: ${report.automaticOverwriteEnabled ? "yes" : "no"}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
  ].join("\n");
}
