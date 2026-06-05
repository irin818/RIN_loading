import { readFile } from "node:fs/promises";
import { loadEnvironment } from "../config/loadEnvironment";
import { inspectRinDatabase } from "../database";
import {
  createDataLayout,
  inspectCoreStateFiles,
  parseRinDataManifest,
} from "../storage";
import { formatStatusLine } from "./format";

const environment = loadEnvironment();
const layout = createDataLayout(environment.dataDir);
const statuses = await inspectCoreStateFiles(layout);
const missing = statuses.filter((status) => !status.exists);
let databaseStatus: ReturnType<typeof inspectRinDatabase> | null = null;
let manifestOk = false;

try {
  parseRinDataManifest(await readFile(layout.manifestPath, "utf8"));
  manifestOk = true;
} catch {
  manifestOk = false;
}

try {
  databaseStatus = inspectRinDatabase(layout);
} catch {
  databaseStatus = null;
}

console.log("RIN local data inspection.");
console.log("RIN 本地数据检查。");
console.log("");
console.log(`Data directory / 数据目录: ${layout.rootDir}`);
console.log(
  `Manifest / Manifest 文件: ${manifestOk ? "ok / 正常" : "missing-or-invalid / 缺失或无效"}`,
);
console.log(`Database / 数据库: ${databaseStatus ? "ok / 正常" : "invalid / 无效"}`);
if (databaseStatus) {
  console.log(`Database path / 数据库路径: ${databaseStatus.path}`);
  console.log(`Database schema / 数据库 schema: ${databaseStatus.schemaVersion}`);
  console.log(
    `Counts / 计数: conversations=${databaseStatus.counts.conversations}, conversationTurns=${databaseStatus.counts.conversationTurns}, messages=${databaseStatus.counts.messages}, memoryItems=${databaseStatus.counts.memoryItems}, auditEvents=${databaseStatus.counts.auditEvents}`,
  );
}
console.log("");
console.log("Core files / 核心文件:");
console.log(statuses.map(formatStatusLine).join("\n"));

if (missing.length > 0 || !manifestOk) {
  console.log("");
  console.log("Some local data files are missing or invalid. Run `npm run rin:init`.");
  console.log("有本地数据文件缺失或无效。请运行 `npm run rin:init`。");
  process.exitCode = 1;
}
