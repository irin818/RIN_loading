import {
  formatMemoryV2EvaluationSummary,
  runBuiltInMemoryV2Evaluation,
} from "../memory";

const result = runBuiltInMemoryV2Evaluation();

console.log(formatMemoryV2EvaluationSummary(result));

if (result.failed > 0) {
  process.exitCode = 1;
}
