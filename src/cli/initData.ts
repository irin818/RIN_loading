import { loadEnvironment } from "../config/loadEnvironment";
import { initializeRinStorage } from "../storage";
import { formatStatusLine } from "./format";

const environment = loadEnvironment();
const result = await initializeRinStorage(environment);

console.log("RIN local data initialized.");
console.log("RIN 本地数据已初始化。");
console.log("");
console.log(`Data directory / 数据目录: ${result.layout.rootDir}`);
console.log(`Manifest / Manifest 文件: ${result.layout.manifestPath}`);
console.log(
  `Manifest status / Manifest 状态: ${result.created ? "created / 已创建" : "updated / 已更新"}`,
);
console.log(`Database / 数据库: ${result.database.path}`);
console.log(
  `Database schema / 数据库 schema: ${result.database.schemaVersion}`,
);
console.log("");
console.log("Core files / 核心文件:");
console.log(result.coreFiles.map(formatStatusLine).join("\n"));
