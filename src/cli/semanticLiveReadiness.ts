import {
  formatSemanticLiveReadinessReport,
  getSemanticLiveReadinessReport,
} from "../memory/semanticLiveReadiness";

const report = await getSemanticLiveReadinessReport();

console.log(formatSemanticLiveReadinessReport(report));
