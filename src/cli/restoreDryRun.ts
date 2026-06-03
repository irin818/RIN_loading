import { formatRestoreDryRunReport, validateRestoreDryRun } from "../backup";
import { loadEnvironment } from "../config/loadEnvironment";
import { createDataLayout } from "../storage";

const manifestPath = process.argv[2];
const environment = loadEnvironment();
const targetLayout = createDataLayout(environment.dataDir);
const report = await validateRestoreDryRun({ manifestPath, targetLayout });

console.log(formatRestoreDryRunReport(report));
