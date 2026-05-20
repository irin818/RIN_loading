import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { RinEnvironment } from "../config/environment";
import { initializeRinDatabase, type DatabaseStatus } from "../database";
import {
  createInitialManifest,
  isRinDataManifest,
  refreshManifest,
  parseRinDataManifest,
  type RinDataManifest,
} from "./manifest";
import { createDataLayout, type RinDataLayout } from "./paths";
import { ensureCoreStateFiles, type CoreStateFileStatus } from "./coreFiles";

export type InitializeStorageOptions = {
  cwd?: string;
  now?: () => Date;
};

export type InitializeStorageResult = {
  layout: RinDataLayout;
  manifest: RinDataManifest;
  coreFiles: CoreStateFileStatus[];
  database: DatabaseStatus;
  created: boolean;
};

export async function initializeRinStorage(
  environment: RinEnvironment,
  options: InitializeStorageOptions = {},
): Promise<InitializeStorageResult> {
  const now = options.now ?? (() => new Date());
  const layout = createDataLayout(environment.dataDir, options.cwd);

  await mkdir(layout.rootDir, { recursive: true });
  await Promise.all(
    Object.values(layout.directories).map((directory) =>
      mkdir(directory, { recursive: true }),
    ),
  );

  const existingManifest = await readExistingManifest(layout.manifestPath);
  const created = existingManifest === null;
  const manifest =
    existingManifest === null
      ? createInitialManifest(environment, layout.directories, now())
      : refreshManifest(existingManifest, layout.directories, now());
  const coreFiles = await ensureCoreStateFiles(environment, layout, now());
  const database = await initializeRinDatabase(layout, now());

  await writeFile(
    layout.manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return { layout, manifest, coreFiles, database, created };
}

async function readExistingManifest(
  manifestPath: string,
): Promise<RinDataManifest | null> {
  try {
    const rawManifest = await readFile(manifestPath, "utf8");
    const parsedManifest = parseRinDataManifest(rawManifest);

    if (!isRinDataManifest(parsedManifest)) {
      throw new Error(`Invalid RIN data manifest: ${manifestPath}`);
    }

    return parsedManifest;
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
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
