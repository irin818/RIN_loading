import { placeholderBodyAdapter } from "./placeholderAdapter";
import { rinChibiBodyAdapter } from "./rinChibiAdapter";
import { rinLive2dBodyAdapter } from "./rinLive2dAdapter";
import type { BodyAdapter, BodyState } from "./types";

export type BodyAdapterSummary = {
  id: string;
  kind: BodyAdapter["kind"];
  displayName: string;
};

export type BodySmokeReport = {
  mode: "body-smoke";
  status: "ready";
  adapterCount: number;
  adapters: BodyAdapterSummary[];
  bodyReplaceable: true;
  identityStoredInBody: false;
  memoryStoredInBody: false;
  policyStoredInBody: false;
  live2dHardDependencyInCore: false;
  providerCallCount: 0;
  fullTextIncluded: false;
};

export type BodyStateReport = {
  mode: "body-state-report";
  status: "ready";
  adapterId: string;
  adapterKind: BodyAdapter["kind"];
  bodyState: BodyState;
  bodyReplaceable: true;
  identityStoredInBody: false;
  memoryStoredInBody: false;
  policyStoredInBody: false;
  providerCallCount: 0;
  fullTextIncluded: false;
};

const BUILTIN_BODY_ADAPTERS = [
  placeholderBodyAdapter,
  rinChibiBodyAdapter,
  rinLive2dBodyAdapter,
] as const;

const DEFAULT_BODY_STATE_INPUT = {
  mood: "calm",
  expression: "neutral",
  motion: "idle-breathing",
  voiceStyle: "soft",
  idle_state: "calm-idle",
  attention: "idle",
};

export function buildBodySmokeReport(): BodySmokeReport {
  const adapters = BUILTIN_BODY_ADAPTERS.map((adapter) => ({
    id: adapter.id,
    kind: adapter.kind,
    displayName: adapter.displayName,
  })).sort((left, right) => left.id.localeCompare(right.id));

  return {
    mode: "body-smoke",
    status: "ready",
    adapterCount: adapters.length,
    adapters,
    bodyReplaceable: true,
    identityStoredInBody: false,
    memoryStoredInBody: false,
    policyStoredInBody: false,
    live2dHardDependencyInCore: false,
    providerCallCount: 0,
    fullTextIncluded: false,
  };
}

export function buildBodyStateReport(
  adapter: BodyAdapter = rinChibiBodyAdapter,
  aiState: Record<string, unknown> = DEFAULT_BODY_STATE_INPUT,
): BodyStateReport {
  return {
    mode: "body-state-report",
    status: "ready",
    adapterId: adapter.id,
    adapterKind: adapter.kind,
    bodyState: adapter.mapState(aiState),
    bodyReplaceable: true,
    identityStoredInBody: false,
    memoryStoredInBody: false,
    policyStoredInBody: false,
    providerCallCount: 0,
    fullTextIncluded: false,
  };
}

export function formatBodySmokeReport(report: BodySmokeReport): string {
  return [
    "RIN body smoke report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Adapters: ${report.adapterCount}`,
    `Body replaceable: ${report.bodyReplaceable ? "yes" : "no"}`,
    `Identity stored in body: ${report.identityStoredInBody ? "yes" : "no"}`,
    `Memory stored in body: ${report.memoryStoredInBody ? "yes" : "no"}`,
    `Policy stored in body: ${report.policyStoredInBody ? "yes" : "no"}`,
    `Live2D hard dependency in core: ${report.live2dHardDependencyInCore ? "yes" : "no"}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
    "Adapters:",
    ...report.adapters.map(
      (adapter) =>
        `- ${adapter.id} kind=${adapter.kind} display=${adapter.displayName}`,
    ),
  ].join("\n");
}

export function formatBodyStateReport(report: BodyStateReport): string {
  return [
    "RIN body state report.",
    `Mode: ${report.mode}`,
    `Status: ${report.status}`,
    `Adapter ID: ${report.adapterId}`,
    `Adapter kind: ${report.adapterKind}`,
    `Emotion: ${report.bodyState.emotion}`,
    `Expression: ${report.bodyState.expression}`,
    `Motion: ${report.bodyState.motion}`,
    `Voice style: ${report.bodyState.voiceStyle}`,
    `Mouth sync: ${report.bodyState.mouthSync}`,
    `Idle behavior: ${report.bodyState.idleBehavior}`,
    `Attention: ${report.bodyState.attention}`,
    `Body replaceable: ${report.bodyReplaceable ? "yes" : "no"}`,
    `Identity stored in body: ${report.identityStoredInBody ? "yes" : "no"}`,
    `Memory stored in body: ${report.memoryStoredInBody ? "yes" : "no"}`,
    `Policy stored in body: ${report.policyStoredInBody ? "yes" : "no"}`,
    `providerCallCount: ${report.providerCallCount}`,
    `Full text included: ${report.fullTextIncluded ? "yes" : "no"}`,
  ].join("\n");
}
