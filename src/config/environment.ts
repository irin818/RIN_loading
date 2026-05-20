export type RinEnvironment = {
  ownerId: string;
  deviceId: string;
  dataDir: string;
};

export const defaultEnvironment: RinEnvironment = {
  ownerId: "local-owner",
  deviceId: "local-device",
  dataDir: ".rin-data",
};
