import {
  formatDailyChatEvaluationReport,
  runDailyChatEvaluation,
} from "../model";

const report = runDailyChatEvaluation();

console.log(formatDailyChatEvaluationReport(report));

if (report.status === "failed") {
  process.exitCode = 1;
}
