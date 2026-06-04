import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export type ProjectAssistantReport = {
  mode: "project-assistant-report";
  status: "ready";
  packageName: string | null;
  scriptCount: number;
  relevantScripts: string[];
  governanceFilesPresent: string[];
  governanceFilesMissing: string[];
  sourceDirectoryCount: number;
  sourceFileCount: number;
  generatedDirectoriesExcluded: string[];
  providerCallCount: 0;
  externalNetworkUsed: false;
  fullTextIncluded: false;
};

const GOVERNANCE_FILES = [
  "AGENTS.md",
  "PROJECT_CHARTER.md",
  "ARCHITECTURE.md",
  "DEVELOPMENT_PROTOCOL.md",
  "README.md",
  ".env.example",
] as const;

const RELEVANT_SCRIPT_PREFIXES = [
  "rin:",
  "live2d:",
] as const;

const EXCLUDED_DIRECTORIES = [
  ".git",
  ".rin-data",
  "dist",
  "node_modules",
] as const;

export async function buildProjectAssistantReport(
  workspaceRoot: string = process.cwd(),
): Promise<ProjectAssistantReport> {
  const packageJson = await readPackageJson(workspaceRoot);
  const scripts = readScripts(packageJson);
  const sourceStats = await countSourceFiles(join(workspaceRoot, "src"));
  const governanceStatus = await inspectGovernanceFiles(workspaceRoot);

  return {
    mode: "project-assistant-report",
    status: "ready",
    packageName: readPackageName(packageJson),
    scriptCount: scripts.length,
    relevantScripts: scripts
      .filter((script) =>
        RELEVANT_SCRIPT_PREFIXES.some((prefix) => script.startsWith(prefix)),
      )
      .sort(),
    governanceFilesPresent: governanceStatus.present,
    governanceFilesMissing: governanceStatus.missing,
    sourceDirectoryCount: sourceStats.directoryCount,
    sourceFileCount: sourceStats.fileCount,
    generatedDirectoriesExcluded: [...EXCLUDED_DIRECTORIES],
    providerCallCount: 0,
    externalNetworkUsed: false,
    fullTextIncluded: false,
  };
}

export function formatProjectAssistantReport(
  report: ProjectAssistantReport,
): string {
  return [
    "RIN project assistant report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Package: ${report.packageName ?? "unknown"}`,
    `Scripts: ${report.scriptCount}`,
    `Source directories: ${report.sourceDirectoryCount}`,
    `Source files: ${report.sourceFileCount}`,
    `providerCallCount: ${report.providerCallCount}`,
    `External network used: ${report.externalNetworkUsed ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Relevant scripts:",
    ...formatList(report.relevantScripts),
    "Governance files present:",
    ...formatList(report.governanceFilesPresent),
    "Governance files missing:",
    ...formatList(report.governanceFilesMissing),
    "Generated directories excluded:",
    ...formatList(report.generatedDirectoriesExcluded),
  ].join("\n");
}

async function readPackageJson(
  workspaceRoot: string,
): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(join(workspaceRoot, "package.json"), "utf8")) as
      | Record<string, unknown>
      | null;
  } catch {
    return null;
  }
}

function readPackageName(packageJson: Record<string, unknown> | null): string | null {
  return typeof packageJson?.name === "string" ? packageJson.name : null;
}

function readScripts(packageJson: Record<string, unknown> | null): string[] {
  if (
    typeof packageJson?.scripts !== "object" ||
    packageJson.scripts === null ||
    Array.isArray(packageJson.scripts)
  ) {
    return [];
  }

  return Object.keys(packageJson.scripts).sort();
}

async function inspectGovernanceFiles(workspaceRoot: string): Promise<{
  present: string[];
  missing: string[];
}> {
  const results = await Promise.all(
    GOVERNANCE_FILES.map(async (fileName) => ({
      fileName,
      exists: await fileExists(join(workspaceRoot, fileName)),
    })),
  );

  return {
    present: results
      .filter((result) => result.exists)
      .map((result) => result.fileName),
    missing: results
      .filter((result) => !result.exists)
      .map((result) => result.fileName),
  };
}

async function countSourceFiles(directoryPath: string): Promise<{
  directoryCount: number;
  fileCount: number;
}> {
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    let directoryCount = 1;
    let fileCount = 0;

    for (const entry of entries) {
      if (EXCLUDED_DIRECTORIES.includes(entry.name as never)) {
        continue;
      }

      if (entry.isDirectory()) {
        const child = await countSourceFiles(join(directoryPath, entry.name));
        directoryCount += child.directoryCount;
        fileCount += child.fileCount;
      } else if (entry.isFile()) {
        fileCount += 1;
      }
    }

    return { directoryCount, fileCount };
  } catch {
    return { directoryCount: 0, fileCount: 0 };
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function formatList(values: readonly string[]): string[] {
  if (values.length === 0) {
    return ["none"];
  }

  return values.map((value) => `- ${value}`);
}
