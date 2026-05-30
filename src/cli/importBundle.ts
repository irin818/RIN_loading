import { importAgentStateBundle } from "../bundle";
import { loadEnvironment } from "../config/loadEnvironment";

const bundlePath = process.env.RIN_BUNDLE_PATH;

if (!bundlePath) {
  throw new Error("RIN_BUNDLE_PATH is required for bundle import.");
}

const baseEnvironment = loadEnvironment();
const environment = {
  ...baseEnvironment,
  dataDir: process.env.RIN_IMPORT_DATA_DIR ?? ".rin-imported-data",
};
const result = await importAgentStateBundle({
  bundlePath,
  environment,
});

console.log("RIN Agent State Bundle imported.");
console.log("RIN Agent State Bundle 已导入。");
console.log("");
console.log(`Bundle path / Bundle 路径: ${result.bundlePath}`);
console.log(`Target data directory / 目标数据目录: ${result.targetDataDir}`);
console.log(`Manifest / Manifest 文件: ${result.manifestPath}`);
