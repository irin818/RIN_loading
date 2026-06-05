import { loadEnvironment } from "../config/loadEnvironment";
import { buildContextV2ReportFromStorage, formatContextV2Report } from "../context";
import { openRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const database = openRinDatabase(storage.layout);

try {
  const report = await buildContextV2ReportFromStorage(
    database,
    storage.layout,
  );
  console.log(formatContextV2Report(report));
} finally {
  database.close();
}
