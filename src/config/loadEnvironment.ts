import { defaultEnvironment, type RinEnvironment } from "./environment";

export type EnvironmentSource = Record<string, string | undefined>;

export function loadEnvironment(
  source: EnvironmentSource = process.env,
): RinEnvironment {
  return {
    ownerId: source.RIN_OWNER_ID ?? defaultEnvironment.ownerId,
    deviceId: source.RIN_DEVICE_ID ?? defaultEnvironment.deviceId,
    dataDir: source.RIN_DATA_DIR ?? defaultEnvironment.dataDir,
  };
}
