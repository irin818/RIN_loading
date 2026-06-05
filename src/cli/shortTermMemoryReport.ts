import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import {
  buildShortTermMemoryReport,
  formatShortTermMemoryReport,
} from "../memory";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const database = openRinDatabase(storage.layout);

try {
  console.log(formatShortTermMemoryReport(buildShortTermMemoryReport(database)));
} finally {
  database.close();
}
