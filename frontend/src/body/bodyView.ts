export type BodyViewSettings = {
  scale: number;
  x: number;
  y: number;
  anchorY: number;
  /** desktop window width (px) — syncs to Electron main.cjs --win-width */
  winWidth: number;
  /** character image display height in desktop (px) */
  bodyHeight: number;
  /** reserved height above character for speech bubble (px) */
  bubbleArea: number;
  /** speech bubble width (px) */
  bubbleWidth: number;
  /** bubble internal padding (css shorthand) */
  bubblePadding: string;
  /** bubble text font size (px) */
  bubbleFontSize: number;
  /** chat input width (px) */
  chatWidth: number;
  /** chat bar distance from window bottom (px) */
  chatBottom: number;
};

function clamp(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

function clampStr(val: unknown, fallback: string): string {
  return typeof val === "string" && val.length > 0 ? val : fallback;
}

const DEFAULTS: BodyViewSettings = {
  scale: 1,
  x: 0,
  y: 0,
  anchorY: 50,
  winWidth: 240,
  bodyHeight: 380,
  bubbleArea: 86,
  bubbleWidth: 160,
  bubblePadding: "6px 8px",
  bubbleFontSize: 11,
  chatWidth: 140,
  chatBottom: 4,
};

const BODY_VIEW_KEY = "rin-body-view";

export function loadBodyView(): BodyViewSettings {
  try {
    const raw = localStorage.getItem(BODY_VIEW_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      scale: clamp(parsed.scale, 0.3, 3.0, DEFAULTS.scale),
      x: clamp(parsed.x, -400, 400, DEFAULTS.x),
      y: clamp(parsed.y, -400, 400, DEFAULTS.y),
      anchorY: clamp(parsed.anchorY, 0, 100, DEFAULTS.anchorY),
      winWidth: clamp(parsed.winWidth, 120, 800, DEFAULTS.winWidth),
      bodyHeight: clamp(parsed.bodyHeight, 120, 900, DEFAULTS.bodyHeight),
      bubbleArea: clamp(parsed.bubbleArea, 0, 200, DEFAULTS.bubbleArea),
      bubbleWidth: clamp(parsed.bubbleWidth, 80, 400, DEFAULTS.bubbleWidth),
      bubblePadding: clampStr(parsed.bubblePadding, DEFAULTS.bubblePadding),
      bubbleFontSize: clamp(parsed.bubbleFontSize, 8, 24, DEFAULTS.bubbleFontSize),
      chatWidth: clamp(parsed.chatWidth, 80, 400, DEFAULTS.chatWidth),
      chatBottom: clamp(parsed.chatBottom, 0, 60, DEFAULTS.chatBottom),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveBodyView(view: BodyViewSettings) {
  try {
    localStorage.setItem(BODY_VIEW_KEY, JSON.stringify(view));
  } catch {
    /* quota exceeded — non-critical */
  }
}

/** Apply all body view settings as CSS custom properties on <html> */
export function applyBodyViewToDocument(view: BodyViewSettings) {
  const root = document.documentElement;
  root.style.setProperty("--body-scale", String(view.scale));
  root.style.setProperty("--body-offset-x", `${view.x}px`);
  root.style.setProperty("--body-offset-y", `${view.y}px`);
  root.style.setProperty("--body-anchor-y", `${view.anchorY}%`);
  root.style.setProperty("--win-width", `${view.winWidth}px`);
  root.style.setProperty("--body-height", `${view.bodyHeight}px`);
  root.style.setProperty("--bubble-area", `${view.bubbleArea}px`);
  root.style.setProperty("--bubble-width", `${view.bubbleWidth}px`);
  root.style.setProperty("--bubble-padding", view.bubblePadding);
  root.style.setProperty("--bubble-font-size", `${view.bubbleFontSize}px`);
  root.style.setProperty("--chat-width", `${view.chatWidth}px`);
  root.style.setProperty("--chat-bottom", `${view.chatBottom}px`);
}
