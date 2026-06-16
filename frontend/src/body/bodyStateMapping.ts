import type { GlitchSnapshot } from "../types";
import type { BodyActivity, BodyStatePayload } from "./types";
import { BODY_STATE_KEYS } from "./types";

const DEFAULT_BODY_STATE: BodyStatePayload = {
  activeRenderer: "layered",
  activity: "idle",
  expression: "neutral",
  motion: "idle",
  intensity: 0.5,
  attentionState: "idle",
  speechState: "silent",
  warningLevel: 0
};

const BODY_STATE_SET = new Set<BodyActivity>(BODY_STATE_KEYS);

export function normalizeBodyActivity(value: unknown): BodyActivity {
  return typeof value === "string" && BODY_STATE_SET.has(value as BodyActivity)
    ? (value as BodyActivity)
    : "idle";
}

export function normalizeBodyState(value: unknown): BodyStatePayload {
  if (!value || typeof value !== "object") {
    return DEFAULT_BODY_STATE;
  }
  const record = value as Record<string, unknown>;
  const activity = normalizeBodyActivity(record.activity);
  return {
    activeRenderer: typeof record.activeRenderer === "string" ? record.activeRenderer : "layered",
    activity,
    expression: typeof record.expression === "string" ? record.expression : "neutral",
    motion: typeof record.motion === "string" ? record.motion : activity,
    intensity: typeof record.intensity === "number" ? clamp(record.intensity, 0, 1) : 0.5,
    attentionState: typeof record.attentionState === "string" ? record.attentionState : activity,
    speechState: typeof record.speechState === "string" ? record.speechState : "silent",
    warningLevel: typeof record.warningLevel === "number" ? Math.max(0, record.warningLevel) : 0
  };
}

export function bodyStateFromSnapshot(snapshot: GlitchSnapshot | null): BodyStatePayload {
  const state = normalizeBodyState(snapshot?.body?.bodyState);
  const latestTrace = snapshot?.trace.latest;
  if (latestTrace?.status === "failed" || (snapshot?.errors.length ?? 0) > 0) {
    return { ...state, activity: "error", motion: "error", warningLevel: 2 };
  }
  if (state.speechState === "speaking") {
    return { ...state, activity: "speaking", motion: "speaking" };
  }
  return state;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
