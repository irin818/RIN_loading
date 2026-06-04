import { describe, expect, it } from "vitest";
import type { BackupDryRunManifest } from "../backup";
import type { RinDataManifest } from "../storage";
import {
  buildDeviceReport,
  buildMigrationCheckReport,
  buildSyncDryRunReport,
  formatDeviceReport,
  formatMigrationCheckReport,
  formatSyncDryRunReport,
} from "./continuity";

describe("device continuity and sync dry-run reports", () => {
  it("reports local device identity without paths or provider calls", () => {
    const report = buildDeviceReport(manifest());
    const summary = formatDeviceReport(report);

    expect(report).toMatchObject({
      ownerId: "owner-1",
      deviceId: "device-1",
      localStatePrimary: true,
      providerCallCount: 0,
      cloudSyncEnabled: false,
      fullTextIncluded: false,
    });
    expect(summary).not.toContain("/private/rin-data");
  });

  it("builds a sync dry-run without upload, mutation, merge, or overwrite", () => {
    const report = buildSyncDryRunReport({
      manifest: manifest(),
      backupManifest: backupManifest(),
    });
    const summary = formatSyncDryRunReport(report);

    expect(report).toMatchObject({
      status: "dry_run_only",
      fileCount: 2,
      totalBytes: 30,
      conflictCount: 0,
      plaintextSyncEnabled: false,
      cloudSyncEnabled: false,
      dataUploaded: false,
      dataMutated: false,
      automaticMergeEnabled: false,
      automaticOverwriteEnabled: false,
      providerCallCount: 0,
      fullTextIncluded: false,
    });
    expect(summary).not.toContain("/private/rin-data");
  });

  it("checks migration readiness without enabling overwrite", () => {
    const report = buildMigrationCheckReport({
      manifest: manifest(),
      backupManifest: backupManifest(),
    });
    const summary = formatMigrationCheckReport(report);

    expect(report).toMatchObject({
      storageSchemaVersion: 1,
      backupManifestFileCount: 2,
      encryptedSyncRequiredForCloud: true,
      automaticOverwriteEnabled: false,
      providerCallCount: 0,
      fullTextIncluded: false,
    });
    expect(summary).not.toContain("/private/rin-data");
  });
});

function manifest(): RinDataManifest {
  return {
    project: "RIN",
    schemaVersion: 1,
    ownerId: "owner-1",
    deviceId: "device-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    directories: {
      config: "/private/rin-data/config",
      databases: "/private/rin-data/databases",
      logs: "/private/rin-data/logs",
      bundles: "/private/rin-data/bundles",
      attachments: "/private/rin-data/attachments",
    },
  };
}

function backupManifest(): BackupDryRunManifest {
  return {
    manifestSchemaVersion: 1,
    storageSchemaVersion: 1,
    mode: "backup-dry-run",
    includes: ["manifest.json", "config", "databases"],
    excludes: [".env", ".env.*"],
    files: [
      {
        relativePath: "manifest.json",
        sizeBytes: 10,
        sha256: "a",
      },
      {
        relativePath: "config/user_model.json",
        sizeBytes: 20,
        sha256: "b",
      },
    ],
    fileCount: 2,
    totalBytes: 30,
    cloudSyncEnabled: false,
    secretsIncluded: false,
    archiveCreated: false,
    fullTextIncluded: false,
  };
}
