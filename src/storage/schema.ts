export const RIN_STORAGE_SCHEMA_VERSION = 1;

export const RIN_STORAGE_DIRECTORIES = [
  "config",
  "databases",
  "logs",
  "bundles",
  "attachments",
] as const;

export type RinStorageDirectoryName = (typeof RIN_STORAGE_DIRECTORIES)[number];
