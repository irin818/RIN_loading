import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import {
  formatMemoryV2ShadowReport,
  runMemoryV2ShadowEngine,
} from "../memory";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const database = openRinDatabase(storage.layout);

try {
  console.log(formatMemoryV2ShadowReport(runMemoryV2ShadowEngine(database)));
} finally {
  database.close();
}
