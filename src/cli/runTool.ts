import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";
import { executeRegisteredTool, registerBuiltinTools } from "../tools";

registerBuiltinTools();

const toolId = process.argv[2] ?? "rin.local.status";
const storage = await initializeRinStorage(loadEnvironment());
const database = openRinDatabase(storage.layout);

try {
  const result = await executeRegisteredTool(database, toolId, {});

  console.log("RIN tool execution result.");
  console.log("RIN 工具执行结果。");
  console.log("");
  console.log(JSON.stringify(result, null, 2));
} finally {
  database.close();
}
