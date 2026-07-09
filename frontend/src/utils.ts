import type { GlitchErrorItem, WindowType } from "./types";
import type { Density, DisplayMode, DisplaySize } from "./visualization";

export const LAYOUT_KEY = "rin.glitch-core.window-layout.v10";
export const UI_SETTINGS_KEY = "rin.glitch-core.ui-settings.v2";
export const CHARACTER_KEY = "rin.glitch-core.character.v1";
export const CONVERSATION_KEY = "rin.glitch-core.active-conversation.v1";

export const PERSISTENT_TYPES = new Set<WindowType>([
  "purpose", "chat", "memory", "tasks", "body", "settings"
]);

export const REUSABLE_WINDOW_TYPES = new Set<WindowType>([
  "purpose", "chat", "memory", "tasks", "body", "settings", "developer"
]);

export function safeDisplayJson(value: unknown) {
  return JSON.stringify(value, null, 2)
    .replaceAll("<think>", "[thinking-tag]")
    .replaceAll("</think>", "[/thinking-tag]");
}

export function displaySafeValue(value: unknown): string {
  if (value === null || value === undefined) return "n/a";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return safeDisplayJson(value);
}

export function formatCost(value: number) {
  return value === 0 ? "0.000000" : value.toFixed(6);
}

export function shortLabel(value: string) {
  if (!value || value === "n/a") return "n/a";
  return value.replace("T", " ").replace("Z", "").slice(0, 19);
}

export function errorFingerprint(error: GlitchErrorItem): string {
  return `${error.code}::${error.module}::${error.message}::${error.lastStep}`;
}

export function compactError(error: unknown): GlitchErrorItem {
  const message = error instanceof Error ? error.message : String(error);
  return {
    id: `client-${Date.now()}`,
    code: "CLIENT_RUNTIME_ERROR",
    severity: "error",
    module: "frontend",
    message,
    lastStep: "browser api request",
    traceAvailable: false
  };
}

export function isDisplayMode(value: unknown): value is DisplayMode {
  return value === "basic" || value === "advanced" || value === "developer";
}

export function isDisplaySize(value: unknown): value is DisplaySize {
  return value === "small" || value === "normal" || value === "large" || value === "xl";
}

export function isDensity(value: unknown): value is Density {
  return value === "compact" || value === "normal" || value === "detailed";
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function distribution(values: string[]) {
  const counts = values.reduce<Record<string, number>>((items, value) => {
    items[value] = (items[value] ?? 0) + 1;
    return items;
  }, {});
  return Object.entries(counts).map(([label, value]) => ({ label, value: String(value) }));
}

export function uniqueValues(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function recordDistributionSegments(counts: Record<string, number>) {
  return Object.entries(counts).map(([label, value]) => ({ label, value, tone: label }));
}

export function levelValue(value: string | number) {
  if (typeof value === "number") return Math.max(0, Math.min(1, value));
  const normalized = value.toLowerCase();
  if (["high", "positive", "immersed", "stable", "activated"].includes(normalized)) return 0.82;
  if (["medium", "normal", "neutral", "calm"].includes(normalized)) return 0.58;
  if (["low", "negative", "scattered", "blocked", "stressed", "unstable"].includes(normalized)) return 0.28;
  return 0.12;
}
