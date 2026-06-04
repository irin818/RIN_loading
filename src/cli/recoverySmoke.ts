import { buildRecoverySmokeReport, formatRecoverySmokeReport } from "../reliability";

console.log(formatRecoverySmokeReport(await buildRecoverySmokeReport()));
