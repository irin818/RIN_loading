import type { RinDatabase } from "../database";
import { listTools, type RegisteredTool, type ToolRiskLevel } from "./registry";

export type ToolCapabilityKind = "local" | "mcp" | "external-network";
export type ToolPermissionProfile = "auto_allowed" | "confirmation_required" | "forbidden";

export type ToolCapabilitySummary = {
  toolId: string;
  riskLevel: ToolRiskLevel;
  capabilityKind: ToolCapabilityKind;
  permissionProfile: ToolPermissionProfile;
  requiresConfirmation: boolean;
};

export type ToolRegistrySmokeReport = {
  mode: "tool-registry-smoke";
  status: "ready";
  registeredToolCount: number;
  toolCapabilities: ToolCapabilitySummary[];
  defaultDenyExternalTools: true;
  providerCallCount: 0;
  mcpCallCount: 0;
  externalNetworkUsed: false;
  fullTextIncluded: false;
};

export type McpBoundarySmokeReport = {
  mode: "mcp-boundary-smoke";
  status: "disabled";
  mcpEnabledByDefault: false;
  defaultPermissionProfile: "forbidden";
  registeredMcpToolCount: 0;
  providerCallCount: 0;
  mcpCallCount: 0;
  externalNetworkUsed: false;
  fullTextIncluded: false;
};

export type ToolAuditReport = {
  mode: "tool-audit-report";
  status: "ready";
  totalToolAuditEvents: number;
  completedEvents: number;
  blockedEvents: number;
  recoveryNotes: string[];
  providerCallCount: 0;
  mcpCallCount: 0;
  externalNetworkUsed: false;
  fullTextIncluded: false;
};

export function buildToolRegistrySmokeReport(): ToolRegistrySmokeReport {
  const toolCapabilities = listTools()
    .map(toolCapabilitySummary)
    .sort((left, right) => left.toolId.localeCompare(right.toolId));

  return {
    mode: "tool-registry-smoke",
    status: "ready",
    registeredToolCount: toolCapabilities.length,
    toolCapabilities,
    defaultDenyExternalTools: true,
    providerCallCount: 0,
    mcpCallCount: 0,
    externalNetworkUsed: false,
    fullTextIncluded: false,
  };
}

export function buildMcpBoundarySmokeReport(): McpBoundarySmokeReport {
  return {
    mode: "mcp-boundary-smoke",
    status: "disabled",
    mcpEnabledByDefault: false,
    defaultPermissionProfile: "forbidden",
    registeredMcpToolCount: 0,
    providerCallCount: 0,
    mcpCallCount: 0,
    externalNetworkUsed: false,
    fullTextIncluded: false,
  };
}

export function buildToolAuditReport(database: RinDatabase): ToolAuditReport {
  const rows = database
    .prepare(
      `
        SELECT event_type
        FROM audit_events
        WHERE event_type IN ('tool.completed', 'tool.blocked')
      `,
    )
    .all() as { event_type: string }[];
  const completedEvents = rows.filter(
    (row) => row.event_type === "tool.completed",
  ).length;
  const blockedEvents = rows.filter((row) => row.event_type === "tool.blocked")
    .length;

  return {
    mode: "tool-audit-report",
    status: "ready",
    totalToolAuditEvents: rows.length,
    completedEvents,
    blockedEvents,
    recoveryNotes: [
      "Review blocked tool IDs and risk levels before changing permission profiles.",
      "Keep MCP and external-network tools disabled until an explicit owner-reviewed execution path exists.",
    ],
    providerCallCount: 0,
    mcpCallCount: 0,
    externalNetworkUsed: false,
    fullTextIncluded: false,
  };
}

export function formatToolRegistrySmokeReport(
  report: ToolRegistrySmokeReport,
): string {
  return [
    "RIN tool registry smoke report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Registered tools: ${report.registeredToolCount}`,
    `Default-deny external tools: ${report.defaultDenyExternalTools ? "yes" : "no"}`,
    `providerCallCount: ${report.providerCallCount}`,
    `mcpCallCount: ${report.mcpCallCount}`,
    `External network used: ${report.externalNetworkUsed ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Tool capabilities:",
    ...formatToolCapabilities(report.toolCapabilities),
  ].join("\n");
}

export function formatMcpBoundarySmokeReport(
  report: McpBoundarySmokeReport,
): string {
  return [
    "RIN MCP boundary smoke report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `MCP enabled by default: ${report.mcpEnabledByDefault ? "yes" : "no"}`,
    `Default permission profile: ${report.defaultPermissionProfile}`,
    `Registered MCP tools: ${report.registeredMcpToolCount}`,
    `providerCallCount: ${report.providerCallCount}`,
    `mcpCallCount: ${report.mcpCallCount}`,
    `External network used: ${report.externalNetworkUsed ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
  ].join("\n");
}

export function formatToolAuditReport(report: ToolAuditReport): string {
  return [
    "RIN tool audit report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Total tool audit events: ${report.totalToolAuditEvents}`,
    `Completed events: ${report.completedEvents}`,
    `Blocked events: ${report.blockedEvents}`,
    `providerCallCount: ${report.providerCallCount}`,
    `mcpCallCount: ${report.mcpCallCount}`,
    `External network used: ${report.externalNetworkUsed ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Recovery notes:",
    ...report.recoveryNotes.map((note) => `- ${note}`),
  ].join("\n");
}

function toolCapabilitySummary(tool: RegisteredTool): ToolCapabilitySummary {
  return {
    toolId: tool.id,
    riskLevel: tool.riskLevel,
    capabilityKind: "local",
    permissionProfile: permissionProfileForTool(tool),
    requiresConfirmation: tool.requiresConfirmation,
  };
}

function permissionProfileForTool(tool: RegisteredTool): ToolPermissionProfile {
  if (tool.riskLevel === "L5") {
    return "forbidden";
  }

  if (tool.requiresConfirmation || tool.riskLevel !== "L0") {
    return "confirmation_required";
  }

  return "auto_allowed";
}

function formatToolCapabilities(
  capabilities: readonly ToolCapabilitySummary[],
): string[] {
  if (capabilities.length === 0) {
    return ["none"];
  }

  return capabilities.map(
    (capability) =>
      `- ${capability.toolId} risk=${capability.riskLevel} kind=${capability.capabilityKind} permission=${capability.permissionProfile} confirmation=${capability.requiresConfirmation ? "yes" : "no"}`,
  );
}
