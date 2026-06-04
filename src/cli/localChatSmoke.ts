import { formatLocalChatSmokeReport, runLocalChatSmoke } from "../model";

const report = await runLocalChatSmoke();

console.log(formatLocalChatSmokeReport(report));

if (report.status === "failed") {
  process.exitCode = 1;
}
