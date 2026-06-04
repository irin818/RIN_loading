import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt,
} from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { gzip, gunzip } from "node:zlib";
import { RIN_PROJECT_NAME } from "../core/project";
import {
  parseRinDataManifest,
  RIN_STORAGE_SCHEMA_VERSION,
  type RinDataLayout,
} from "../storage";
import { buildBackupDryRunManifest } from "./dryRun";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
) => Promise<Buffer>;

const ARCHIVE_SCHEMA_VERSION = 1;
const PAYLOAD_SCHEMA_VERSION = 1;
const MANIFEST_SCHEMA_VERSION = 2;
const CIPHER_ALGORITHM = "aes-256-gcm";
const KEY_DERIVATION = "scrypt";
const KEY_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12;

export const RESTORE_APPLY_CONFIRMATION_TOKEN =
  "RIN_RESTORE_APPLY_EMPTY_TARGET";

type EncryptedBackupPayloadFile = {
  relativePath: string;
  sizeBytes: number;
  sha256: string;
  contentsBase64: string;
};

type EncryptedBackupPayload = {
  payloadSchemaVersion: typeof PAYLOAD_SCHEMA_VERSION;
  manifestSchemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  storageSchemaVersion: typeof RIN_STORAGE_SCHEMA_VERSION;
  mode: "encrypted-backup-payload";
  createdAt: string;
  includes: string[];
  excludes: string[];
  files: EncryptedBackupPayloadFile[];
  fileCount: number;
  totalBytes: number;
  cloudSyncEnabled: false;
  secretsIncluded: false;
  archiveCreated: true;
  encrypted: true;
  fullTextIncluded: false;
};

type EncryptedBackupArchive = {
  project: typeof RIN_PROJECT_NAME;
  archiveSchemaVersion: typeof ARCHIVE_SCHEMA_VERSION;
  mode: "encrypted-backup";
  createdAt: string;
  encryption: {
    algorithm: typeof CIPHER_ALGORITHM;
    keyDerivation: typeof KEY_DERIVATION;
    keyLengthBytes: typeof KEY_LENGTH_BYTES;
    saltBase64: string;
    ivBase64: string;
    authTagBase64: string;
    payloadEncoding: "gzip+json+base64";
  };
  publicSummary: {
    fileCount: number;
    totalBytes: number;
    cloudSyncEnabled: false;
    secretsIncluded: false;
    fullTextIncluded: false;
  };
  ciphertextBase64: string;
};

export type EncryptedBackupCreateReport = {
  mode: "encrypted-backup-create";
  status: "created";
  archivePath: string;
  archiveSchemaVersion: typeof ARCHIVE_SCHEMA_VERSION;
  manifestSchemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  storageSchemaVersion: typeof RIN_STORAGE_SCHEMA_VERSION;
  fileCount: number;
  totalBytes: number;
  encryption: typeof CIPHER_ALGORITHM;
  keyDerivation: typeof KEY_DERIVATION;
  cloudSyncEnabled: false;
  secretsIncluded: false;
  archiveCreated: true;
  fullTextIncluded: false;
};

export type EncryptedBackupVerifyReport = {
  mode: "encrypted-backup-verify";
  status: "valid" | "invalid_archive";
  archivePath: string;
  archiveSchemaVersion: number | null;
  manifestSchemaVersion: number | null;
  fileCount: number;
  totalBytes: number;
  cloudSyncEnabled: false;
  secretsIncluded: false;
  fullTextIncluded: false;
  errorCode: string | null;
};

export type RestoreConflict = {
  relativePath: string;
  reason: "target_exists";
};

export type EncryptedRestoreDryRunReport = {
  mode: "encrypted-restore-dry-run";
  status: "valid" | "missing_archive" | "invalid_archive" | "conflict";
  archivePath: string | null;
  archiveSchemaVersion: number | null;
  manifestSchemaVersion: number | null;
  fileCount: number;
  totalBytes: number;
  conflicts: RestoreConflict[];
  overwriteWouldOccur: boolean;
  applyConfirmationRequired: true;
  requiredConfirmationToken: typeof RESTORE_APPLY_CONFIRMATION_TOKEN;
  manifestWillBeRewrittenForTarget: boolean;
  rollbackPlan: string[];
  cloudSyncEnabled: false;
  dataMutated: false;
  secretsIncluded: false;
  fullTextIncluded: false;
  errorCode: string | null;
};

