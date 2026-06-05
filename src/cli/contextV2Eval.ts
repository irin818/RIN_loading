import {
  formatContextV2EvaluationSummary,
  runBuiltInContextV2Evaluation,
} from "../context";

const result = runBuiltInContextV2Evaluation();

console.log(formatContextV2EvaluationSummary(result));

if (result.failed > 0) {
  process.exitCode = 1;
}
