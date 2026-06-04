import { buildBackupDryRunManifest } from "../backup";
import { loadEnvironment } from "../config/loadEnvironment";
import { buildSyncDryRunReport, formatSyncDryRunReport } from "../sync";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const backupManifest = await buildBackupDryRunManifest(storage.layout);

console.log(
  formatSyncDryRunReport(
    buildSyncDryRunReport({ manifest: storage.manifest, backupManifest }),
  ),
);
