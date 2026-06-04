import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultEnvironment } from "../config/environment";
import { appendAuditEvent, openRinDatabase } from "../database";
import { initializeRinStorage } from "../storage";
import { registerBuiltinTools } from "./builtin";
import { registerTool } from "./registry";
import {
  buildMcpBoundarySmokeReport,
  buildToolAuditReport,
  buildToolRegistrySmokeReport,
  formatToolAuditReport,
  formatToolRegistrySmokeReport,
} from "./foundation";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("tool foundation reports", () => {
  it("summarizes tool permissions without executing tools", () => {
    registerBuiltinTools();
    registerTool({
      id: "rin.test.confirmed-tool",
      displayName: "Confirmed test tool",
      riskLevel: "L2",
      requiresConfirmation: true,
      descriptionEnglish: "Test only.",
      descriptionChinese: "仅测试。",
      execute: () => {
        throw new Error("must not execute");
      },
    });

    const report = buildToolRegistrySmokeReport();
    const summary = formatToolRegistrySmokeReport(report);

    expect(report.defaultDenyExternalTools).toBe(true);
    expect(report.providerCallCount).toBe(0);
    expect(report.mcpCallCount).toBe(0);
    expect(report.externalNetworkUsed).toBe(false);
    expect(report.fullTextIncluded).toBe(false);
    expect(
      report.toolCapabilities.find(
        (tool) => tool.toolId === "rin.test.confirmed-tool",
      ),
    ).toMatchObject({
      permissionProfile: "confirmation_required",
      capabilityKind: "local",
    });
    expect(summary).toContain("rin.local.status");
  });

  it("keeps the MCP boundary disabled by default", () => {
    const report = buildMcpBoundarySmokeReport();

    expect(report).toMatchObject({
      status: "disabled",
      mcpEnabledByDefault: false,
      defaultPermissionProfile: "forbidden",
      registeredMcpToolCount: 0,
      providerCallCount: 0,
      mcpCallCount: 0,
      externalNetworkUsed: false,
      fullTextIncluded: false,
    });
  });

  it("reports tool audit counts without payload text", async () => {
    const cwd = await createTempRoot();
    const storage = await initializeRinStorage(defaultEnvironment, { cwd });
    const database = openRinDatabase(storage.layout);

    try {
      appendAuditEvent(database, {
        eventType: "tool.completed",
        payload: { toolId: "rin.local.status", secret: "do-not-print" },
      });
      appendAuditEvent(database, {
        eventType: "tool.blocked",
        payload: { toolId: "rin.high-risk", path: "/private/path" },
      });

      const report = buildToolAuditReport(database);
      const summary = formatToolAuditReport(report);

      expect(report.totalToolAuditEvents).toBe(2);
      expect(report.completedEvents).toBe(1);
      expect(report.blockedEvents).toBe(1);
      expect(report.providerCallCount).toBe(0);
      expect(report.mcpCallCount).toBe(0);
      expect(report.externalNetworkUsed).toBe(false);
      expect(report.fullTextIncluded).toBe(false);
      expect(summary).not.toContain("do-not-print");
      expect(summary).not.toContain("/private/path");
    } finally {
      database.close();
    }
  });
});

async function createTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rin-tool-foundation-"));
  tempRoots.push(root);
  return root;
}
