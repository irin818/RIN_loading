import { describe, expect, it } from "vitest";
import {
  decideActionPermission,
  dryRunAction,
  listDryRunActions,
  registerBuiltinDryRunActions,
} from ".";

describe("action permissions", () => {
  it("allows read-only actions as dry runs", () => {
    const decision = decideActionPermission({
      actionId: "read",
      actionKind: "read-status",
      risk: "read",
      requestedPermission: "read-only",
    });

    expect(decision.status).toBe("allowed");
    expect(decision.grantedPermission).toBe("read-only");
    expect(decision.dryRunOnly).toBe(true);
  });

  it("requires confirmation for mutation actions", () => {
    const decision = decideActionPermission({
      actionId: "archive",
      actionKind: "memory-archive",
      risk: "mutation",
      requestedPermission: "confirm-before-action",
    });

    expect(decision.status).toBe("requires_confirmation");
    expect(decision.reasons).toEqual(["mutation_requires_confirmation"]);
    expect(decision.dryRunOnly).toBe(true);
  });

  it("blocks destructive and external actions", () => {
    expect(
      decideActionPermission({
        actionId: "destroy",
        actionKind: "destructive-system-operation",
        risk: "destructive",
        requestedPermission: "autonomous-within-scope",
      }),
    ).toMatchObject({
      status: "blocked",
      reasons: ["destructive_action"],
      dryRunOnly: true,
    });
    expect(
      decideActionPermission({
        actionId: "remote",
        actionKind: "external-network-call",
        risk: "external",
        requestedPermission: "autonomous-within-scope",
      }),
    ).toMatchObject({
      status: "blocked",
      reasons: ["external_action"],
      dryRunOnly: true,
    });
  });
});

describe("dryRunAction", () => {
  it("runs built-in action fixtures without executing real effects", () => {
    registerBuiltinDryRunActions();
    const readResult = dryRunAction("rin.memory.maintenance.report");
    const mutationResult = dryRunAction("rin.memory.archive.apply");
    const destructiveResult = dryRunAction("rin.system.destructive-operation");

    expect(listDryRunActions().map((action) => action.actionId)).toContain(
      "rin.memory.maintenance.report",
    );
    expect(readResult).toMatchObject({
      status: "dry_run_allowed",
      executed: false,
      fullTextIncluded: false,
    });
    expect(mutationResult.status).toBe("dry_run_requires_confirmation");
    expect(destructiveResult.status).toBe("dry_run_blocked");
  });

  it("blocks unknown actions safely", () => {
    expect(dryRunAction("unknown")).toMatchObject({
      status: "dry_run_blocked",
      executed: false,
      decision: {
        reasons: ["unknown_action"],
      },
    });
  });
});
