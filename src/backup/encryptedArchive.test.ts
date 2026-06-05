import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { createDataLayout, initializeRinStorage } from "../storage";
import {
  applyEncryptedRestore,
  createEncryptedBackupArchive,
  planEncryptedRestore,
  RESTORE_APPLY_CONFIRMATION_TOKEN,
  verifyEncryptedBackupArchive,
} from "./encryptedArchive";

const tempRoots: string[] = [];
const passphrase = "local-test-passphrase";

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("encrypted backup archive", () => {
  it("creates a local encrypted archive without plaintext secrets or cloud sync", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const archivePath = join(cwd, "backup.rinbackup");

    await writeFile(join(storage.layout.rootDir, ".env.local"), "SECRET=value");
    await writeFile(
      join(storage.layout.directories.logs, "private.log"),
      "secret log",
    );

    const createReport = await createEncryptedBackupArchive({
      layout: storage.layout,
      archivePath,
      passphrase,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const archiveText = await readFile(archivePath, "utf8");
    const verifyReport = await verifyEncryptedBackupArchive({
      archivePath,
      passphrase,
    });

    expect(createReport).toMatchObject({
      status: "created",
      cloudSyncEnabled: false,
      secretsIncluded: false,
      archiveCreated: true,
      fullTextIncluded: false,
    });
    expect(verifyReport.status).toBe("valid");
    expect(archiveText).not.toContain("SECRET=value");
    expect(archiveText).not.toContain("secret log");
    expect(archiveText).not.toContain(storage.layout.rootDir);
  });

  it("detects archive tampering during verification", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const archivePath = join(cwd, "backup.rinbackup");

    await createEncryptedBackupArchive({
      layout: storage.layout,
      archivePath,
      passphrase,
    });

    const archive = JSON.parse(await readFile(archivePath, "utf8")) as {
      ciphertextBase64: string;
    };
    const replacement = archive.ciphertextBase64[0] === "A" ? "B" : "A";
    archive.ciphertextBase64 = `${replacement}${archive.ciphertextBase64.slice(1)}`;
    await writeFile(archivePath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");

    await expect(
      verifyEncryptedBackupArchive({ archivePath, passphrase }),
    ).resolves.toMatchObject({
      status: "invalid_archive",
      errorCode: "INVALID_ARCHIVE",
    });
  });
});

describe("encrypted restore workflow", () => {
  it("reports restore conflicts without mutating target data", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const archivePath = join(cwd, "backup.rinbackup");

    await createEncryptedBackupArchive({
      layout: storage.layout,
      archivePath,
      passphrase,
    });

    const report = await planEncryptedRestore({
      archivePath,
      passphrase,
      targetLayout: storage.layout,
    });

    expect(report).toMatchObject({
      status: "conflict",
      overwriteWouldOccur: true,
      dataMutated: false,
      cloudSyncEnabled: false,
    });
    expect(report.conflicts.length).toBeGreaterThan(0);
  });

  it("requires explicit confirmation before applying restore", async () => {
    const sourceCwd = await createTempRoot();
    const targetCwd = await createTempRoot();
    const source = await initializeRinStorage(defaultEnvironment, { cwd: sourceCwd });
    const targetLayout = createDataLayout(".rin-restored-data", targetCwd);
    const archivePath = join(sourceCwd, "backup.rinbackup");

    await createEncryptedBackupArchive({
      layout: source.layout,
      archivePath,
      passphrase,
    });

    const report = await applyEncryptedRestore({
      archivePath,
      passphrase,
      targetLayout,
    });

    expect(report).toMatchObject({
      status: "confirmation_required",
      dataMutated: false,
      errorCode: "CONFIRMATION_REQUIRED",
    });
    await expect(stat(targetLayout.rootDir)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("applies restore to an empty target and rewrites manifest paths", async () => {
    const sourceCwd = await createTempRoot();
    const targetCwd = await createTempRoot();
    const source = await initializeRinStorage(defaultEnvironment, { cwd: sourceCwd });
    const targetLayout = createDataLayout(".rin-restored-data", targetCwd);
    const archivePath = join(sourceCwd, "backup.rinbackup");

    await writeFile(join(source.layout.rootDir, ".env.local"), "SECRET=value");
    await createEncryptedBackupArchive({
      layout: source.layout,
      archivePath,
      passphrase,
    });

    const dryRun = await planEncryptedRestore({
      archivePath,
      passphrase,
      targetLayout,
    });
    const report = await applyEncryptedRestore({
      archivePath,
      passphrase,
      targetLayout,
      targetDeviceId: "new-local-device",
      confirmationToken: RESTORE_APPLY_CONFIRMATION_TOKEN,
      now: new Date("2026-01-02T00:00:00.000Z"),
    });
    const restoredManifest = JSON.parse(
      await readFile(targetLayout.manifestPath, "utf8"),
    ) as {
      deviceId: string;
      directories: { config: string };
    };

    expect(dryRun).toMatchObject({
      status: "valid",
      dataMutated: false,
      manifestWillBeRewrittenForTarget: true,
    });
    expect(report).toMatchObject({
      status: "applied",
      dataMutated: true,
      manifestRewrittenForTarget: true,
    });
    expect(report.createdFiles).toContain("config/user_model.json");
    expect(restoredManifest.deviceId).toBe("new-local-device");
    expect(restoredManifest.directories.config).toBe(
      targetLayout.directories.config,
    );
    expect(restoredManifest.directories.config).not.toContain(sourceCwd);
    await expect(stat(join(targetLayout.rootDir, ".env.local"))).rejects
      .toMatchObject({ code: "ENOENT" });
    await expect(
      planEncryptedRestore({ archivePath, passphrase, targetLayout }),
    ).resolves.toMatchObject({
      status: "conflict",
      dataMutated: false,
    });
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-encrypted-backup-"));
  tempRoots.push(root);
  return root;
}
