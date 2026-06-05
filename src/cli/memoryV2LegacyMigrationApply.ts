import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import {
  applyMemoryV2LegacyMigration,
  formatMemoryV2LegacyMigrationReport,
} from "../memory";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const database = openRinDatabase(storage.layout);

try {
  console.log(
    formatMemoryV2LegacyMigrationReport(
      applyMemoryV2LegacyMigration(database),
    ),
  );
} finally {
  database.close();
}
