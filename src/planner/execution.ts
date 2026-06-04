import { appendAuditEvent, type RinDatabase } from "../database";
import {
  executeLocalAction,
  previewLocalAction,
  registerBuiltinLocalActions,
  type LocalActionContext,
  type LocalActionExecutionResult,
} from "../actions";
import type { ForbiddenActionReason, PermissionDecision } from "../actions";
import type { PlanState, PlanStep } from "./planner";

export const PLANNER_EXECUTION_CONFIRMATION_TOKEN =
  "RIN_PLANNER_EXECUTE_LOW_RISK_ACTIONS";

export type PlannerExecutionStepResult = {
  stepId: string;
  actionId: string | null;
  dryRunStatus: "allowed" | "blocked" | "requires_confirmation" | "no_action";
  executionStatus:
    | "completed"
    | "blocked"
    | "requires_confirmation"
    | "not_executed";
  executed: boolean;
  reasons: ForbiddenActionReason[];
};

export type PlannerExecutionReport = {
  mode: "planner-execution-smoke";
  status: "completed" | "blocked" | "confirmation_required";
  planId: string;
  checkedStepCount: number;
  completedStepCount: number;
  blockedStepCount: number;
  confirmationRequiredStepCount: number;
  executedActionCount: number;
  maxSteps: number;
  dryRunBeforeExecution: true;
  confirmationTokenRequired: typeof PLANNER_EXECUTION_CONFIRMATION_TOKEN;
  confirmationTokenSupplied: boolean;
  providerCallCount: 0;
  backgroundLoopStarted: false;
  fullTextIncluded: false;
  stepResults: PlannerExecutionStepResult[];
};

export type PlannerExecutionOptions = {
  maxSteps?: number;
  confirmationToken?: string;
  context: LocalActionContext;
};

export type PlannerAuditReport = {
  mode: "planner-audit-report";
  status: "ready";
  totalPlannerAuditEvents: number;
  completedEvents: number;
  blockedEvents: number;
  confirmationRequiredEvents: number;
  fullTextIncluded: false;
};

const DEFAULT_MAX_EXECUTION_STEPS = 5;

export function createOwnerConfirmedFixturePlan(): PlanState {
  return {
    id: "rin-v0-2-owner-confirmed-fixture-plan",
    status: "ready",
    steps: [
      {
        id: "read-project-status",
        title: "Read project status",
        actionId: "rin.project.status.read",
        status: "pending",
      },
      {
        id: "write-local-report",
        title: "Write local draft report",
        actionId: "rin.local.report.write",
        actionInput: {
          outputDirectory: "reports",
          fileName: "planner-execution-report.md",
          title: "Planner execution report",
          body: "Temporary planner execution smoke report.",
        },
        status: "pending",
      },
      {
        id: "block-delete",
        title: "Block destructive delete action",
        actionId: "rin.files.delete",
        actionInput: { relativePath: "README.md" },
        status: "pending",
      },
    ],
  };
}

export async function runOwnerConfirmedPlannerExecution(
  plan: PlanState,
  options: PlannerExecutionOptions,
): Promise<PlannerExecutionReport> {
  registerBuiltinLocalActions();
  const maxSteps = Math.max(1, options.maxSteps ?? DEFAULT_MAX_EXECUTION_STEPS);
  const checkedSteps = plan.steps.slice(0, maxSteps);
  const confirmationTokenSupplied =
    options.confirmationToken === PLANNER_EXECUTION_CONFIRMATION_TOKEN;
  const previewResults = await Promise.all(
    checkedSteps.map((step) => previewPlannerStep(step, options.context)),
  );

  let stepResults: PlannerExecutionStepResult[];

  if (
    !confirmationTokenSupplied &&
    previewResults.some((result) => result.dryRunStatus === "allowed")
  ) {
    stepResults = previewResults.map((result) =>
      result.dryRunStatus === "allowed"
        ? {
            ...result,
            executionStatus: "requires_confirmation",
            executed: false,
          }
        : result,
    );
  } else {
    stepResults = await executePlannerSteps(checkedSteps, previewResults, options);
  }

  const report = plannerExecutionReport({
    plan,
    maxSteps,
    confirmationTokenSupplied,
    stepResults,
  });

  appendPlannerExecutionAudit(options.context.database, report, options.context.now);

  return report;
}

