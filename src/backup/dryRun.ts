import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { RinDataLayout } from "../storage";
import { RIN_STORAGE_SCHEMA_VERSION } from "../storage";

export type BackupManifestFile = {
  relativePath: string;
  sizeBytes: number;
  sha256: string;
};

export type BackupDryRunManifest = {
  manifestSchemaVersion: 1;
  storageSchemaVersion: number;
  mode: "backup-dry-run";
  includes: string[];
  excludes: string[];
  files: BackupManifestFile[];
  fileCount: number;
  totalBytes: number;
  cloudSyncEnabled: false;
  secretsIncluded: false;
  archiveCreated: false;
  fullTextIncluded: false;
};

export type RestoreDryRunReport = {
  mode: "restore-dry-run";
  status: "valid" | "missing_manifest" | "invalid_manifest" | "overwrite_risk";
  manifestSchemaVersion: number | null;
  fileCount: number;
  totalBytes: number;
  overwriteWouldOccur: boolean;
  cloudSyncEnabled: false;
  dataMutated: false;
  secretsIncluded: false;
  fullTextIncluded: false;
  errorCode: string | null;
};

const INCLUDED_DIRECTORIES = ["config", "databases"] as const;
const EXCLUDED_NAMES = new Set([
  ".env",
  "node_modules",
  "dist",
  "tmp",
  "temp",
  ".DS_Store",
]);

export async function buildBackupDryRunManifest(
  layout: RinDataLayout,
): Promise<BackupDryRunManifest> {
  const files = (
    await Promise.all([
      fileEntry(layout.rootDir, join(layout.rootDir, "manifest.json")),
      ...INCLUDED_DIRECTORIES.map((directoryName) =>
        listBackupFiles(layout.rootDir, layout.directories[directoryName]),
      ),
    ])
  )
    .flat()
    .filter((file): file is BackupManifestFile => file !== null)
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  return {
    manifestSchemaVersion: 1,
    storageSchemaVersion: RIN_STORAGE_SCHEMA_VERSION,
    mode: "backup-dry-run",
    includes: ["manifest.json", ...INCLUDED_DIRECTORIES],
    excludes: ["logs", "bundles", "node_modules", "dist", ".env", ".env.*", "tmp"],
    files,
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    cloudSyncEnabled: false,
    secretsIncluded: false,
    archiveCreated: false,
    fullTextIncluded: false,
  };
}

export async function validateRestoreDryRun(input: {
  manifestPath?: string;
  targetLayout?: RinDataLayout;
}): Promise<RestoreDryRunReport> {
  if (!input.manifestPath) {
    return restoreReport("missing_manifest", null, 0, 0, false, "MISSING_MANIFEST");
  }

  try {
    const manifest = parseBackupDryRunManifest(
      JSON.parse(await readFile(input.manifestPath, "utf8")),
    );
    const overwriteWouldOccur = input.targetLayout
      ? await directoryExists(input.targetLayout.rootDir)
      : false;

    return restoreReport(
      overwriteWouldOccur ? "overwrite_risk" : "valid",
      manifest.manifestSchemaVersion,
      manifest.fileCount,
      manifest.totalBytes,
      overwriteWouldOccur,
      overwriteWouldOccur ? "TARGET_EXISTS" : null,
    );
  } catch {
    return restoreReport("invalid_manifest", null, 0, 0, false, "INVALID_MANIFEST");
  }
}

export function formatBackupDryRunManifest(
  manifest: BackupDryRunManifest,
): string {
  return [
    "RIN backup dry-run report.",
    `Mode: ${manifest.mode}`,
    `Manifest schema version: ${manifest.manifestSchemaVersion}`,
    `Storage schema version: ${manifest.storageSchemaVersion}`,
    `Files: ${manifest.fileCount}`,
    `Total bytes: ${manifest.totalBytes}`,
    `Cloud sync enabled: ${manifest.cloudSyncEnabled ? "yes" : "no"}`,
    `Secrets included: ${manifest.secretsIncluded ? "yes" : "no"}`,
    `Archive created: ${manifest.archiveCreated ? "yes" : "no"}`,
    `Full text included: ${manifest.fullTextIncluded ? "yes" : "no"}`,
    "File entries:",
    ...formatFiles(manifest.files),
  ].join("\n");
}

