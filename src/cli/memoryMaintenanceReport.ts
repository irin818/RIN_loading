import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import {
  analyzeMemoryMaintenance,
  formatMemoryMaintenanceReport,
  listMemoryItems,
} from "../memory";
import { initializeRinStorage } from "../storage";

const environment = loadEnvironment();
const storage = await initializeRinStorage(environment);
const database = openRinDatabase(storage.layout);

try {
  const memories = listMemoryItems(database, { limit: 100 });
  const report = analyzeMemoryMaintenance(memories);
  console.log(formatMemoryMaintenanceReport(report));
} finally {
  database.close();
}
