import { join, resolve } from "node:path";
import {
  RIN_STORAGE_DIRECTORIES,
  type RinStorageDirectoryName,
} from "./schema";

export type RinDataLayout = {
  rootDir: string;
  manifestPath: string;
  directories: Record<RinStorageDirectoryName, string>;
};

export function createDataLayout(
  dataDir: string,
  cwd: string = process.cwd(),
): RinDataLayout {
  const rootDir = resolve(cwd, dataDir);
  const directories = Object.fromEntries(
    RIN_STORAGE_DIRECTORIES.map((name) => [name, join(rootDir, name)]),
  ) as Record<RinStorageDirectoryName, string>;

  return {
    rootDir,
    manifestPath: join(rootDir, "manifest.json"),
    directories,
  };
}
