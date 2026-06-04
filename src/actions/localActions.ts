import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { appendAuditEvent, type RinDatabase } from "../database";
import {
  actionAuditEventForDecision,
  decideActionPermission,
  type ActionAuditEvent,
  type ActionPermissionLevel,
  type ActionRequest,
  type ActionRisk,
  type ForbiddenActionReason,
  type PermissionDecision,
  type PermissionDecisionStatus,
} from "./permissions";

export type LocalActionStatus =
  | "completed"
  | "blocked"
  | "requires_confirmation";

export type LocalActionDefinition = {
  actionId: string;
  actionKind: string;
  risk: ActionRisk;
  requestedPermission: ActionPermissionLevel;
  description: string;
  preview?: (input: unknown, context: LocalActionContext) => Promise<void>;
  execute: (
    input: unknown,
    context: LocalActionContext,
  ) => Promise<LocalActionExecutionPayload>;
};

export type LocalActionContext = {
  database: RinDatabase;
  allowedWorkspaceRoot: string;
  now?: Date;
};

export type LocalActionExecutionPayload = {
  output: Record<string, unknown>;
  auditSummary: Record<string, unknown>;
};

export type LocalActionExecutionResult = {
  mode: "local-action";
  actionId: string;
  actionKind: string;
  status: LocalActionStatus;
  executed: boolean;
  decision: PermissionDecision;
  auditEvent: ActionAuditEvent;
  auditEventId: string;
  output: Record<string, unknown> | null;
  providerCallCount: 0;
  externalNetworkUsed: false;
  fullTextIncluded: false;
};

export type LocalActionPreviewResult = {
  mode: "local-action-preview";
  actionId: string;
  actionKind: string;
  status: PermissionDecisionStatus;
  executed: false;
  decision: PermissionDecision;
  auditEvent: ActionAuditEvent;
  providerCallCount: 0;
  externalNetworkUsed: false;
  fullTextIncluded: false;
};

export type LocalActionsSmokeReport = {
  mode: "actions-smoke";
  status: "ready" | "failed";
  executedActions: number;
  blockedActions: number;
  requiresConfirmationActions: number;
  auditEvents: number;
  createdRelativePaths: string[];
  providerCallCount: 0;
  externalNetworkUsed: false;
  fullTextIncluded: false;
};

export type ActionAuditReport = {
  mode: "actions-audit-report";
  status: "ready";
  totalActionAuditEvents: number;
  completedEvents: number;
  blockedEvents: number;
  requiresConfirmationEvents: number;
  fullTextIncluded: false;
};

const FORBIDDEN_PATH_SEGMENTS = new Set([
  ".git",
  ".rin-data",
  ".rin-imported-data",
  "build",
  "dist",
  "node_modules",
  "temp",
  "tmp",
]);

const FORBIDDEN_FILE_EXTENSIONS = new Set([
  ".db",
  ".sqlite",
  ".sqlite3",
  ".sqlite-journal",
  ".sqlite-shm",
  ".sqlite-wal",
]);

const SAFE_WRITE_EXTENSIONS = new Set([".md", ".txt"]);
const MAX_WRITE_BYTES = 20_000;
const MAX_LISTED_FILES = 100;

const localActions = new Map<string, LocalActionDefinition>();

export function registerLocalAction(action: LocalActionDefinition): void {
  localActions.set(action.actionId, action);
}

