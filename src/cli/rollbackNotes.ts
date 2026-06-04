import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import { buildRollbackNotesReport, formatRollbackNotesReport } from "../project";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const database = openRinDatabase(storage.layout);

try {
  console.log(formatRollbackNotesReport(buildRollbackNotesReport(database)));
} finally {
  database.close();
}
