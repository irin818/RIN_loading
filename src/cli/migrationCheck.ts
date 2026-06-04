import { buildBackupDryRunManifest } from "../backup";
import { loadEnvironment } from "../config/loadEnvironment";
import { buildMigrationCheckReport, formatMigrationCheckReport } from "../sync";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const backupManifest = await buildBackupDryRunManifest(storage.layout);

console.log(
  formatMigrationCheckReport(
    buildMigrationCheckReport({ manifest: storage.manifest, backupManifest }),
  ),
);
