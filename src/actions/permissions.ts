export type ActionPermissionLevel =
  | "read-only"
  | "draft-only"
  | "confirm-before-action"
  | "autonomous-within-scope"
  | "forbidden";

export type ActionRisk = "read" | "draft" | "mutation" | "destructive" | "external";

export type PermissionDecisionStatus =
  | "allowed"
  | "requires_confirmation"
  | "blocked";

export type ForbiddenActionReason =
  | "unknown_action"
  | "permission_forbidden"
  | "destructive_action"
  | "external_action"
  | "mutation_requires_confirmation"
  | "outside_allowed_workspace"
  | "secret_path"
  | "unsafe_output_path"
  | "target_exists"
  | "invalid_action_input";

export type ActionRequest = {
  actionId: string;
  actionKind: string;
  risk: ActionRisk;
  requestedPermission: ActionPermissionLevel;
};

export type PermissionDecision = {
  actionId: string;
  status: PermissionDecisionStatus;
  grantedPermission: ActionPermissionLevel;
  reasons: ForbiddenActionReason[];
  dryRunOnly: boolean;
};

export type PermissionDecisionOptions = {
  dryRunOnly?: boolean;
};

export type ActionAuditEvent = {
  actionId: string;
  actionKind: string;
  decisionStatus: PermissionDecisionStatus;
  requestedPermission: ActionPermissionLevel;
  grantedPermission: ActionPermissionLevel;
  dryRunOnly: boolean;
  reasons: ForbiddenActionReason[];
};

export function decideActionPermission(
  request: ActionRequest,
  options: PermissionDecisionOptions = {},
): PermissionDecision {
  const dryRunOnly = options.dryRunOnly ?? true;

  if (request.requestedPermission === "forbidden") {
    return blockedDecision(request, ["permission_forbidden"]);
  }

  if (request.risk === "destructive") {
    return blockedDecision(request, ["destructive_action"]);
  }

  if (request.risk === "external") {
    return blockedDecision(request, ["external_action"]);
  }

  if (request.risk === "mutation") {
    return {
      actionId: request.actionId,
      status: "requires_confirmation",
      grantedPermission: "confirm-before-action",
      reasons: ["mutation_requires_confirmation"],
      dryRunOnly: true,
    };
  }

  if (
    request.risk === "read" &&
    (request.requestedPermission === "read-only" ||
      request.requestedPermission === "autonomous-within-scope")
  ) {
    return allowedDecision(request, "read-only", dryRunOnly);
  }

  if (
    request.risk === "draft" &&
    (request.requestedPermission === "draft-only" ||
      request.requestedPermission === "autonomous-within-scope")
  ) {
    return allowedDecision(request, "draft-only", dryRunOnly);
  }

  return blockedDecision(request, ["permission_forbidden"]);
}

export function actionAuditEventForDecision(
  request: ActionRequest,
  decision: PermissionDecision,
): ActionAuditEvent {
  return {
    actionId: request.actionId,
    actionKind: request.actionKind,
    decisionStatus: decision.status,
    requestedPermission: request.requestedPermission,
    grantedPermission: decision.grantedPermission,
    dryRunOnly: decision.dryRunOnly,
    reasons: [...decision.reasons],
  };
}

function allowedDecision(
  request: ActionRequest,
  grantedPermission: ActionPermissionLevel,
  dryRunOnly: boolean,
): PermissionDecision {
  return {
    actionId: request.actionId,
    status: "allowed",
    grantedPermission,
    reasons: [],
    dryRunOnly,
  };
}

function blockedDecision(
  request: ActionRequest,
  reasons: ForbiddenActionReason[],
): PermissionDecision {
  return {
    actionId: request.actionId,
    status: "blocked",
    grantedPermission: "forbidden",
    reasons,
    dryRunOnly: true,
  };
}
