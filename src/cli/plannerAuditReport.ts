import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import { buildPlannerAuditReport, formatPlannerAuditReport } from "../planner";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const database = openRinDatabase(storage.layout);

try {
  console.log(formatPlannerAuditReport(buildPlannerAuditReport(database)));
} finally {
  database.close();
}
