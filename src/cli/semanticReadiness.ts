import {
  formatSemanticReadinessReport,
  getSemanticReadinessReport,
} from "../memory/semanticReadiness";

const report = getSemanticReadinessReport();

console.log(formatSemanticReadinessReport(report));

if (!report.ready) {
  process.exitCode = 1;
}