export function registerBuiltinLocalActions(): void {
  registerLocalAction({
    actionId: "rin.project.status.read",
    actionKind: "project-status-read",
    risk: "read",
    requestedPermission: "read-only",
    description: "Read a safe project status summary.",
    execute: readProjectStatus,
  });
  registerLocalAction({
    actionId: "rin.workspace.safe-files.list",
    actionKind: "safe-files-list",
    risk: "read",
    requestedPermission: "read-only",
    description: "List safe relative files inside the allowed workspace.",
    execute: listSafeWorkspaceFiles,
  });
  registerLocalAction({
    actionId: "rin.project.package.read",
    actionKind: "package-config-read",
    risk: "read",
    requestedPermission: "read-only",
    description: "Read safe package/config metadata without file contents.",
    preview: previewPackageConfig,
    execute: readPackageConfig,
  });
  registerLocalAction({
    actionId: "rin.docs.file.read",
    actionKind: "docs-file-read",
    risk: "read",
    requestedPermission: "read-only",
    description: "Read safe docs metadata without full text.",
    preview: previewDocsMetadata,
    execute: readDocsMetadata,
  });
  registerLocalAction({
    actionId: "rin.local.report.write",
    actionKind: "local-report-write",
    risk: "draft",
    requestedPermission: "draft-only",
    description: "Write a local draft report into an explicit safe output directory.",
    preview: previewLocalDraftFile,
    execute: writeLocalDraftFile,
  });
  registerLocalAction({
    actionId: "rin.local.note.write",
    actionKind: "local-note-write",
    risk: "draft",
    requestedPermission: "draft-only",
    description: "Write a local note into an explicit safe output directory.",
    preview: previewLocalDraftFile,
    execute: writeLocalDraftFile,
  });
  registerLocalAction({
    actionId: "rin.files.delete",
    actionKind: "file-delete",
    risk: "destructive",
    requestedPermission: "autonomous-within-scope",
    description: "Forbidden delete fixture.",
    execute: async () => {
      throw new LocalActionBlockedError(["destructive_action"]);
    },
  });
}

export function listLocalActions(): LocalActionDefinition[] {
  return [...localActions.values()].sort((left, right) =>
    left.actionId.localeCompare(right.actionId),
  );
}

export async function previewLocalAction(input: {
  actionId: string;
  actionInput?: unknown;
  context: LocalActionContext;
}): Promise<LocalActionPreviewResult> {
  const definition = localActions.get(input.actionId);

  if (!definition) {
    return previewResult({
      request: unknownActionRequest(input.actionId),
      decision: blockedPreviewDecision(input.actionId, ["unknown_action"]),
    });
  }

  const request = requestForDefinition(definition);
  let decision = decideActionPermission(request, { dryRunOnly: true });

  if (decision.status === "allowed" && definition.preview) {
    try {
      await definition.preview(input.actionInput, input.context);
    } catch (error) {
      decision = {
        actionId: definition.actionId,
        status: "blocked",
        grantedPermission: "forbidden",
        reasons:
          error instanceof LocalActionBlockedError
            ? error.reasons
            : ["invalid_action_input"],
        dryRunOnly: true,
      };
    }
  }

  return previewResult({ request, decision });
}

export async function executeLocalAction(input: {
  actionId: string;
  actionInput?: unknown;
  context: LocalActionContext;
}): Promise<LocalActionExecutionResult> {
  const definition = localActions.get(input.actionId);
  const now = input.context.now ?? new Date();

  if (!definition) {
    return blockedLocalAction({
      actionId: input.actionId,
      actionKind: "unknown",
      reasons: ["unknown_action"],
      context: input.context,
      now,
    });
  }

  const request = requestForDefinition(definition);
  const decision = decideActionPermission(request, { dryRunOnly: false });

  if (decision.status !== "allowed") {
    return finalizeLocalAction({
      context: input.context,
      request,
      decision,
      output: null,
      auditSummary: {},
      now,
    });
  }

  try {
    const payload = await definition.execute(input.actionInput, input.context);

    return finalizeLocalAction({
      context: input.context,
      request,
      decision,
      output: payload.output,
      auditSummary: payload.auditSummary,
      now,
    });
  } catch (error) {
    const reasons =
      error instanceof LocalActionBlockedError
        ? error.reasons
        : (["permission_forbidden"] satisfies ForbiddenActionReason[]);
    const blockedDecision: PermissionDecision = {
      actionId: definition.actionId,
      status: "blocked",
      grantedPermission: "forbidden",
      reasons,
      dryRunOnly: false,
    };

    return finalizeLocalAction({
      context: input.context,
      request,
      decision: blockedDecision,
      output: null,
      auditSummary: {},
      now,
    });
  }
}

