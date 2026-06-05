import { loadEnvironment } from "../config/loadEnvironment";
import { openRinDatabase } from "../database";
import {
  buildMemoryV2LegacyMigrationDryRunReport,
  formatMemoryV2LegacyMigrationReport,
} from "../memory";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const database = openRinDatabase(storage.layout);

try {
  console.log(
    formatMemoryV2LegacyMigrationReport(
      buildMemoryV2LegacyMigrationDryRunReport(database),
    ),
  );
} finally {
  database.close();
}