export async function runBuiltInPlannerExecutionSmoke(input: {
  context: LocalActionContext;
  confirmationToken?: string;
  maxSteps?: number;
}): Promise<PlannerExecutionReport> {
  return runOwnerConfirmedPlannerExecution(createOwnerConfirmedFixturePlan(), input);
}

export function buildPlannerAuditReport(database: RinDatabase): PlannerAuditReport {
  const rows = database
    .prepare(
      `
        SELECT event_type
        FROM audit_events
        WHERE event_type IN (
          'planner.execution.completed',
          'planner.execution.blocked',
          'planner.execution.confirmation_required'
        )
      `,
    )
    .all() as { event_type: string }[];

  return {
    mode: "planner-audit-report",
    status: "ready",
    totalPlannerAuditEvents: rows.length,
    completedEvents: rows.filter(
      (row) => row.event_type === "planner.execution.completed",
    ).length,
    blockedEvents: rows.filter(
      (row) => row.event_type === "planner.execution.blocked",
    ).length,
    confirmationRequiredEvents: rows.filter(
      (row) => row.event_type === "planner.execution.confirmation_required",
    ).length,
    fullTextIncluded: false,
  };
}

export function formatPlannerExecutionReport(
  report: PlannerExecutionReport,
): string {
  return [
    "RIN planner execution smoke report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Plan ID: ${report.planId}`,
    `Checked steps: ${report.checkedStepCount}`,
    `Completed steps: ${report.completedStepCount}`,
    `Blocked steps: ${report.blockedStepCount}`,
    `Confirmation required steps: ${report.confirmationRequiredStepCount}`,
    `Executed actions: ${report.executedActionCount}`,
    `Max steps: ${report.maxSteps}`,
    `Dry-run before execution: ${report.dryRunBeforeExecution ? "yes" : "no"}`,
    `Confirmation token required: ${report.confirmationTokenRequired}`,
    `Confirmation token supplied: ${report.confirmationTokenSupplied ? "yes" : "no"}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Background loop started: ${report.backgroundLoopStarted ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Step results:",
    ...formatPlannerExecutionSteps(report.stepResults),
  ].join("\n");
}

export function formatPlannerAuditReport(report: PlannerAuditReport): string {
  return [
    "RIN planner audit report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Total planner audit events: ${report.totalPlannerAuditEvents}`,
    `Completed events: ${report.completedEvents}`,
    `Blocked events: ${report.blockedEvents}`,
    `Confirmation required events: ${report.confirmationRequiredEvents}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
  ].join("\n");
}

async function executePlannerSteps(
  steps: readonly PlanStep[],
  previews: readonly PlannerExecutionStepResult[],
  options: PlannerExecutionOptions,
): Promise<PlannerExecutionStepResult[]> {
  const results: PlannerExecutionStepResult[] = [];

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const preview = previews[index];

    if (!step.actionId) {
      results.push(preview);
      continue;
    }

    const actionResult = await executeLocalAction({
      actionId: step.actionId,
      actionInput: step.actionInput,
      context: options.context,
    });

    results.push(executedStepResult(preview, actionResult));
  }

  return results;
}

async function previewPlannerStep(
  step: PlanStep,
  context: LocalActionContext,
): Promise<PlannerExecutionStepResult> {
  if (!step.actionId) {
    return {
      stepId: step.id,
      actionId: null,
      dryRunStatus: "no_action",
      executionStatus: "completed",
      executed: false,
      reasons: [],
    };
  }

  const preview = await previewLocalAction({
    actionId: step.actionId,
    actionInput: step.actionInput,
    context,
  });

  return {
    stepId: step.id,
    actionId: step.actionId,
    dryRunStatus: dryRunStatusForDecision(preview.decision),
    executionStatus: "not_executed",
    executed: false,
    reasons: preview.decision.reasons,
  };
}

function executedStepResult(
  preview: PlannerExecutionStepResult,
  actionResult: LocalActionExecutionResult,
): PlannerExecutionStepResult {
  return {
    ...preview,
    executionStatus: actionResult.status,
    executed: actionResult.executed,
    reasons: actionResult.decision.reasons,
  };
}

function dryRunStatusForDecision(
  decision: PermissionDecision,
): PlannerExecutionStepResult["dryRunStatus"] {
  switch (decision.status) {
    case "allowed":
      return "allowed";
    case "requires_confirmation":
      return "requires_confirmation";
    case "blocked":
      return "blocked";
  }
}

function plannerExecutionReport(input: {
  plan: PlanState;
  maxSteps: number;
  confirmationTokenSupplied: boolean;
  stepResults: PlannerExecutionStepResult[];
}): PlannerExecutionReport {
  const completedStepCount = input.stepResults.filter((step) => {
    return step.executionStatus === "completed";
  }).length;
  const blockedStepCount = input.stepResults.filter((step) => {
    return step.executionStatus === "blocked";
  }).length;
  const confirmationRequiredStepCount = input.stepResults.filter((step) => {
    return step.executionStatus === "requires_confirmation";
  }).length;

  return {
    mode: "planner-execution-smoke",
    status:
      confirmationRequiredStepCount > 0
        ? "confirmation_required"
        : blockedStepCount > 0
          ? "blocked"
          : "completed",
    planId: input.plan.id,
    checkedStepCount: input.stepResults.length,
    completedStepCount,
    blockedStepCount,
    confirmationRequiredStepCount,
    executedActionCount: input.stepResults.filter((step) => step.executed).length,
    maxSteps: input.maxSteps,
    dryRunBeforeExecution: true,
    confirmationTokenRequired: PLANNER_EXECUTION_CONFIRMATION_TOKEN,
    confirmationTokenSupplied: input.confirmationTokenSupplied,
    providerCallCount: 0,
    backgroundLoopStarted: false,
    fullTextIncluded: false,
    stepResults: input.stepResults,
  };
}

function appendPlannerExecutionAudit(
  database: RinDatabase,
  report: PlannerExecutionReport,
  now?: Date,
): void {
  appendAuditEvent(database, {
    eventType:
      report.status === "completed"
        ? "planner.execution.completed"
        : report.status === "confirmation_required"
          ? "planner.execution.confirmation_required"
          : "planner.execution.blocked",
    payload: {
      planId: report.planId,
      status: report.status,
      checkedStepCount: report.checkedStepCount,
      executedActionCount: report.executedActionCount,
      blockedStepCount: report.blockedStepCount,
      confirmationRequiredStepCount: report.confirmationRequiredStepCount,
      dryRunBeforeExecution: report.dryRunBeforeExecution,
      backgroundLoopStarted: report.backgroundLoopStarted,
      fullTextIncluded: report.fullTextIncluded,
    },
    now,
  });
}

function formatPlannerExecutionSteps(
  steps: readonly PlannerExecutionStepResult[],
): string[] {
  if (steps.length === 0) {
    return ["none"];
  }

  return steps.map((step) => {
    const reasons = step.reasons.length > 0 ? step.reasons.join(",") : "none";

    return [
      `- ${step.stepId}`,
      `action=${step.actionId ?? "none"}`,
      `dryRun=${step.dryRunStatus}`,
      `execution=${step.executionStatus}`,
      `executed=${step.executed ? "yes" : "no"}`,
      `reasons=${reasons}`,
    ].join(" ");
  });
}
