import type { BodyAdapter, BodyState } from "./types";

type ExpressionKey =
  | "neutral"
  | "listening"
  | "focused"
  | "thinking"
  | "happy"
  | "warning"
  | "sleepy"
  | "confused"
  | "slight-smile"
  | "dissatisfied";

const expressionAliases: Record<string, ExpressionKey> = {
  active: "listening",
  alert: "warning",
  attentive: "listening",
  calm: "neutral",
  concentrate: "focused",
  confused: "confused",
  dissatisfied: "dissatisfied",
  focused: "focused",
  happy: "happy",
  listening: "listening",
  neutral: "neutral",
  noticed: "listening",
  sad: "sleepy",
  sleepy: "sleepy",
  "slight-smile": "slight-smile",
  smile: "slight-smile",
  thinking: "thinking",
  tired: "sleepy",
  warning: "warning",
};

export const rinLive2dBodyAdapter: BodyAdapter = {
  id: "rin-live2d-layered-mvp-v1",
  displayName: "RIN Live2D Layered MVP V1",
  kind: "live2d",
  mapState(aiState: Record<string, unknown>): BodyState {
    const mood = readString(aiState.mood) ?? "neutral";
    const attention = readString(aiState.attention) ?? "idle";
    const requestedExpression = readString(aiState.expression);
    const energy = readString(aiState.energy) ?? "normal";
    const expression = normalizeExpression(
      requestedExpression ?? attention ?? mood,
      energy,
    );

    return {
      emotion: mood,
      expression,
      motion: selectMotion(expression, attention, energy),
      voiceStyle: readString(aiState.voiceStyle) ?? "soft",
      mouthSync: "idle",
      idleBehavior: "blink-breathe-ear-twitch-hair-pendant-tail-sway",
      attention,
    };
  },
};

function normalizeExpression(
  value: string,
  energy: string,
): ExpressionKey {
  const normalized = value.trim().toLowerCase().replaceAll("_", "-");

  if (normalized in expressionAliases) {
    return expressionAliases[normalized];
  }

  if (energy === "low") {
    return "sleepy";
  }

  return "neutral";
}

function selectMotion(
  expression: ExpressionKey,
  attention: string,
  energy: string,
): string {
  if (expression === "warning" || expression === "focused") {
    return "focused-still";
  }

  if (expression === "sleepy" || energy === "low") {
    return "sleepy-breathing";
  }

  if (attention === "active" || expression === "listening") {
    return "attentive-sway";
  }

  if (expression === "happy" || expression === "slight-smile") {
    return "soft-sway";
  }

  return "idle-breathing";
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
