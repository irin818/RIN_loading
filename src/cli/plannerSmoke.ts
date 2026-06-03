import { formatPlannerSmokeReport, runBuiltInPlannerSmoke } from "../planner";

const report = runBuiltInPlannerSmoke();

console.log(formatPlannerSmokeReport(report));