export function formatRestoreDryRunReport(report: RestoreDryRunReport): string {
  return [
    "RIN restore dry-run report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Manifest schema version: ${report.manifestSchemaVersion ?? "none"}`,
    `Files: ${report.fileCount}`,
    `Total bytes: ${report.totalBytes}`,
    `Overwrite would occur: ${report.overwriteWouldOccur ? "yes" : "no"}`,
    `Cloud sync enabled: ${report.cloudSyncEnabled ? "yes" : "no"}`,
    `Data mutated: ${report.dataMutated ? "yes" : "no"}`,
    `Secrets included: ${report.secretsIncluded ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    `Error code: ${report.errorCode ?? "none"}`,
  ].join("\n");
}

async function listBackupFiles(
  rootDir: string,
  directoryPath: string,
): Promise<BackupManifestFile[]> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const files = await Promise.all(
      entries.map((entry) => {
        const path = join(directoryPath, entry.name);

        if (shouldExclude(entry.name)) {
          return Promise.resolve([]);
        }

        return entry.isDirectory()
          ? listBackupFiles(rootDir, path)
          : fileEntry(rootDir, path).then((file) => (file ? [file] : []));
      }),
    );

    return files.flat();
  } catch {
    return [];
  }
}

async function fileEntry(
  rootDir: string,
  filePath: string,
): Promise<BackupManifestFile | null> {
  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile() || shouldExclude(filePath)) {
      return null;
    }

    const contents = await readFile(filePath);

    return {
      relativePath: toSafeRelativePath(rootDir, filePath),
      sizeBytes: fileStat.size,
      sha256: createHash("sha256").update(contents).digest("hex"),
    };
  } catch {
    return null;
  }
}

function parseBackupDryRunManifest(value: unknown): BackupDryRunManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("invalid manifest");
  }

  const candidate = value as BackupDryRunManifest;

  if (
    candidate.manifestSchemaVersion !== 1 ||
    candidate.mode !== "backup-dry-run" ||
    !Array.isArray(candidate.files) ||
    typeof candidate.fileCount !== "number" ||
    typeof candidate.totalBytes !== "number" ||
    candidate.cloudSyncEnabled !== false ||
    candidate.secretsIncluded !== false
  ) {
    throw new Error("invalid manifest");
  }

  return candidate;
}

function restoreReport(
  status: RestoreDryRunReport["status"],
  manifestSchemaVersion: number | null,
  fileCount: number,
  totalBytes: number,
  overwriteWouldOccur: boolean,
  errorCode: string | null,
): RestoreDryRunReport {
  return {
    mode: "restore-dry-run",
    status,
    manifestSchemaVersion,
    fileCount,
    totalBytes,
    overwriteWouldOccur,
    cloudSyncEnabled: false,
    dataMutated: false,
    secretsIncluded: false,
    fullTextIncluded: false,
    errorCode,
  };
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function shouldExclude(pathOrName: string): boolean {
  const name = pathOrName.split(sep).at(-1) ?? pathOrName;

  return (
    EXCLUDED_NAMES.has(name) ||
    name.startsWith(".env.") ||
    pathOrName.includes(`${sep}logs${sep}`) ||
    pathOrName.includes(`${sep}bundles${sep}`)
  );
}

function toSafeRelativePath(rootDir: string, filePath: string): string {
  return relative(rootDir, filePath).split(sep).join("/");
}

function formatFiles(files: readonly BackupManifestFile[]): string[] {
  if (files.length === 0) {
    return ["none"];
  }

  return files.map(
    (file) =>
      `- ${file.relativePath} bytes=${file.sizeBytes} sha256=${file.sha256}`,
  );
}
