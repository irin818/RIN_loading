import { loadEnvironment } from "../config/loadEnvironment";
import { formatProfileReport, validateProfiles } from "../profile";
import { initializeRinStorage } from "../storage";

const environment = loadEnvironment();
const storage = await initializeRinStorage(environment);
const report = await validateProfiles(storage.layout);

console.log(formatProfileReport(report));

if (report.status !== "valid") {
  process.exitCode = 1;
}
