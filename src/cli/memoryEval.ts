import {
  formatMemoryEvaluationSummary,
  runBuiltInMemoryEvaluation,
} from "../memory/evaluation";

const result = runBuiltInMemoryEvaluation();

console.log(formatMemoryEvaluationSummary(result));

if (result.failed > 0) {
  for (const caseResult of result.caseResults) {
    if (caseResult.passed) {
      continue;
    }

    console.log("");
    console.log(`[failed] ${caseResult.caseId}`);
    for (const failure of caseResult.failures) {
      console.log(`- ${failure}`);
    }
  }

  process.exitCode = 1;
}
