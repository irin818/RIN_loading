import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import { buildToolAuditReport, formatToolAuditReport } from "../tools";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const database = openRinDatabase(storage.layout);

try {
  console.log(formatToolAuditReport(buildToolAuditReport(database)));
} finally {
  database.close();
}