export async function runLocalActionsSmoke(input: {
  context: LocalActionContext;
}): Promise<LocalActionsSmokeReport> {
  registerBuiltinLocalActions();

  const actions = [
    executeLocalAction({
      actionId: "rin.project.status.read",
      context: input.context,
    }),
    executeLocalAction({
      actionId: "rin.workspace.safe-files.list",
      actionInput: { maxFiles: 20 },
      context: input.context,
    }),
    executeLocalAction({
      actionId: "rin.project.package.read",
      context: input.context,
    }),
    executeLocalAction({
      actionId: "rin.local.report.write",
      actionInput: {
        outputDirectory: "reports",
        fileName: "rin-action-smoke-report.md",
        title: "RIN action smoke report",
        body: "Temporary smoke output for low-risk local action execution.",
      },
      context: input.context,
    }),
    executeLocalAction({
      actionId: "rin.files.delete",
      actionInput: { relativePath: "README.md" },
      context: input.context,
    }),
    executeLocalAction({
      actionId: "rin.unknown.action",
      context: input.context,
    }),
  ];
  const results = await Promise.all(actions);
  const createdRelativePaths = results.flatMap((result) =>
    typeof result.output?.relativePath === "string" ? [result.output.relativePath] : [],
  );

  return {
    mode: "actions-smoke",
    status: results.every((result) => result.status !== "requires_confirmation")
      ? "ready"
      : "failed",
    executedActions: results.filter((result) => result.executed).length,
    blockedActions: results.filter((result) => result.status === "blocked").length,
    requiresConfirmationActions: results.filter(
      (result) => result.status === "requires_confirmation",
    ).length,
    auditEvents: results.length,
    createdRelativePaths,
    providerCallCount: 0,
    externalNetworkUsed: false,
    fullTextIncluded: false,
  };
}

export function buildActionAuditReport(database: RinDatabase): ActionAuditReport {
  const rows = database
    .prepare(
      `
        SELECT event_type
        FROM audit_events
        WHERE event_type IN (
          'action.completed',
          'action.blocked',
          'action.requires_confirmation'
        )
      `,
    )
    .all() as { event_type: string }[];

  return {
    mode: "actions-audit-report",
    status: "ready",
    totalActionAuditEvents: rows.length,
    completedEvents: rows.filter((row) => row.event_type === "action.completed")
      .length,
    blockedEvents: rows.filter((row) => row.event_type === "action.blocked")
      .length,
    requiresConfirmationEvents: rows.filter(
      (row) => row.event_type === "action.requires_confirmation",
    ).length,
    fullTextIncluded: false,
  };
}

