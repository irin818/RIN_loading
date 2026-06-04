import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import {
  buildMemoryHealthReport,
  formatMemoryHealthReport,
  listMemoryItems,
} from "../memory";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const database = openRinDatabase(storage.layout);

try {
  const memories = listMemoryItems(database, { limit: 100 });
  console.log(formatMemoryHealthReport(buildMemoryHealthReport(memories)));
} finally {
  database.close();
}
