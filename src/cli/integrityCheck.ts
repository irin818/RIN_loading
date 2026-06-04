import { buildIntegrityCheckReport, formatIntegrityCheckReport } from "../reliability";

console.log(formatIntegrityCheckReport(await buildIntegrityCheckReport()));
