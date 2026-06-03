import {
  formatSemanticComparisonSummary,
  runBuiltInSemanticComparisonEvaluation,
} from "../memory/semanticEvaluation";

const result = runBuiltInSemanticComparisonEvaluation();

console.log(formatSemanticComparisonSummary(result));

if (result.failed > 0) {
  for (const caseResult of result.caseResults) {
    if (caseResult.passed) {
      continue;
    }

    console.log("");
    console.log(`[failed] ${caseResult.caseId}`);
    for (const failure of caseResult.failureMessages) {
      console.log(`- ${failure}`);
    }
  }

  process.exitCode = 1;
}
