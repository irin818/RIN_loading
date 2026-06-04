import type { RinDatabase } from "../database";
import {
  decideActionPermission,
  type ActionPermissionLevel,
  type ActionRequest,
  type ActionRisk,
  type ForbiddenActionReason,
  type PermissionDecisionStatus,
} from "../actions";

export type TaskStatus = "planned" | "blocked" | "completed";
export type TaskStepStatus = "pending" | "completed" | "blocked" | "checkpoint_required";

export type TaskStep = {
  id: string;
  title: string;
  action: ActionRequest | null;
  ownerCheckpointRequired: boolean;
};

export type BoundedTask = {
  id: string;
  title: string;
  status: "planned";
  steps: TaskStep[];
};

export type TaskStepResult = {
  stepId: string;
  status: TaskStepStatus;
  decisionStatus: PermissionDecisionStatus | "no_action";
  reasons: ForbiddenActionReason[];
  ownerCheckpointRequired: boolean;
  executed: false;
};

export type TaskSmokeReport = {
  mode: "task-smoke";
  status: TaskStatus;
  taskId: string;
  checkedStepCount: number;
  completedStepCount: number;
  blockedStepCount: number;
  ownerCheckpointCount: number;
  maxSteps: number;
  plannerExecutorCheckerSeparated: true;
  backgroundLoopStarted: false;
  executedActionCount: 0;
  mutatedMemoryCount: 0;
  providerCallCount: 0;
  fullTextIncluded: false;
  stepResults: TaskStepResult[];
};

export type TaskAuditReport = {
  mode: "task-audit-report";
  status: "ready";
  totalTaskAuditEvents: number;
  completedEvents: number;
  blockedEvents: number;
  checkpointEvents: number;
  providerCallCount: 0;
  fullTextIncluded: false;
};

const DEFAULT_MAX_TASK_STEPS = 5;

export function createFixtureTask(): BoundedTask {
  return {
    id: "rin-v0-6-fixture-task",
    title: "Bounded fixture task",
    status: "planned",
    steps: [
      {
        id: "inspect-status",
        title: "Inspect local status",
        action: actionRequest({
          actionId: "rin.task.inspect-status",
          actionKind: "task-read",
          risk: "read",
          requestedPermission: "read-only",
        }),
        ownerCheckpointRequired: false,
      },
      {
        id: "owner-checkpoint",
        title: "Require owner checkpoint before mutation",
        action: actionRequest({
          actionId: "rin.task.apply-memory-change",
          actionKind: "task-memory-mutation",
          risk: "mutation",
          requestedPermission: "confirm-before-action",
        }),
        ownerCheckpointRequired: true,
      },
      {
        id: "block-external",
        title: "Block external task action",
        action: actionRequest({
          actionId: "rin.task.external-call",
          actionKind: "task-external",
          risk: "external",
          requestedPermission: "autonomous-within-scope",
        }),
        ownerCheckpointRequired: false,
      },
    ],
  };
}

export function runBoundedTaskSmoke(input: {
  task?: BoundedTask;
  maxSteps?: number;
} = {}): TaskSmokeReport {
  const task = input.task ?? createFixtureTask();
  const maxSteps = Math.max(1, input.maxSteps ?? DEFAULT_MAX_TASK_STEPS);
  const stepResults = task.steps.slice(0, maxSteps).map(executeTaskStepDryRun);
  const completedStepCount = stepResults.filter(
    (step) => step.status === "completed",
  ).length;
  const blockedStepCount = stepResults.filter((step) => step.status === "blocked")
    .length;
  const ownerCheckpointCount = stepResults.filter(
    (step) => step.ownerCheckpointRequired,
  ).length;

  return {
    mode: "task-smoke",
    status:
      blockedStepCount > 0 || ownerCheckpointCount > 0
        ? "blocked"
        : completedStepCount === task.steps.length
          ? "completed"
          : "planned",
    taskId: task.id,
    checkedStepCount: stepResults.length,
    completedStepCount,
    blockedStepCount,
    ownerCheckpointCount,
    maxSteps,
    plannerExecutorCheckerSeparated: true,
    backgroundLoopStarted: false,
    executedActionCount: 0,
    mutatedMemoryCount: 0,
    providerCallCount: 0,
    fullTextIncluded: false,
    stepResults,
  };
}

