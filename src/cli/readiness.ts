import { readRinReadiness } from "../readiness";

const report = await readRinReadiness();

console.log("RIN readiness report.");
console.log("RIN 就绪检查报告。");
console.log("");
for (const check of report.checks) {
  console.log(`[${check.status}] ${check.key}`);
  console.log(`  ${check.english}`);
  console.log(`  ${check.chinese}`);
}

if (report.missingEnvironment.length > 0) {
  console.log("");
  console.log(
    `Missing environment / 缺少环境变量: ${report.missingEnvironment.join(", ")}`,
  );
}

console.log("");
console.log(`Ready / 就绪: ${report.ok ? "yes" : "no"}`);
console.log(
  `External model ready / 外部模型就绪: ${
    report.readyForExternalModel ? "yes" : "no"
  }`,
);

if (!report.ok) {
  process.exitCode = 1;
}
