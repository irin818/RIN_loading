import { exportAgentStateBundle } from "../bundle";
import { loadEnvironment } from "../config/loadEnvironment";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const bundle = await exportAgentStateBundle(storage.layout);

console.log("RIN Agent State Bundle exported.");
console.log("RIN Agent State Bundle 已导出。");
console.log("");
console.log(`Bundle path / Bundle 路径: ${bundle.bundlePath}`);
console.log(`Manifest / Manifest 文件: ${bundle.manifestPath}`);
