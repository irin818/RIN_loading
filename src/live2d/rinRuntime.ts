export const RIN_LIVE2D_MODEL_ID = "rin-live2d-layered-mvp-v1";

export const RIN_LIVE2D_ASSETS = {
  bustFront: "/live2d/rin/rin-bust-front.png",
  frontFullBody: "/live2d/rin/rin-front-fullbody.png",
  frontBodyNoTail: "/live2d/rin/rin-front-body-no-tail.png",
  tailLarge: "/live2d/rin/rin-tail-large.png",
  foxMask: "/live2d/rin/rin-fox-mask.png",
  ponytail: "/live2d/rin/rin-ponytail.png",
  earPair: "/live2d/rin/rin-ear-pair.png",
  eyesDetail: "/live2d/rin/rin-eyes-detail.png",
  mouthSet: "/live2d/rin/rin-mouth-set.png",
  manifest: "/live2d/rin/rin-runtime-manifest.json",
} as const;

export const RIN_LIVE2D_EXPRESSIONS = [
  "neutral",
  "listening",
  "focused",
  "thinking",
  "happy",
  "warning",
  "sleepy",
  "confused",
  "slight-smile",
  "dissatisfied",
] as const;

export const RIN_LIVE2D_MOTIONS = [
  "idle-breathing",
  "attentive-sway",
  "focused-still",
  "sleepy-breathing",
  "soft-sway",
] as const;

export type RinLive2dExpression = (typeof RIN_LIVE2D_EXPRESSIONS)[number];
export type RinLive2dMotion = (typeof RIN_LIVE2D_MOTIONS)[number];

export type RinLive2dVisualState = {
  expression: RinLive2dExpression;
  motion: RinLive2dMotion;
  idleBehavior: string;
};

const expressionAliases: Record<string, RinLive2dExpression> = {
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

export function resolveRinLive2dVisualState(
  aiState: Record<string, unknown>,
): RinLive2dVisualState {
  const mood = readString(aiState.mood) ?? "neutral";
  const attention = readString(aiState.attention) ?? "idle";
  const requestedExpression = readString(aiState.expression);
  const energy = readString(aiState.energy) ?? "normal";
  const expression = normalizeRinLive2dExpression(
    requestedExpression ?? attention ?? mood,
    energy,
  );

  return {
    expression,
    motion: selectRinLive2dMotion(expression, attention, energy),
    idleBehavior: "blink-breathe-ear-twitch-hair-pendant-tail-sway",
  };
}

export function normalizeRinLive2dExpression(
  value: string,
  energy: string = "normal",
): RinLive2dExpression {
  const normalized = value.trim().toLowerCase().replaceAll("_", "-");

  if (normalized in expressionAliases) {
    return expressionAliases[normalized];
  }

  if (energy === "low") {
    return "sleepy";
  }

  return "neutral";
}

export function selectRinLive2dMotion(
  expression: RinLive2dExpression,
  attention: string,
  energy: string,
): RinLive2dMotion {
  if (expression === "warning" || expression === "focused") {
    return "focused-still";
  }

  if (expression === "sleepy" || energy === "low") {
    return "sleepy-breathing";
  }

  if (expression === "happy" || expression === "slight-smile") {
    return "soft-sway";
  }

  if (attention === "active" || expression === "listening") {
    return "attentive-sway";
  }

  return "idle-breathing";
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
