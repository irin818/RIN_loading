import { buildOpsHealthReport, formatOpsHealthReport } from "../reliability";

console.log(formatOpsHealthReport(await buildOpsHealthReport()));
