import { buildBackupDryRunManifest, formatBackupDryRunManifest } from "../backup";
import { loadEnvironment } from "../config/loadEnvironment";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());
const manifest = await buildBackupDryRunManifest(storage.layout);

console.log(formatBackupDryRunManifest(manifest));