export function formatLocalActionsSmokeReport(
  report: LocalActionsSmokeReport,
): string {
  return [
    "RIN actions smoke report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Executed actions: ${report.executedActions}`,
    `Blocked actions: ${report.blockedActions}`,
    `Requires confirmation actions: ${report.requiresConfirmationActions}`,
    `Audit events: ${report.auditEvents}`,
    `providerCallCount: ${report.providerCallCount}`,
    `External network used: ${report.externalNetworkUsed ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Created relative paths:",
    ...formatList(report.createdRelativePaths),
  ].join("\n");
}

export function formatActionAuditReport(report: ActionAuditReport): string {
  return [
    "RIN actions audit report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Total action audit events: ${report.totalActionAuditEvents}`,
    `Completed events: ${report.completedEvents}`,
    `Blocked events: ${report.blockedEvents}`,
    `Requires confirmation events: ${report.requiresConfirmationEvents}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
  ].join("\n");
}

async function readProjectStatus(
  _input: unknown,
  context: LocalActionContext,
): Promise<LocalActionExecutionPayload> {
  const packageSummary = await readPackageSummary(context.allowedWorkspaceRoot);

  return {
    output: {
      kind: "project-status",
      workspaceName: basename(context.allowedWorkspaceRoot),
      hasPackageJson: packageSummary !== null,
      packageName: packageSummary?.name ?? "unknown",
      scriptCount: packageSummary?.scriptNames.length ?? 0,
      fullTextIncluded: false,
    },
    auditSummary: {
      kind: "project-status",
      packageName: packageSummary?.name ?? "unknown",
    },
  };
}

async function listSafeWorkspaceFiles(
  input: unknown,
  context: LocalActionContext,
): Promise<LocalActionExecutionPayload> {
  const maxFiles = Math.min(
    MAX_LISTED_FILES,
    Math.max(1, Number(objectInput(input).maxFiles ?? MAX_LISTED_FILES)),
  );
  const files = await listSafeFiles(context.allowedWorkspaceRoot, maxFiles);

  return {
    output: {
      kind: "safe-files",
      files,
      fileCount: files.length,
      truncated: files.length >= maxFiles,
      fullTextIncluded: false,
    },
    auditSummary: {
      kind: "safe-files",
      fileCount: files.length,
    },
  };
}

async function readPackageConfig(
  _input: unknown,
  context: LocalActionContext,
): Promise<LocalActionExecutionPayload> {
  const packageSummary = await readPackageSummary(context.allowedWorkspaceRoot);

  if (!packageSummary) {
    throw new LocalActionBlockedError(["invalid_action_input"]);
  }

  return {
    output: {
      kind: "package-config",
      ...packageSummary,
      fullTextIncluded: false,
    },
    auditSummary: {
      kind: "package-config",
      packageName: packageSummary.name,
    },
  };
}

async function previewPackageConfig(
  _input: unknown,
  context: LocalActionContext,
): Promise<void> {
  if (!(await readPackageSummary(context.allowedWorkspaceRoot))) {
    throw new LocalActionBlockedError(["invalid_action_input"]);
  }
}

async function readDocsMetadata(
  input: unknown,
  context: LocalActionContext,
): Promise<LocalActionExecutionPayload> {
  const relativePath = String(objectInput(input).relativePath ?? "README.md");

  const absolutePath = await previewDocsTarget(input, context);
  const contents = await readFile(absolutePath);
  const lineCount = contents.toString("utf8").split(/\r?\n/).length;

  return {
    output: {
      kind: "docs-metadata",
      relativePath: normalizeRelativePath(relativePath),
      sizeBytes: contents.byteLength,
      sha256: sha256Hex(contents),
      lineCount,
      fullTextIncluded: false,
    },
    auditSummary: {
      kind: "docs-metadata",
      relativePath: normalizeRelativePath(relativePath),
    },
  };
}

async function previewDocsMetadata(
  input: unknown,
  context: LocalActionContext,
): Promise<void> {
  await previewDocsTarget(input, context);
}

async function previewDocsTarget(
  input: unknown,
  context: LocalActionContext,
): Promise<string> {
  const relativePath = String(objectInput(input).relativePath ?? "README.md");

  if (!isAllowedReadRelativePath(relativePath)) {
    throw new LocalActionBlockedError(["secret_path"]);
  }

  const absolutePath = resolveSafeWorkspacePath(
    context.allowedWorkspaceRoot,
    relativePath,
  );

  if (!(await fileExists(absolutePath))) {
    throw new LocalActionBlockedError(["invalid_action_input"]);
  }

  return absolutePath;
}

async function writeLocalDraftFile(
  input: unknown,
  context: LocalActionContext,
): Promise<LocalActionExecutionPayload> {
  const prepared = await prepareLocalDraftFile(input, context);

  await mkdir(dirname(prepared.targetPath), { recursive: true });
  await writeFile(prepared.targetPath, prepared.contents, { flag: "wx" });

  return {
    output: {
      kind: "local-draft-file",
      relativePath: prepared.relativePath,
      sizeBytes: prepared.contents.byteLength,
      fullTextIncluded: false,
    },
    auditSummary: {
      kind: "local-draft-file",
      relativePath: prepared.relativePath,
      sizeBytes: prepared.contents.byteLength,
    },
  };
}

async function previewLocalDraftFile(
  input: unknown,
  context: LocalActionContext,
): Promise<void> {
  await prepareLocalDraftFile(input, context);
}

async function prepareLocalDraftFile(
  input: unknown,
  context: LocalActionContext,
): Promise<{
  relativePath: string;
  targetPath: string;
  contents: Buffer;
}> {
  const value = objectInput(input);
  const outputDirectory = stringInput(value.outputDirectory);
  const fileName = stringInput(value.fileName);
  const title = stringInput(value.title);
  const body = stringInput(value.body);

  if (!outputDirectory || !fileName || !title || !body) {
    throw new LocalActionBlockedError(["invalid_action_input"]);
  }

  if (!isSafeFileName(fileName) || !SAFE_WRITE_EXTENSIONS.has(extname(fileName))) {
    throw new LocalActionBlockedError(["unsafe_output_path"]);
  }

  const relativePath = normalizeRelativePath(`${outputDirectory}/${fileName}`);
  const targetPath = resolveSafeWorkspacePath(
    context.allowedWorkspaceRoot,
    relativePath,
  );
  const contents = Buffer.from(`# ${title}\n\n${body}\n`, "utf8");

  if (contents.byteLength > MAX_WRITE_BYTES) {
    throw new LocalActionBlockedError(["invalid_action_input"]);
  }

  if (await fileExists(targetPath)) {
    throw new LocalActionBlockedError(["target_exists"]);
  }

  return {
    relativePath,
    targetPath,
    contents,
  };
}

function requestForDefinition(definition: LocalActionDefinition): ActionRequest {
  return {
    actionId: definition.actionId,
    actionKind: definition.actionKind,
    risk: definition.risk,
    requestedPermission: definition.requestedPermission,
  };
}

function previewResult(input: {
  request: ActionRequest;
  decision: PermissionDecision;
}): LocalActionPreviewResult {
  return {
    mode: "local-action-preview",
    actionId: input.request.actionId,
    actionKind: input.request.actionKind,
    status: input.decision.status,
    executed: false,
    decision: input.decision,
    auditEvent: actionAuditEventForDecision(input.request, input.decision),
    providerCallCount: 0,
    externalNetworkUsed: false,
    fullTextIncluded: false,
  };
}

function unknownActionRequest(actionId: string): ActionRequest {
  return {
    actionId,
    actionKind: "unknown",
    risk: "destructive",
    requestedPermission: "forbidden",
  };
}

function blockedPreviewDecision(
  actionId: string,
  reasons: ForbiddenActionReason[],
): PermissionDecision {
  return {
    actionId,
    status: "blocked",
    grantedPermission: "forbidden",
    reasons,
    dryRunOnly: true,
  };
}

async function finalizeLocalAction(input: {
  context: LocalActionContext;
  request: ActionRequest;
  decision: PermissionDecision;
  output: Record<string, unknown> | null;
  auditSummary: Record<string, unknown>;
  now: Date;
}): Promise<LocalActionExecutionResult> {
  const auditEvent = actionAuditEventForDecision(input.request, input.decision);
  const status = statusForDecision(input.decision);
  const auditEventId = appendAuditEvent(input.context.database, {
    eventType:
      status === "completed"
        ? "action.completed"
        : status === "requires_confirmation"
          ? "action.requires_confirmation"
          : "action.blocked",
    payload: {
      actionId: input.request.actionId,
      actionKind: input.request.actionKind,
      decisionStatus: input.decision.status,
      grantedPermission: input.decision.grantedPermission,
      reasons: input.decision.reasons,
      executed: status === "completed",
      outputSummary: input.auditSummary,
      fullTextIncluded: false,
    },
    now: input.now,
  });

  return {
    mode: "local-action",
    actionId: input.request.actionId,
    actionKind: input.request.actionKind,
    status,
    executed: status === "completed",
    decision: input.decision,
    auditEvent,
    auditEventId,
    output: input.output,
    providerCallCount: 0,
    externalNetworkUsed: false,
    fullTextIncluded: false,
  };
}

async function blockedLocalAction(input: {
  actionId: string;
  actionKind: string;
  reasons: ForbiddenActionReason[];
  context: LocalActionContext;
  now: Date;
}): Promise<LocalActionExecutionResult> {
  const request: ActionRequest = {
    actionId: input.actionId,
    actionKind: input.actionKind,
    risk: "destructive",
    requestedPermission: "forbidden",
  };
  const decision: PermissionDecision = {
    actionId: input.actionId,
    status: "blocked",
    grantedPermission: "forbidden",
    reasons: input.reasons,
    dryRunOnly: false,
  };

  return finalizeLocalAction({
    context: input.context,
    request,
    decision,
    output: null,
    auditSummary: {},
    now: input.now,
  });
}

function statusForDecision(decision: PermissionDecision): LocalActionStatus {
  switch (decision.status) {
    case "allowed":
      return "completed";
    case "requires_confirmation":
      return "requires_confirmation";
    case "blocked":
      return "blocked";
  }
}

async function readPackageSummary(root: string): Promise<{
  name: string;
  version: string;
  private: boolean;
  scriptNames: string[];
  dependencyCount: number;
  devDependencyCount: number;
} | null> {
  try {
    const packageJson = JSON.parse(
      await readFile(resolveSafeWorkspacePath(root, "package.json"), "utf8"),
    ) as {
      name?: unknown;
      version?: unknown;
      private?: unknown;
      scripts?: Record<string, unknown>;
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    };

    return {
      name: typeof packageJson.name === "string" ? packageJson.name : "unknown",
      version:
        typeof packageJson.version === "string" ? packageJson.version : "unknown",
      private: packageJson.private === true,
      scriptNames: Object.keys(packageJson.scripts ?? {}).sort(),
      dependencyCount: Object.keys(packageJson.dependencies ?? {}).length,
      devDependencyCount: Object.keys(packageJson.devDependencies ?? {}).length,
    };
  } catch {
    return null;
  }
}

async function listSafeFiles(root: string, maxFiles: number): Promise<string[]> {
  const files: string[] = [];

  await visit(root);
  return files.sort();

  async function visit(directory: string): Promise<void> {
    if (files.length >= maxFiles) {
      return;
    }

    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= maxFiles || shouldExcludePathSegment(entry.name)) {
        continue;
      }

      const absolutePath = resolve(directory, entry.name);
      const relativePath = normalizeRelativePath(relative(root, absolutePath));

      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        if (isAllowedReadRelativePath(relativePath)) {
          files.push(relativePath);
        }
      }
    }
  }
}