export function buildTaskAuditReport(database: RinDatabase): TaskAuditReport {
  const rows = database
    .prepare(
      `
        SELECT event_type
        FROM audit_events
        WHERE event_type IN (
          'task.completed',
          'task.blocked',
          'task.owner_checkpoint_required'
        )
      `,
    )
    .all() as { event_type: string }[];

  return {
    mode: "task-audit-report",
    status: "ready",
    totalTaskAuditEvents: rows.length,
    completedEvents: rows.filter((row) => row.event_type === "task.completed")
      .length,
    blockedEvents: rows.filter((row) => row.event_type === "task.blocked").length,
    checkpointEvents: rows.filter(
      (row) => row.event_type === "task.owner_checkpoint_required",
    ).length,
    providerCallCount: 0,
    fullTextIncluded: false,
  };
}

export function formatTaskSmokeReport(report: TaskSmokeReport): string {
  return [
    "RIN task smoke report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Task ID: ${report.taskId}`,
    `Checked steps: ${report.checkedStepCount}`,
    `Completed steps: ${report.completedStepCount}`,
    `Blocked steps: ${report.blockedStepCount}`,
    `Owner checkpoints: ${report.ownerCheckpointCount}`,
    `Max steps: ${report.maxSteps}`,
    `Planner/executor/checker separated: ${report.plannerExecutorCheckerSeparated ? "yes" : "no"}`,
    `Background loop started: ${report.backgroundLoopStarted ? "yes" : "no"}`,
    `Executed actions: ${report.executedActionCount}`,
    `Mutated memories: ${report.mutatedMemoryCount}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Step results:",
    ...formatTaskStepResults(report.stepResults),
  ].join("\n");
}

export function formatTaskAuditReport(report: TaskAuditReport): string {
  return [
    "RIN task audit report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Total task audit events: ${report.totalTaskAuditEvents}`,
    `Completed events: ${report.completedEvents}`,
    `Blocked events: ${report.blockedEvents}`,
    `Checkpoint events: ${report.checkpointEvents}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
  ].join("\n");
}

function executeTaskStepDryRun(step: TaskStep): TaskStepResult {
  if (!step.action) {
    return {
      stepId: step.id,
      status: step.ownerCheckpointRequired ? "checkpoint_required" : "completed",
      decisionStatus: "no_action",
      reasons: [],
      ownerCheckpointRequired: step.ownerCheckpointRequired,
      executed: false,
    };
  }

  const decision = decideActionPermission(step.action, { dryRunOnly: true });

  if (step.ownerCheckpointRequired || decision.status === "requires_confirmation") {
    return {
      stepId: step.id,
      status: "checkpoint_required",
      decisionStatus: decision.status,
      reasons: decision.reasons,
      ownerCheckpointRequired: true,
      executed: false,
    };
  }

  return {
    stepId: step.id,
    status: decision.status === "allowed" ? "completed" : "blocked",
    decisionStatus: decision.status,
    reasons: decision.reasons,
    ownerCheckpointRequired: false,
    executed: false,
  };
}

function actionRequest(input: {
  actionId: string;
  actionKind: string;
  risk: ActionRisk;
  requestedPermission: ActionPermissionLevel;
}): ActionRequest {
  return input;
}

function formatTaskStepResults(results: readonly TaskStepResult[]): string[] {
  if (results.length === 0) {
    return ["none"];
  }

  return results.map(
    (result) =>
      `- ${result.stepId} status=${result.status} decision=${result.decisionStatus} checkpoint=${result.ownerCheckpointRequired ? "yes" : "no"} executed=${result.executed ? "yes" : "no"} reasons=${result.reasons.length > 0 ? result.reasons.join(",") : "none"}`,
  );
}
