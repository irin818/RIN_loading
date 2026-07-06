export type BodyViewSettings = { scale: number; x: number; y: number; anchorY: number };

const BODY_VIEW_KEY = "rin-body-view";

function clamp(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

const DEFAULTS: BodyViewSettings = { scale: 1, x: 0, y: 0, anchorY: 35 };

export function loadBodyView(): BodyViewSettings {
  try {
    const raw = localStorage.getItem(BODY_VIEW_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      scale: clamp(parsed.scale, 0.3, 3.0, DEFAULTS.scale),
      x: clamp(parsed.x, -200, 200, DEFAULTS.x),
      y: clamp(parsed.y, -200, 200, DEFAULTS.y),
      anchorY: clamp(parsed.anchorY, 0, 100, DEFAULTS.anchorY),
    };
  } catch { return { ...DEFAULTS }; }
}

export function saveBodyView(view: BodyViewSettings) {
  try { localStorage.setItem(BODY_VIEW_KEY, JSON.stringify(view)); } catch {}
}

export function applyBodyViewToDocument(view: BodyViewSettings) {
  const root = document.documentElement;
  root.style.setProperty("--body-scale", String(view.scale));
  root.style.setProperty("--body-offset-x", `${view.x}px`);
  root.style.setProperty("--body-offset-y", `${view.y}px`);
  root.style.setProperty("--body-anchor-y", `${view.anchorY}%`);
}
