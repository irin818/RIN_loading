import {
  buildToolRegistrySmokeReport,
  formatToolRegistrySmokeReport,
  registerBuiltinTools,
} from "../tools";

registerBuiltinTools();

console.log(formatToolRegistrySmokeReport(buildToolRegistrySmokeReport()));
