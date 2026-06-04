import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import { buildTaskAuditReport, formatTaskAuditReport } from "../tasks";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const database = openRinDatabase(storage.layout);

try {
  console.log(formatTaskAuditReport(buildTaskAuditReport(database)));
} finally {
  database.close();
}
