import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildProjectAssistantReport,
  formatProjectAssistantReport,
} from "./projectReport";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("buildProjectAssistantReport", () => {
  it("inspects safe project metadata without full text or generated directories", async () => {
    const root = await createTempRoot();
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "rin-test",
        scripts: {
          "rin:check": "echo check",
          "rin:external-model-smoke": "echo smoke",
          dev: "vite",
        },
      }),
    );
    await writeFile(join(root, "PROJECT_CHARTER.md"), "private charter text");
    await writeFile(join(root, "README.md"), "private readme text");
    await writeFile(join(root, ".env.example"), "RIN_OPENAI_COMPATIBLE_API_KEY=");
    await mkdir(join(root, "src/module"), { recursive: true });
    await writeFile(join(root, "src/module/index.ts"), "export const value = 1;");
    await mkdir(join(root, "node_modules/package"), { recursive: true });
    await writeFile(join(root, "node_modules/package/index.js"), "ignored");

    const report = await buildProjectAssistantReport(root);
    const summary = formatProjectAssistantReport(report);

    expect(report.packageName).toBe("rin-test");
    expect(report.relevantScripts).toEqual([
      "rin:check",
      "rin:external-model-smoke",
    ]);
    expect(report.governanceFilesPresent).toContain("PROJECT_CHARTER.md");
    expect(report.sourceFileCount).toBe(1);
    expect(report.providerCallCount).toBe(0);
    expect(report.externalNetworkUsed).toBe(false);
    expect(report.fullTextIncluded).toBe(false);
    expect(summary).not.toContain("private charter text");
    expect(summary).not.toContain(root);
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-project-report-"));
  tempRoots.push(root);
  return root;
}
