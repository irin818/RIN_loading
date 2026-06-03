import {
  actionAuditEventForDecision,
  decideActionPermission,
  type ActionAuditEvent,
  type ActionPermissionLevel,
  type ActionRequest,
  type ActionRisk,
  type PermissionDecision,
} from "./permissions";

export type DryRunActionDefinition = {
  actionId: string;
  actionKind: string;
  risk: ActionRisk;
  requestedPermission: ActionPermissionLevel;
  description: string;
};

export type DryRunResult = {
  actionId: string;
  status: "dry_run_allowed" | "dry_run_blocked" | "dry_run_requires_confirmation";
  decision: PermissionDecision;
  auditEvent: ActionAuditEvent;
  fullTextIncluded: false;
  executed: false;
};

const dryRunActions = new Map<string, DryRunActionDefinition>();

export function registerDryRunAction(action: DryRunActionDefinition): void {
  dryRunActions.set(action.actionId, action);
}

export function registerBuiltinDryRunActions(): void {
  registerDryRunAction({
    actionId: "rin.memory.maintenance.report",
    actionKind: "memory-maintenance-report",
    risk: "read",
    requestedPermission: "read-only",
    description: "Inspect memory maintenance suggestions without mutation.",
  });
  registerDryRunAction({
    actionId: "rin.memory.archive.apply",
    actionKind: "memory-archive-apply",
    risk: "mutation",
    requestedPermission: "confirm-before-action",
    description: "Would archive a memory only after owner confirmation.",
  });
  registerDryRunAction({
    actionId: "rin.system.destructive-operation",
    actionKind: "destructive-system-operation",
    risk: "destructive",
    requestedPermission: "forbidden",
    description: "Forbidden destructive system action fixture.",
  });
}

export function listDryRunActions(): DryRunActionDefinition[] {
  return [...dryRunActions.values()].sort((left, right) =>
    left.actionId.localeCompare(right.actionId),
  );
}

export function dryRunAction(actionId: string): DryRunResult {
  const action = dryRunActions.get(actionId);

  if (!action) {
    const request: ActionRequest = {
      actionId,
      actionKind: "unknown",
      risk: "destructive",
      requestedPermission: "forbidden",
    };
    const decision: PermissionDecision = {
      actionId,
      status: "blocked",
      grantedPermission: "forbidden",
      reasons: ["unknown_action"],
      dryRunOnly: true,
    };

    return {
      actionId,
      status: "dry_run_blocked",
      decision,
      auditEvent: actionAuditEventForDecision(request, decision),
      fullTextIncluded: false,
      executed: false,
    };
  }

  const request: ActionRequest = {
    actionId: action.actionId,
    actionKind: action.actionKind,
    risk: action.risk,
    requestedPermission: action.requestedPermission,
  };
  const decision = decideActionPermission(request);

  return {
    actionId,
    status: statusForDecision(decision),
    decision,
    auditEvent: actionAuditEventForDecision(request, decision),
    fullTextIncluded: false,
    executed: false,
  };
}

function statusForDecision(
  decision: PermissionDecision,
): DryRunResult["status"] {
  switch (decision.status) {
    case "allowed":
      return "dry_run_allowed";
    case "requires_confirmation":
      return "dry_run_requires_confirmation";
    case "blocked":
      return "dry_run_blocked";
  }
}
