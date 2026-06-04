import { loadEnvironment } from "../config/loadEnvironment";
import { buildDeviceReport, formatDeviceReport } from "../sync";
import { initializeRinStorage } from "../storage";

const storage = await initializeRinStorage(loadEnvironment());

console.log(formatDeviceReport(buildDeviceReport(storage.manifest)));
