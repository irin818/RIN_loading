import { loadEnvironment } from "../config/loadEnvironment";
import { buildProfileReport, formatProfileReport } from "../profile";
import { initializeRinStorage } from "../storage";

const environment = loadEnvironment();
const storage = await initializeRinStorage(environment);
const report = await buildProfileReport(storage.layout);

console.log(formatProfileReport(report));