function resolveSafeWorkspacePath(root: string, relativePath: string): string {
  const normalizedRoot = resolve(root);
  const normalizedRelativePath = normalizeRelativePath(relativePath);

  if (!isSafeRelativePath(normalizedRelativePath)) {
    throw new LocalActionBlockedError(["outside_allowed_workspace"]);
  }

  const targetPath = resolve(normalizedRoot, ...normalizedRelativePath.split("/"));
  const pathWithinRoot = relative(normalizedRoot, targetPath);

  if (
    pathWithinRoot.length === 0 ||
    pathWithinRoot === ".." ||
    pathWithinRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathWithinRoot)
  ) {
    throw new LocalActionBlockedError(["outside_allowed_workspace"]);
  }

  if (!isAllowedReadRelativePath(pathWithinRoot)) {
    throw new LocalActionBlockedError(["secret_path"]);
  }

  return targetPath;
}

function isAllowedReadRelativePath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  const segments = normalized.split("/");
  const fileName = segments.at(-1) ?? normalized;

  if (
    segments.some(shouldExcludePathSegment) ||
    fileName === ".env" ||
    fileName.startsWith(".env.") ||
    fileName.endsWith(".log") ||
    FORBIDDEN_FILE_EXTENSIONS.has(extname(fileName))
  ) {
    return false;
  }

  return (
    normalized === "package.json" ||
    normalized === "README.md" ||
    normalized === "AGENTS.md" ||
    normalized === "PROJECT_CHARTER.md" ||
    normalized === "ARCHITECTURE.md" ||
    normalized === "DEVELOPMENT_PROTOCOL.md" ||
    normalized.startsWith("docs/") ||
    normalized.startsWith("reports/") ||
    normalized.startsWith("notes/")
  );
}

function isSafeRelativePath(relativePath: string): boolean {
  if (
    relativePath.length === 0 ||
    relativePath.includes("\\") ||
    relativePath.includes("\0") ||
    relativePath.startsWith("/") ||
    isAbsolute(relativePath)
  ) {
    return false;
  }

  return relativePath.split("/").every((segment) => {
    return segment.length > 0 && segment !== "." && segment !== "..";
  });
}

function shouldExcludePathSegment(segment: string): boolean {
  return (
    FORBIDDEN_PATH_SEGMENTS.has(segment) ||
    segment.startsWith(".rin-") ||
    segment === ".DS_Store"
  );
}

function isSafeFileName(fileName: string): boolean {
  return (
    fileName.length > 0 &&
    !fileName.includes("/") &&
    !fileName.includes("\\") &&
    !fileName.includes("\0") &&
    fileName !== "." &&
    fileName !== ".." &&
    !fileName.startsWith(".env")
  );
}

function objectInput(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function stringInput(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRelativePath(path: string): string {
  return path.split(sep).join("/");
}

function sha256Hex(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
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

class LocalActionBlockedError extends Error {
  constructor(readonly reasons: ForbiddenActionReason[]) {
    super("Local action blocked.");
  }
}
