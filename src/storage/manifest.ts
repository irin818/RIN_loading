import type { RinEnvironment } from "../config/environment";
import { RIN_PROJECT_NAME } from "../core/project";
import {
  RIN_STORAGE_SCHEMA_VERSION,
  type RinStorageDirectoryName,
} from "./schema";

export type RinDataManifest = {
  project: typeof RIN_PROJECT_NAME;
  schemaVersion: typeof RIN_STORAGE_SCHEMA_VERSION;
  ownerId: string;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
  directories: Record<RinStorageDirectoryName, string>;
};

export function createInitialManifest(
  environment: RinEnvironment,
  directories: Record<RinStorageDirectoryName, string>,
  now: Date,
): RinDataManifest {
  const timestamp = now.toISOString();

  return {
    project: RIN_PROJECT_NAME,
    schemaVersion: RIN_STORAGE_SCHEMA_VERSION,
    ownerId: environment.ownerId,
    deviceId: environment.deviceId,
    createdAt: timestamp,
    updatedAt: timestamp,
    directories,
  };
}

export function refreshManifest(
  existing: RinDataManifest,
  directories: Record<RinStorageDirectoryName, string>,
  now: Date,
): RinDataManifest {
  return {
    ...existing,
    updatedAt: now.toISOString(),
    directories,
  };
}

export function isRinDataManifest(value: unknown): value is RinDataManifest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RinDataManifest>;

  return (
    candidate.project === RIN_PROJECT_NAME &&
    candidate.schemaVersion === RIN_STORAGE_SCHEMA_VERSION &&
    typeof candidate.ownerId === "string" &&
    typeof candidate.deviceId === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.directories === "object" &&
    candidate.directories !== null
  );
}

export function parseRinDataManifest(rawManifest: string): RinDataManifest {
  const parsedManifest: unknown = JSON.parse(rawManifest);

  if (!isRinDataManifest(parsedManifest)) {
    throw new Error("Invalid RIN data manifest.");
  }

  return parsedManifest;
}
