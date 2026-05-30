import { randomUUID } from "node:crypto";
import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { RinEnvironment } from "../config/environment";
import { appendAuditEvent, openRinDatabase } from "../database";
import {
  createDataLayout,
  parseRinDataManifest,
  type RinDataLayout,
  type RinDataManifest,
} from "../storage";

export type ImportBundleResult = {
  id: string;
  bundlePath: string;
  targetDataDir: string;
  manifestPath: string;
  importedAt: string;
};

type BundleManifest = {
  bundleId: string;
  createdAt: string;
  sourceManifest: RinDataManifest;
  includes: string[];
};

export async function importAgentStateBundle(input: {
  bundlePath: string;
  environment: RinEnvironment;
  cwd?: string;
  now?: Date;
}): Promise<ImportBundleResult> {
  const now = input.now ?? new Date();
  const importedAt = now.toISOString();
  const bundlePath = resolve(input.cwd ?? process.cwd(), input.bundlePath);
  const bundleManifest = await readBundleManifest(bundlePath);
  const layout = createDataLayout(input.environment.dataDir, input.cwd);

  await assertImportTargetAvailable(layout);
  await mkdir(layout.rootDir, { recursive: true });
  await Promise.all(
    Object.values(layout.directories).map((directory) =>
      mkdir(directory, { recursive: true }),
    ),
  );
  await cp(join(bundlePath, "config"), layout.directories.config, {
    recursive: true,
  });
  await cp(join(bundlePath, "databases"), layout.directories.databases, {
    recursive: true,
  });
  await writeFile(join(layout.directories.logs, "audit_log.jsonl"), "", {
    encoding: "utf8",
    flag: "a",
  });

  const restoredManifest: RinDataManifest = {
    ...bundleManifest.sourceManifest,
    ownerId: bundleManifest.sourceManifest.ownerId,
    deviceId: input.environment.deviceId,
    createdAt: importedAt,
    updatedAt: importedAt,
    directories: layout.directories,
  };

  await writeFile(
    layout.manifestPath,
    `${JSON.stringify(restoredManifest, null, 2)}\n`,
    "utf8",
  );

  const id = randomUUID();
  const database = openRinDatabase(layout);
  try {
    appendAuditEvent(database, {
      eventType: "bundle.imported",
      payload: {
        importId: id,
        bundleId: bundleManifest.bundleId,
        bundlePath,
        targetDataDir: layout.rootDir,
      },
      now,
    });
  } finally {
    database.close();
  }

  return {
    id,
    bundlePath,
    targetDataDir: layout.rootDir,
    manifestPath: layout.manifestPath,
    importedAt,
  };
}

async function readBundleManifest(bundlePath: string): Promise<BundleManifest> {
  const parsed = JSON.parse(
    await readFile(join(bundlePath, "manifest.json"), "utf8"),
  ) as unknown;

  if (!isBundleManifest(parsed)) {
    throw new Error(`Invalid Agent State Bundle manifest: ${bundlePath}`);
  }

  await assertDirectory(join(bundlePath, "config"));
  await assertDirectory(join(bundlePath, "databases"));

  return parsed;
}

async function assertImportTargetAvailable(layout: RinDataLayout): Promise<void> {
  try {
    const targetStat = await stat(layout.rootDir);

    if (!targetStat.isDirectory()) {
      throw new Error(`Import target is not a directory: ${layout.rootDir}`);
    }

    const entries = await readdir(layout.rootDir);

    if (entries.length > 0) {
      throw new Error(
        `Import target must be a new empty data directory: ${layout.rootDir}`,
      );
    }
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }

    throw error;
  }
}

async function assertDirectory(directoryPath: string): Promise<void> {
  const directoryStat = await stat(directoryPath);

  if (!directoryStat.isDirectory()) {
    throw new Error(`Expected bundle directory: ${directoryPath}`);
  }
}

function isBundleManifest(value: unknown): value is BundleManifest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<BundleManifest>;

  return (
    typeof candidate.bundleId === "string" &&
    typeof candidate.createdAt === "string" &&
    Array.isArray(candidate.includes) &&
    candidate.includes.includes("config") &&
    candidate.includes.includes("databases") &&
    parseBundleSourceManifest(candidate.sourceManifest)
  );
}

function parseBundleSourceManifest(value: unknown): value is RinDataManifest {
  try {
    parseRinDataManifest(JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
