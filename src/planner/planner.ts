import { dryRunAction, registerBuiltinDryRunActions, type DryRunResult } from "../actions";

export type PlanStepStatus = "pending" | "ready" | "blocked" | "completed";

export type PlanStep = {
  id: string;
  title: string;
  actionId: string | null;
  status: PlanStepStatus;
};

export type PlanState = {
  id: string;
  status: "ready" | "blocked" | "completed";
  steps: PlanStep[];
};

export type SelfCheckResult = {
  stepId: string;
  passed: boolean;
  reason: string;
  dryRun: DryRunResult | null;
};

export type PlannerSmokeReport = {
  mode: "planner-smoke";
  status: "ready" | "blocked" | "completed";
  planId: string;
  checkedStepCount: number;
  completedStepCount: number;
  blockedStepCount: number;
  maxSteps: number;
  selfChecks: SelfCheckResult[];
  providerCallCount: 0;
  executedActionCount: 0;
  backgroundLoopStarted: false;
  fullTextIncluded: false;
};

export type PlannerRunOptions = {
  maxSteps?: number;
};

const DEFAULT_MAX_PLANNER_STEPS = 5;

export function createFixturePlan(): PlanState {
  return {
    id: "rin-v0-1-fixture-plan",
    status: "ready",
    steps: [
      {
        id: "inspect-memory-maintenance",
        title: "Inspect memory maintenance report",
        actionId: "rin.memory.maintenance.report",
        status: "pending",
      },
      {
        id: "draft-memory-archive",
        title: "Draft memory archive action",
        actionId: "rin.memory.archive.apply",
        status: "pending",
      },
      {
        id: "block-destructive-action",
        title: "Verify destructive action remains blocked",
        actionId: "rin.system.destructive-operation",
        status: "pending",
      },
    ],
  };
}

export function runPlannerSelfCheck(
  plan: PlanState,
  options: PlannerRunOptions = {},
): PlannerSmokeReport {
  registerBuiltinDryRunActions();
  const maxSteps = Math.max(1, options.maxSteps ?? DEFAULT_MAX_PLANNER_STEPS);
  const checkedSteps = plan.steps.slice(0, maxSteps);
  const selfChecks = checkedSteps.map(checkPlanStep);
  const completedStepCount = selfChecks.filter((check) => check.passed).length;
  const blockedStepCount = selfChecks.length - completedStepCount;

  return {
    mode: "planner-smoke",
    status:
      blockedStepCount > 0
        ? "blocked"
        : completedStepCount === plan.steps.length
          ? "completed"
          : "ready",
    planId: plan.id,
    checkedStepCount: selfChecks.length,
    completedStepCount,
    blockedStepCount,
    maxSteps,
    selfChecks,
    providerCallCount: 0,
    executedActionCount: 0,
    backgroundLoopStarted: false,
    fullTextIncluded: false,
  };
}

export function runBuiltInPlannerSmoke(
  options: PlannerRunOptions = {},
): PlannerSmokeReport {
  return runPlannerSelfCheck(createFixturePlan(), options);
}

export function formatPlannerSmokeReport(report: PlannerSmokeReport): string {
  return [
    "RIN planner smoke report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Plan ID: ${report.planId}`,
    `Checked steps: ${report.checkedStepCount}`,
    `Completed steps: ${report.completedStepCount}`,
    `Blocked steps: ${report.blockedStepCount}`,
    `Max steps: ${report.maxSteps}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Executed actions: ${report.executedActionCount}`,
    `Background loop started: ${report.backgroundLoopStarted ? "yes" : "no"}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Self-checks:",
    ...formatSelfChecks(report.selfChecks),
  ].join("\n");
}

function checkPlanStep(step: PlanStep): SelfCheckResult {
  if (!step.actionId) {
    return {
      stepId: step.id,
      passed: true,
      reason: "no_action_required",
      dryRun: null,
    };
  }

  const dryRun = dryRunAction(step.actionId);

  return {
    stepId: step.id,
    passed: dryRun.status === "dry_run_allowed",
    reason: dryRun.status,
    dryRun,
  };
}

function formatSelfChecks(checks: readonly SelfCheckResult[]): string[] {
  if (checks.length === 0) {
    return ["none"];
  }

  return checks.map(
    (check) =>
      `- ${check.stepId} passed=${check.passed ? "yes" : "no"} reason=${check.reason}`,
  );
}
