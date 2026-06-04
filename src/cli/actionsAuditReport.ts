import { buildActionAuditReport, formatActionAuditReport } from "../actions";
import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const database = openRinDatabase(storage.layout);

try {
  console.log(formatActionAuditReport(buildActionAuditReport(database)));
} finally {
  database.close();
}
