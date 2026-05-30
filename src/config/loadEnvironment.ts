import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultEnvironment, type RinEnvironment } from "./environment";

export type EnvironmentSource = Record<string, string | undefined>;

export function loadEnvironment(
  source: EnvironmentSource = loadEnvironmentSource(),
): RinEnvironment {
  return {
    ownerId: source.RIN_OWNER_ID ?? defaultEnvironment.ownerId,
    deviceId: source.RIN_DEVICE_ID ?? defaultEnvironment.deviceId,
    dataDir: source.RIN_DATA_DIR ?? defaultEnvironment.dataDir,
  };
}

export function loadEnvironmentSource(
  cwd: string = process.cwd(),
  source: EnvironmentSource = process.env,
): EnvironmentSource {
  return {
    ...readLocalEnvFile(cwd),
    ...source,
  };
}

function readLocalEnvFile(cwd: string): EnvironmentSource {
  try {
    return parseEnvFile(readFileSync(join(cwd, ".env"), "utf8"));
  } catch {
    return {};
  }
}

function parseEnvFile(raw: string): EnvironmentSource {
  const entries: EnvironmentSource = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      entries[key] = unquoteEnvValue(value);
    }
  }

  return entries;
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