export type EncryptedRestoreApplyReport = {
  mode: "encrypted-restore-apply";
  status:
    | "applied"
    | "confirmation_required"
    | "missing_archive"
    | "invalid_archive"
    | "conflict";
  archivePath: string | null;
  archiveSchemaVersion: number | null;
  manifestSchemaVersion: number | null;
  fileCount: number;
  totalBytes: number;
  createdFiles: string[];
  conflicts: RestoreConflict[];
  overwriteWouldOccur: boolean;
  applyConfirmationRequired: true;
  requiredConfirmationToken: typeof RESTORE_APPLY_CONFIRMATION_TOKEN;
  manifestRewrittenForTarget: boolean;
  rollbackPlan: string[];
  cloudSyncEnabled: false;
  dataMutated: boolean;
  secretsIncluded: false;
  fullTextIncluded: false;
  errorCode: string | null;
};

export async function createEncryptedBackupArchive(input: {
  layout: RinDataLayout;
  archivePath: string;
  passphrase: string;
  now?: Date;
}): Promise<EncryptedBackupCreateReport> {
  assertPassphrase(input.passphrase);

  const createdAt = (input.now ?? new Date()).toISOString();
  const payload = await buildEncryptedBackupPayload(input.layout, createdAt);
  const archive = await encryptPayload(payload, input.passphrase);
  const archivePath = resolve(input.archivePath);

  await mkdir(dirname(archivePath), { recursive: true });
  await writeFile(archivePath, `${JSON.stringify(archive, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });

  return {
    mode: "encrypted-backup-create",
    status: "created",
    archivePath,
    archiveSchemaVersion: ARCHIVE_SCHEMA_VERSION,
    manifestSchemaVersion: MANIFEST_SCHEMA_VERSION,
    storageSchemaVersion: RIN_STORAGE_SCHEMA_VERSION,
    fileCount: payload.fileCount,
    totalBytes: payload.totalBytes,
    encryption: CIPHER_ALGORITHM,
    keyDerivation: KEY_DERIVATION,
    cloudSyncEnabled: false,
    secretsIncluded: false,
    archiveCreated: true,
    fullTextIncluded: false,
  };
}

export async function verifyEncryptedBackupArchive(input: {
  archivePath: string;
  passphrase: string;
}): Promise<EncryptedBackupVerifyReport> {
  try {
    assertPassphrase(input.passphrase);
    const { archive, payload } = await readEncryptedArchive(input);
    validatePayloadHashes(payload);

    return {
      mode: "encrypted-backup-verify",
      status: "valid",
      archivePath: resolve(input.archivePath),
      archiveSchemaVersion: archive.archiveSchemaVersion,
      manifestSchemaVersion: payload.manifestSchemaVersion,
      fileCount: payload.fileCount,
      totalBytes: payload.totalBytes,
      cloudSyncEnabled: false,
      secretsIncluded: false,
      fullTextIncluded: false,
      errorCode: null,
    };
  } catch {
    return invalidVerifyReport(input.archivePath);
  }
}

export async function planEncryptedRestore(input: {
  archivePath?: string;
  passphrase: string;
  targetLayout: RinDataLayout;
}): Promise<EncryptedRestoreDryRunReport> {
  if (!input.archivePath) {
    return restoreDryRunReport({
      status: "missing_archive",
      archivePath: null,
      errorCode: "MISSING_ARCHIVE",
    });
  }

  try {
    assertPassphrase(input.passphrase);
    const { archive, payload } = await readEncryptedArchive({
      archivePath: input.archivePath,
      passphrase: input.passphrase,
    });
    validatePayloadHashes(payload);
    const conflicts = await findRestoreConflicts(input.targetLayout, payload.files);

    return restoreDryRunReport({
      status: conflicts.length > 0 ? "conflict" : "valid",
      archivePath: resolve(input.archivePath),
      archiveSchemaVersion: archive.archiveSchemaVersion,
      manifestSchemaVersion: payload.manifestSchemaVersion,
      fileCount: payload.fileCount,
      totalBytes: payload.totalBytes,
      conflicts,
      manifestWillBeRewrittenForTarget: payload.files.some(
        (file) => file.relativePath === "manifest.json",
      ),
      errorCode: conflicts.length > 0 ? "TARGET_CONFLICT" : null,
    });
  } catch {
    return restoreDryRunReport({
      status: "invalid_archive",
      archivePath: resolve(input.archivePath),
      errorCode: "INVALID_ARCHIVE",
    });
  }
}

export async function applyEncryptedRestore(input: {
  archivePath?: string;
  passphrase: string;
  targetLayout: RinDataLayout;
  confirmationToken?: string;
  targetDeviceId?: string;
  now?: Date;
}): Promise<EncryptedRestoreApplyReport> {
  if (input.confirmationToken !== RESTORE_APPLY_CONFIRMATION_TOKEN) {
    return restoreApplyReport({
      status: "confirmation_required",
      archivePath: input.archivePath ? resolve(input.archivePath) : null,
      errorCode: "CONFIRMATION_REQUIRED",
    });
  }

  const plan = await planEncryptedRestore({
    archivePath: input.archivePath,
    passphrase: input.passphrase,
    targetLayout: input.targetLayout,
  });

  if (plan.status !== "valid" || !input.archivePath) {
    const blockedStatus =
      plan.status === "valid" ? "invalid_archive" : plan.status;

    return restoreApplyReport({
      status: blockedStatus,
      archivePath: plan.archivePath,
      archiveSchemaVersion: plan.archiveSchemaVersion,
      manifestSchemaVersion: plan.manifestSchemaVersion,
      fileCount: plan.fileCount,
      totalBytes: plan.totalBytes,
      conflicts: plan.conflicts,
      errorCode: plan.errorCode,
    });
  }

  const { archive, payload } = await readEncryptedArchive({
    archivePath: input.archivePath,
    passphrase: input.passphrase,
  });
  validatePayloadHashes(payload);
  const conflicts = await findRestoreConflicts(input.targetLayout, payload.files);

  if (conflicts.length > 0) {
    return restoreApplyReport({
      status: "conflict",
      archivePath: resolve(input.archivePath),
      archiveSchemaVersion: archive.archiveSchemaVersion,
      manifestSchemaVersion: payload.manifestSchemaVersion,
      fileCount: payload.fileCount,
      totalBytes: payload.totalBytes,
      conflicts,
      errorCode: "TARGET_CONFLICT",
    });
  }

  const createdFiles: string[] = [];

  for (const file of payload.files) {
    const targetPath = resolveTargetPath(input.targetLayout, file.relativePath);
    const contents = restoreFileContents({
      file,
      targetLayout: input.targetLayout,
      targetDeviceId: input.targetDeviceId,
      now: input.now ?? new Date(),
    });

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, contents, { flag: "wx" });
    createdFiles.push(file.relativePath);
  }

  return restoreApplyReport({
    status: "applied",
    archivePath: resolve(input.archivePath),
    archiveSchemaVersion: archive.archiveSchemaVersion,
    manifestSchemaVersion: payload.manifestSchemaVersion,
    fileCount: payload.fileCount,
    totalBytes: payload.totalBytes,
    createdFiles,
    manifestRewrittenForTarget: payload.files.some(
      (file) => file.relativePath === "manifest.json",
    ),
    dataMutated: createdFiles.length > 0,
    errorCode: null,
  });
}

export function formatEncryptedBackupCreateReport(
  report: EncryptedBackupCreateReport,
): string {
  return [
    "RIN encrypted backup create report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Archive path: ${report.archivePath}`,
    `Archive schema version: ${report.archiveSchemaVersion}`,
    `Manifest schema version: ${report.manifestSchemaVersion}`,
    `Storage schema version: ${report.storageSchemaVersion}`,
    `Files: ${report.fileCount}`,
    `Total bytes: ${report.totalBytes}`,
    `Encryption: ${report.encryption}`,
    `Key derivation: ${report.keyDerivation}`,
    `Cloud sync enabled: ${report.cloudSyncEnabled ? "yes" : "no"}`,
    `Secrets included: ${report.secretsIncluded ? "yes" : "no"}`,
    `Archive created: ${report.archiveCreated ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
  ].join("\n");
}

export function formatEncryptedBackupVerifyReport(
  report: EncryptedBackupVerifyReport,
): string {
  return [
    "RIN encrypted backup verify report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Archive path: ${report.archivePath}`,
    `Archive schema version: ${report.archiveSchemaVersion ?? "none"}`,
    `Manifest schema version: ${report.manifestSchemaVersion ?? "none"}`,
    `Files: ${report.fileCount}`,
    `Total bytes: ${report.totalBytes}`,
    `Cloud sync enabled: ${report.cloudSyncEnabled ? "yes" : "no"}`,
    `Secrets included: ${report.secretsIncluded ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    `Error code: ${report.errorCode ?? "none"}`,
  ].join("\n");
}

export function formatEncryptedRestoreDryRunReport(
  report: EncryptedRestoreDryRunReport,
): string {
  return [
    "RIN encrypted restore dry-run report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Archive path: ${report.archivePath ?? "none"}`,
    `Archive schema version: ${report.archiveSchemaVersion ?? "none"}`,
    `Manifest schema version: ${report.manifestSchemaVersion ?? "none"}`,
    `Files: ${report.fileCount}`,
    `Total bytes: ${report.totalBytes}`,
    `Overwrite would occur: ${report.overwriteWouldOccur ? "yes" : "no"}`,
    `Conflicts: ${report.conflicts.length}`,
    `Apply confirmation required: ${report.applyConfirmationRequired ? "yes" : "no"}`,
    `Required confirmation token: ${report.requiredConfirmationToken}`,
    `Manifest will be rewritten for target: ${
      report.manifestWillBeRewrittenForTarget ? "yes" : "no"
    }`,
    `Cloud sync enabled: ${report.cloudSyncEnabled ? "yes" : "no"}`,
    `Data mutated: ${report.dataMutated ? "yes" : "no"}`,
    `Secrets included: ${report.secretsIncluded ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    `Error code: ${report.errorCode ?? "none"}`,
    "Conflict entries:",
    ...formatConflicts(report.conflicts),
    "Rollback plan:",
    ...report.rollbackPlan.map((line) => `- ${line}`),
  ].join("\n");
}

export function formatEncryptedRestoreApplyReport(
  report: EncryptedRestoreApplyReport,
): string {
  return [
    "RIN encrypted restore apply report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Archive path: ${report.archivePath ?? "none"}`,
    `Archive schema version: ${report.archiveSchemaVersion ?? "none"}`,
    `Manifest schema version: ${report.manifestSchemaVersion ?? "none"}`,
    `Files: ${report.fileCount}`,
    `Total bytes: ${report.totalBytes}`,
    `Created files: ${report.createdFiles.length}`,
    `Overwrite would occur: ${report.overwriteWouldOccur ? "yes" : "no"}`,
    `Conflicts: ${report.conflicts.length}`,
    `Apply confirmation required: ${report.applyConfirmationRequired ? "yes" : "no"}`,
    `Required confirmation token: ${report.requiredConfirmationToken}`,
    `Manifest rewritten for target: ${
      report.manifestRewrittenForTarget ? "yes" : "no"
    }`,
    `Cloud sync enabled: ${report.cloudSyncEnabled ? "yes" : "no"}`,
    `Data mutated: ${report.dataMutated ? "yes" : "no"}`,
    `Secrets included: ${report.secretsIncluded ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    `Error code: ${report.errorCode ?? "none"}`,
    "Created file entries:",
    ...formatFileNames(report.createdFiles),
    "Conflict entries:",
    ...formatConflicts(report.conflicts),
    "Rollback plan:",
    ...report.rollbackPlan.map((line) => `- ${line}`),
  ].join("\n");
}

async function buildEncryptedBackupPayload(
  layout: RinDataLayout,
  createdAt: string,
): Promise<EncryptedBackupPayload> {
  const dryRunManifest = await buildBackupDryRunManifest(layout);
  const files = await Promise.all(
    dryRunManifest.files.map(async (file) => {
      const absolutePath = resolveTargetPath(layout, file.relativePath);
      const contents = await readFile(absolutePath);
      const sha256 = sha256Hex(contents);

      if (sha256 !== file.sha256) {
        throw new Error(`Backup file hash changed while reading: ${file.relativePath}`);
      }

      return {
        ...file,
        contentsBase64: contents.toString("base64"),
      };
    }),
  );

  return {
    payloadSchemaVersion: PAYLOAD_SCHEMA_VERSION,
    manifestSchemaVersion: MANIFEST_SCHEMA_VERSION,
    storageSchemaVersion: RIN_STORAGE_SCHEMA_VERSION,
    mode: "encrypted-backup-payload",
    createdAt,
    includes: dryRunManifest.includes,
    excludes: dryRunManifest.excludes,
    files,
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    cloudSyncEnabled: false,
    secretsIncluded: false,
    archiveCreated: true,
    encrypted: true,
    fullTextIncluded: false,
  };
}

async function encryptPayload(
  payload: EncryptedBackupPayload,
  passphrase: string,
): Promise<EncryptedBackupArchive> {
  const salt = randomBytes(SALT_LENGTH_BYTES);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const key = await deriveKey(passphrase, salt);
  const compressedPayload = await gzipAsync(
    Buffer.from(JSON.stringify(payload), "utf8"),
  );
  const cipher = createCipheriv(CIPHER_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(compressedPayload),
    cipher.final(),
  ]);

  return {
    project: RIN_PROJECT_NAME,
    archiveSchemaVersion: ARCHIVE_SCHEMA_VERSION,
    mode: "encrypted-backup",
    createdAt: payload.createdAt,
    encryption: {
      algorithm: CIPHER_ALGORITHM,
      keyDerivation: KEY_DERIVATION,
      keyLengthBytes: KEY_LENGTH_BYTES,
      saltBase64: salt.toString("base64"),
      ivBase64: iv.toString("base64"),
      authTagBase64: cipher.getAuthTag().toString("base64"),
      payloadEncoding: "gzip+json+base64",
    },
    publicSummary: {
      fileCount: payload.fileCount,
      totalBytes: payload.totalBytes,
      cloudSyncEnabled: false,
      secretsIncluded: false,
      fullTextIncluded: false,
    },
    ciphertextBase64: ciphertext.toString("base64"),
  };
}

async function readEncryptedArchive(input: {
  archivePath: string;
  passphrase: string;
}): Promise<{
  archive: EncryptedBackupArchive;
  payload: EncryptedBackupPayload;
}> {
  const archive = parseArchive(
    JSON.parse(await readFile(resolve(input.archivePath), "utf8")),
  );
  const payload = await decryptPayload(archive, input.passphrase);

  return { archive, payload };
}

async function decryptPayload(
  archive: EncryptedBackupArchive,
  passphrase: string,
): Promise<EncryptedBackupPayload> {
  const salt = Buffer.from(archive.encryption.saltBase64, "base64");
  const iv = Buffer.from(archive.encryption.ivBase64, "base64");
  const authTag = Buffer.from(archive.encryption.authTagBase64, "base64");
  const ciphertext = Buffer.from(archive.ciphertextBase64, "base64");
  const key = await deriveKey(passphrase, salt);
  const decipher = createDecipheriv(CIPHER_ALGORITHM, key, iv);

  decipher.setAuthTag(authTag);

  const compressedPayload = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  const payload = JSON.parse((await gunzipAsync(compressedPayload)).toString("utf8"));

  return parsePayload(payload);
}

async function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  return scryptAsync(passphrase, salt, KEY_LENGTH_BYTES);
}

function parseArchive(value: unknown): EncryptedBackupArchive {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid encrypted backup archive.");
  }

  const candidate = value as EncryptedBackupArchive;

  if (
    candidate.project !== RIN_PROJECT_NAME ||
    candidate.archiveSchemaVersion !== ARCHIVE_SCHEMA_VERSION ||
    candidate.mode !== "encrypted-backup" ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.ciphertextBase64 !== "string" ||
    typeof candidate.encryption !== "object" ||
    candidate.encryption === null ||
    candidate.encryption.algorithm !== CIPHER_ALGORITHM ||
    candidate.encryption.keyDerivation !== KEY_DERIVATION ||
    candidate.encryption.keyLengthBytes !== KEY_LENGTH_BYTES ||
    candidate.encryption.payloadEncoding !== "gzip+json+base64" ||
    typeof candidate.encryption.saltBase64 !== "string" ||
    typeof candidate.encryption.ivBase64 !== "string" ||
    typeof candidate.encryption.authTagBase64 !== "string" ||
    typeof candidate.publicSummary !== "object" ||
    candidate.publicSummary === null ||
    candidate.publicSummary.cloudSyncEnabled !== false ||
    candidate.publicSummary.secretsIncluded !== false ||
    candidate.publicSummary.fullTextIncluded !== false
  ) {
    throw new Error("Invalid encrypted backup archive.");
  }

  return candidate;
}

function parsePayload(value: unknown): EncryptedBackupPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid encrypted backup payload.");
  }

  const candidate = value as EncryptedBackupPayload;

  if (
    candidate.payloadSchemaVersion !== PAYLOAD_SCHEMA_VERSION ||
    candidate.manifestSchemaVersion !== MANIFEST_SCHEMA_VERSION ||
    candidate.storageSchemaVersion !== RIN_STORAGE_SCHEMA_VERSION ||
    candidate.mode !== "encrypted-backup-payload" ||
    typeof candidate.createdAt !== "string" ||
    !Array.isArray(candidate.includes) ||
    !Array.isArray(candidate.excludes) ||
    !Array.isArray(candidate.files) ||
    candidate.fileCount !== candidate.files.length ||
    typeof candidate.totalBytes !== "number" ||
    candidate.cloudSyncEnabled !== false ||
    candidate.secretsIncluded !== false ||
    candidate.archiveCreated !== true ||
    candidate.encrypted !== true ||
    candidate.fullTextIncluded !== false
  ) {
    throw new Error("Invalid encrypted backup payload.");
  }

  for (const file of candidate.files) {
    if (
      typeof file.relativePath !== "string" ||
      typeof file.sizeBytes !== "number" ||
      typeof file.sha256 !== "string" ||
      typeof file.contentsBase64 !== "string" ||
      !isSafeRelativePath(file.relativePath)
    ) {
      throw new Error("Invalid encrypted backup file entry.");
    }
  }

  return candidate;
}

function validatePayloadHashes(payload: EncryptedBackupPayload): void {
  const totalBytes = payload.files.reduce((total, file) => {
    const contents = Buffer.from(file.contentsBase64, "base64");

    if (contents.byteLength !== file.sizeBytes || sha256Hex(contents) !== file.sha256) {
      throw new Error(`Invalid encrypted backup file hash: ${file.relativePath}`);
    }

    return total + contents.byteLength;
  }, 0);

  if (totalBytes !== payload.totalBytes) {
    throw new Error("Invalid encrypted backup total byte count.");
  }
}

async function findRestoreConflicts(
  targetLayout: RinDataLayout,
  files: readonly EncryptedBackupPayloadFile[],
): Promise<RestoreConflict[]> {
  const conflicts = await Promise.all(
    files.map(async (file) => {
      const targetPath = resolveTargetPath(targetLayout, file.relativePath);

      return (await fileExists(targetPath))
        ? { relativePath: file.relativePath, reason: "target_exists" as const }
        : null;
    }),
  );

  return conflicts.filter((conflict): conflict is RestoreConflict => conflict !== null);
}

function restoreFileContents(input: {
  file: EncryptedBackupPayloadFile;
  targetLayout: RinDataLayout;
  targetDeviceId?: string;
  now: Date;
}): Buffer {
  const contents = Buffer.from(input.file.contentsBase64, "base64");

  if (input.file.relativePath !== "manifest.json") {
    return contents;
  }

  const manifest = parseRinDataManifest(contents.toString("utf8"));
  const restoredManifest = {
    ...manifest,
    deviceId: input.targetDeviceId ?? manifest.deviceId,
    updatedAt: input.now.toISOString(),
    directories: input.targetLayout.directories,
  };

  return Buffer.from(`${JSON.stringify(restoredManifest, null, 2)}\n`, "utf8");
}

function restoreDryRunReport(input: {
  status: EncryptedRestoreDryRunReport["status"];
  archivePath: string | null;
  archiveSchemaVersion?: number | null;
  manifestSchemaVersion?: number | null;
  fileCount?: number;
  totalBytes?: number;
  conflicts?: RestoreConflict[];
  manifestWillBeRewrittenForTarget?: boolean;
  errorCode: string | null;
}): EncryptedRestoreDryRunReport {
  const conflicts = input.conflicts ?? [];

  return {
    mode: "encrypted-restore-dry-run",
    status: input.status,
    archivePath: input.archivePath,
    archiveSchemaVersion: input.archiveSchemaVersion ?? null,
    manifestSchemaVersion: input.manifestSchemaVersion ?? null,
    fileCount: input.fileCount ?? 0,
    totalBytes: input.totalBytes ?? 0,
    conflicts,
    overwriteWouldOccur: conflicts.length > 0,
    applyConfirmationRequired: true,
    requiredConfirmationToken: RESTORE_APPLY_CONFIRMATION_TOKEN,
    manifestWillBeRewrittenForTarget:
      input.manifestWillBeRewrittenForTarget ?? false,
    rollbackPlan: rollbackPlan(),
    cloudSyncEnabled: false,
    dataMutated: false,
    secretsIncluded: false,
    fullTextIncluded: false,
    errorCode: input.errorCode,
  };
}

function restoreApplyReport(input: {
  status: EncryptedRestoreApplyReport["status"];
  archivePath: string | null;
  archiveSchemaVersion?: number | null;
  manifestSchemaVersion?: number | null;
  fileCount?: number;
  totalBytes?: number;
  createdFiles?: string[];
  conflicts?: RestoreConflict[];
  manifestRewrittenForTarget?: boolean;
  dataMutated?: boolean;
  errorCode: string | null;
}): EncryptedRestoreApplyReport {
  const conflicts = input.conflicts ?? [];

  return {
    mode: "encrypted-restore-apply",
    status: input.status,
    archivePath: input.archivePath,
    archiveSchemaVersion: input.archiveSchemaVersion ?? null,
    manifestSchemaVersion: input.manifestSchemaVersion ?? null,
    fileCount: input.fileCount ?? 0,
    totalBytes: input.totalBytes ?? 0,
    createdFiles: input.createdFiles ?? [],
    conflicts,
    overwriteWouldOccur: conflicts.length > 0,
    applyConfirmationRequired: true,
    requiredConfirmationToken: RESTORE_APPLY_CONFIRMATION_TOKEN,
    manifestRewrittenForTarget: input.manifestRewrittenForTarget ?? false,
    rollbackPlan: rollbackPlan(),
    cloudSyncEnabled: false,
    dataMutated: input.dataMutated ?? false,
    secretsIncluded: false,
    fullTextIncluded: false,
    errorCode: input.errorCode,
  };
}

function invalidVerifyReport(archivePath: string): EncryptedBackupVerifyReport {
  return {
    mode: "encrypted-backup-verify",
    status: "invalid_archive",
    archivePath: resolve(archivePath),
    archiveSchemaVersion: null,
    manifestSchemaVersion: null,
    fileCount: 0,
    totalBytes: 0,
    cloudSyncEnabled: false,
    secretsIncluded: false,
    fullTextIncluded: false,
    errorCode: "INVALID_ARCHIVE",
  };
}

function rollbackPlan(): string[] {
  return [
    "Review createdFiles before deleting anything.",
    "If restore apply must be rolled back, remove only files listed in this report.",
    "Do not delete or overwrite existing local data automatically.",
  ];
}

function resolveTargetPath(layout: RinDataLayout, relativePath: string): string {
  if (!isSafeRelativePath(relativePath)) {
    throw new Error(`Unsafe backup relative path: ${relativePath}`);
  }

  const targetPath = resolve(layout.rootDir, ...relativePath.split("/"));
  const pathWithinRoot = relative(layout.rootDir, targetPath);

  if (
    pathWithinRoot.length === 0 ||
    pathWithinRoot.startsWith(`..${sep}`) ||
    pathWithinRoot === ".." ||
    isAbsolute(pathWithinRoot)
  ) {
    throw new Error(`Backup path escapes target root: ${relativePath}`);
  }

  return targetPath;
}

function isSafeRelativePath(relativePath: string): boolean {
  if (
    relativePath.length === 0 ||
    relativePath.includes("\\") ||
    relativePath.includes("\0") ||
    relativePath.startsWith("/") ||
    isAbsolute(relativePath)
  ) {
    return false;
  }

  const segments = relativePath.split("/");

  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  );
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function assertPassphrase(passphrase: string): void {
  if (passphrase.trim().length === 0) {
    throw new Error("RIN backup passphrase is required.");
  }
}

function sha256Hex(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

function formatConflicts(conflicts: readonly RestoreConflict[]): string[] {
  if (conflicts.length === 0) {
    return ["none"];
  }

  return conflicts.map(
    (conflict) => `- ${conflict.relativePath} reason=${conflict.reason}`,
  );
}

function formatFileNames(files: readonly string[]): string[] {
  if (files.length === 0) {
    return ["none"];
  }

  return files.map((file) => `- ${file}`);
}
