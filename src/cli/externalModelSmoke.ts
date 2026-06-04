import { loadEnvironment, loadEnvironmentSource } from "../config/loadEnvironment";
import {
  formatExternalModelSmokeReport,
  loadModelRuntimeConfig,
  runExternalModelSmoke,
} from "../model";
import { createDataLayout } from "../storage";

const source = loadEnvironmentSource();
const environment = loadEnvironment(source);
const layout = createDataLayout(environment.dataDir);
const config = await loadModelRuntimeConfig(layout);
const report = await runExternalModelSmoke({ config, source });

console.log(formatExternalModelSmokeReport(report));

if (
  report.status !== "ready" &&
  report.status !== "skipped_not_selected"
) {
  process.exitCode = 1;
}
