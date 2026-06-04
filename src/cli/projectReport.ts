import {
  buildProjectAssistantReport,
  formatProjectAssistantReport,
} from "../project";

const report = await buildProjectAssistantReport();

console.log(formatProjectAssistantReport(report));
