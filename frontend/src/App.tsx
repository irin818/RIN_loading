import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  Dispatch,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  SetStateAction
} from "react";

import {
  approveGrowthEvent,
  approveImprovementProposal,
  approveMindMemoryCandidate,
  approveToolRequest,
  convertImprovementProposalToCodexDraft,
  deactivateMindMemoryCandidate,
  fetchGlitchSnapshot,
  fetchMemoryCards,
  reactivateMindMemoryCandidate,
  rejectGrowthEvent,
  rejectImprovementProposal,
  rejectMindMemoryCandidate,
  rejectToolRequest,
  runSelfReview,
  sendChatMessage,
  updateMindMemoryCandidateSafeFields
} from "./api";
import { BodyPanel } from "./body/BodyPanel";
import { BodyStandalonePage } from "./body/BodyStandalonePage";
import { normalizeBodyState } from "./body/bodyState";
import type {
  ChatMessage,
  ConsoleWindow,
  ConsoleDataMapBlock,
  ConfigRegistryPayload,
  CognitionFlowPayload,
  GlitchErrorItem,
  GlitchSnapshot,
  ImprovementProposal,
  MemoryCard,
  MemoryCandidateAnalytics,
  MindCandidateSafePatch,
  MindContextAnalytics,
  MindMemoryAnalytics,
  MindMemoryCandidate,
  MindContextPlan,
  MindOwnerState,
  MindOwnerStateTrend,
  MindResponsePlan,
  MindTraceAnalytics,
  RuntimeTrace,
  WindowPayload,
  WindowType
} from "./types";
import {
  ChartCard,
  DataTable,
  EmptyState,
  ExplanationList,
  JsonInspector,
  MetricCard,
  MiniBar,
  ReviewStatusBadge,
  RiskBadge,
  SectionPanel,
  SegmentedControl,
  StackedBar,
  StatusBadge,
  Timeline
} from "./visualization";
import type { Density, DisplayMode, DisplaySize } from "./visualization";

const LAYOUT_KEY = "rin.glitch-core.window-layout.v2";
const UI_SETTINGS_KEY = "rin.glitch-core.ui-settings.v1";
const PERSISTENT_TYPES = new Set<WindowType>([
  "body",
  "chat",
  "memory",
  "context",
  "trace",
  "cognition",
  "cost",
  "mind",
  "control"
]);
const REUSABLE_WINDOW_TYPES = new Set<WindowType>([
  "core",
  "body",
  "chat",
  "memory",
  "context",
  "trace",
  "cognition",
  "provider",
  "cost",
  "mind",
  "control",
  "tasks",
  "tools",
  "settings",
  "system"
]);

type CoreVisualState =
  | "idle"
  | "thinking"
  | "streaming"
  | "memory"
  | "warning"
  | "error"
  | "critical";

type WindowMeta = {
  label: string;
  context: string;
  code: string;
};

const WINDOW_META: Record<WindowType, WindowMeta> = {
  core: { label: "Core Status", context: "RIN Core", code: "CORE" },
  body: { label: "Body", context: "Layered Avatar", code: "BODY" },
  chat: { label: "Chat", context: "Default Session", code: "CHAT" },
  memory: { label: "Memory", context: "Recent Memories", code: "MEM" },
  memoryDetail: { label: "Memory Detail", context: "Memory Record", code: "MEM+" },
  context: { label: "Context", context: "Context Plan", code: "CTX" },
  trace: { label: "Trace", context: "Runtime Trace", code: "TRC" },
  cognition: { label: "Cognition Flow", context: "Latest Turn", code: "COG" },
  provider: { label: "Provider", context: "API Provider", code: "PRV" },
  cost: { label: "Cost / Token", context: "Usage Ledger", code: "COST" },
  mind: { label: "RIN Mind", context: "Mind Snapshot", code: "MIND" },
  error: { label: "Error", context: "Runtime Error", code: "ERR" },
  tasks: { label: "Tasks", context: "Mission Queue", code: "TASK" },
  tools: { label: "Tools", context: "Tool Layer", code: "TOOL" },
  control: { label: "Control", context: "Governance", code: "CTRL" },
  settings: { label: "Settings", context: "Local UI", code: "SET" },
  system: { label: "System", context: "Health", code: "SYS" }
};

const DOMAIN_NAV_ITEMS: Array<{ label: string; type: WindowType; tone: string }> = [
  { label: "Overview", type: "core", tone: "overview" },
  { label: "Body", type: "body", tone: "body" },
  { label: "Chat", type: "chat", tone: "chat" },
  { label: "Mind", type: "mind", tone: "mind" },
  { label: "Cognition", type: "cognition", tone: "runtime" },
  { label: "Memory", type: "memory", tone: "memory" },
  { label: "Context", type: "context", tone: "context" },
  { label: "Runtime", type: "trace", tone: "runtime" },
  { label: "Cost", type: "cost", tone: "cost" },
  { label: "Control", type: "control", tone: "control" }
];

const DEFAULT_LAYOUT: Array<Pick<
  ConsoleWindow,
  "type" | "contextName" | "x" | "y" | "width" | "height"
>> = [
  { type: "core", contextName: "RIN Overview", x: 20, y: 52, width: 300, height: 230 },
  { type: "body", contextName: "Body", x: 332, y: 52, width: 300, height: 380 },
  { type: "chat", contextName: "Default Session", x: 20, y: 298, width: 300, height: 300 },
  { type: "mind", contextName: "Mind Snapshot", x: 644, y: 52, width: 300, height: 230 },
  { type: "memory", contextName: "Memory Governance", x: 956, y: 52, width: 300, height: 230 },
  { type: "context", contextName: "Context Plan", x: 644, y: 298, width: 300, height: 300 },
  { type: "trace", contextName: "Runtime Trace", x: 956, y: 298, width: 300, height: 300 },
  { type: "cost", contextName: "DeepSeek Usage", x: 332, y: 524, width: 300, height: 244 }
];

const SPAWN_LAYOUT: Record<WindowType, {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}> = {
  core: { x: 440, y: 58, width: 410, height: 250, offsetX: 18, offsetY: 18 },
  body: { x: 494, y: 58, width: 380, height: 480, offsetX: 24, offsetY: 20 },
  chat: { x: 44, y: 84, width: 430, height: 516, offsetX: 34, offsetY: 28 },
  memory: { x: 828, y: 84, width: 420, height: 488, offsetX: -34, offsetY: 28 },
  memoryDetail: { x: 520, y: 118, width: 430, height: 420, offsetX: 28, offsetY: 28 },
  context: { x: 474, y: 408, width: 560, height: 330, offsetX: 34, offsetY: -22 },
  trace: { x: 346, y: 396, width: 570, height: 268, offsetX: 38, offsetY: -24 },
  cognition: { x: 372, y: 74, width: 620, height: 540, offsetX: 30, offsetY: 24 },
  provider: { x: 838, y: 424, width: 390, height: 244, offsetX: -30, offsetY: -18 },
  cost: { x: 54, y: 470, width: 438, height: 300, offsetX: 30, offsetY: -26 },
  mind: { x: 464, y: 156, width: 460, height: 360, offsetX: 26, offsetY: 22 },
  error: { x: 500, y: 124, width: 460, height: 340, offsetX: 28, offsetY: 30 },
  tasks: { x: 96, y: 128, width: 420, height: 320, offsetX: 32, offsetY: 30 },
  tools: { x: 744, y: 154, width: 410, height: 318, offsetX: -32, offsetY: 30 },
  control: { x: 708, y: 118, width: 520, height: 430, offsetX: -28, offsetY: 28 },
  settings: { x: 510, y: 166, width: 430, height: 320, offsetX: 26, offsetY: 26 },
  system: { x: 496, y: 96, width: 460, height: 360, offsetX: 24, offsetY: 26 }
};

function windowTitle(type: WindowType, instanceNumber: number, contextName: string) {
  return `${WINDOW_META[type].label} #${instanceNumber} · ${contextName}`;
}

function windowTypeClass(type: WindowType) {
  return type.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function spawnRect(type: WindowType, instanceNumber: number) {
  const base = SPAWN_LAYOUT[type];
  const offsetIndex = Math.max(0, instanceNumber - 1);
  const lane = offsetIndex % 6;
  const stack = Math.floor(offsetIndex / 6);
  return {
    x: base.x + base.offsetX * lane + stack * 16,
    y: base.y + base.offsetY * lane + stack * 18,
    width: base.width,
    height: base.height
  };
}

function makeWindow(
  type: WindowType,
  instanceNumber: number,
  zIndex: number,
  overrides: Partial<ConsoleWindow> = {}
): ConsoleWindow {
  const layout = instanceNumber === 1
    ? DEFAULT_LAYOUT.find((item) => item.type === type)
    : undefined;
  const fallback = spawnRect(type, instanceNumber);
  const contextName = overrides.contextName ?? layout?.contextName ?? WINDOW_META[type].context;
  const x = overrides.x ?? layout?.x ?? fallback.x;
  const y = overrides.y ?? layout?.y ?? fallback.y;
  const width = overrides.width ?? layout?.width ?? fallback.width;
  const height = overrides.height ?? layout?.height ?? fallback.height;
  const fitted = fitWindowToViewport({ x, y, width, height });
  return {
    id: overrides.id ?? `${type}-${Date.now()}-${instanceNumber}`,
    type,
    instanceNumber,
    contextName,
    title: windowTitle(type, instanceNumber, contextName),
    x: fitted.x,
    y: fitted.y,
    width: fitted.width,
    height: fitted.height,
    zIndex,
    minimized: overrides.minimized ?? false,
    maximized: overrides.maximized ?? false,
    visible: overrides.visible ?? true,
    payload: overrides.payload
  };
}

function defaultWindows() {
  return DEFAULT_LAYOUT.map((item, index) =>
    makeWindow(item.type, 1, 20 + index, item)
  );
}

function fitWindowToViewport(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  if (typeof window === "undefined") {
    return rect;
  }
  const viewportWidth = Math.max(320, window.innerWidth);
  const viewportHeight = Math.max(360, window.innerHeight - 46);
  const width = Math.min(rect.width, Math.max(280, viewportWidth - 24));
  const height = Math.min(rect.height, Math.max(220, viewportHeight - 24));
  return {
    width,
    height,
    x: Math.max(0, Math.min(rect.x, viewportWidth - width - 12)),
    y: Math.max(0, Math.min(rect.y, viewportHeight - height - 12))
  };
}

function loadLayout(): ConsoleWindow[] {
  const raw = localStorage.getItem(LAYOUT_KEY);
  if (!raw) {
    return defaultWindows();
  }
  try {
    const parsed = JSON.parse(raw) as ConsoleWindow[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultWindows();
    }
    return parsed.map((item, index) => {
      const fitted = fitWindowToViewport(item);
      return {
        ...item,
        ...fitted,
        title: windowTitle(item.type, item.instanceNumber, item.contextName),
        zIndex: item.zIndex || 20 + index
      };
    });
  } catch {
    return defaultWindows();
  }
}

function initialInstanceCounts(windows: ConsoleWindow[]) {
  return windows.reduce<Partial<Record<WindowType, number>>>((counts, item) => {
    counts[item.type] = Math.max(counts[item.type] ?? 0, item.instanceNumber);
    return counts;
  }, {});
}

function loadUiSettings(): {
  displayMode: DisplayMode;
  displaySize: DisplaySize;
  density: Density;
} {
  const fallback = {
    displayMode: "advanced" as DisplayMode,
    displaySize: "normal" as DisplaySize,
    density: "normal" as Density
  };
  const raw = localStorage.getItem(UI_SETTINGS_KEY);
  if (!raw) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<typeof fallback>;
    return {
      displayMode: isDisplayMode(parsed.displayMode) ? parsed.displayMode : fallback.displayMode,
      displaySize: isDisplaySize(parsed.displaySize) ? parsed.displaySize : fallback.displaySize,
      density: isDensity(parsed.density) ? parsed.density : fallback.density
    };
  } catch {
    return fallback;
  }
}

function isDisplayMode(value: unknown): value is DisplayMode {
  return value === "basic" || value === "advanced" || value === "developer";
}

function isDisplaySize(value: unknown): value is DisplaySize {
  return value === "small" || value === "normal" || value === "large" || value === "xl";
}

function isDensity(value: unknown): value is Density {
  return value === "compact" || value === "normal" || value === "detailed";
}

function compactError(error: unknown): GlitchErrorItem {
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

function errorFingerprint(error: GlitchErrorItem): string {
  return `${error.code}::${error.module}::${error.message}::${error.lastStep}`;
}

function safeDisplayJson(value: unknown) {
  return JSON.stringify(value, null, 2)
    .replaceAll("<think>", "[thinking-tag]")
    .replaceAll("</think>", "[/thinking-tag]");
}

function displaySafeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return safeDisplayJson(value);
}

function topmostVisibleWindow(windows: ConsoleWindow[]) {
  return windows
    .filter((item) => item.visible && !item.minimized)
    .reduce<ConsoleWindow | null>((top, item) => {
      if (!top || item.zIndex > top.zIndex) {
        return item;
      }
      return top;
    }, null);
}

function isTextEntryElement(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

function deriveCoreVisualState(
  snapshot: GlitchSnapshot | null,
  chatBusy: boolean
): CoreVisualState {
  if (snapshot?.errors.some((item) => item.severity === "critical")) {
    return "critical";
  }
  if (snapshot?.errors.some((item) => item.severity === "error")) {
    return "error";
  }
  if (
    snapshot?.errors.some((item) => item.severity === "warning") ||
    snapshot?.core.status === "warning" ||
    snapshot?.provider.health === "warning"
  ) {
    return "warning";
  }
  if (chatBusy) {
    return "thinking";
  }
  if (snapshot?.trace.latest?.status === "running") {
    return "streaming";
  }
  if ((snapshot?.memory.totalVisible ?? 0) > 0) {
    return "memory";
  }
  return "idle";
}

function currentBodyRoute(): "body" | "floating" | null {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/body/floating") {
    return "floating";
  }
  if (path === "/body") {
    return "body";
  }
  return null;
}

export default function App() {
  const bodyRoute = currentBodyRoute();
  if (bodyRoute) {
    return <BodyStandaloneSurface mode={bodyRoute} />;
  }
  return <GlitchCoreApp />;
}

function GlitchCoreApp() {
  const [snapshot, setSnapshot] = useState<GlitchSnapshot | null>(null);
  const [windows, setWindows] = useState<ConsoleWindow[]>(() => loadLayout());
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [windowsMenuOpen, setWindowsMenuOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryCompact, setMemoryCompact] = useState(true);
  const [lastChatContent, setLastChatContent] = useState("");
  const [uiSettings, setUiSettings] = useState(() => loadUiSettings());
  const instanceCounts = useRef(initialInstanceCounts(windows));
  const zCounter = useRef(Math.max(40, ...windows.map((item) => item.zIndex)));
  const openedTraceErrorIds = useRef(new Set<string>());
  const coreVisualState = deriveCoreVisualState(snapshot, chatBusy);
  const handleBackgroundPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
      const y = (event.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
      event.currentTarget.style.setProperty("--parallax-x", x.toFixed(4));
      event.currentTarget.style.setProperty("--parallax-y", y.toFixed(4));
    },
    []
  );

  useEffect(() => {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(windows));
  }, [windows]);

  useEffect(() => {
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(uiSettings));
  }, [uiSettings]);

  useEffect(() => {
    if (!activeWindowId && windows[0]) {
      setActiveWindowId(windows[0].id);
    }
  }, [activeWindowId, windows]);

  const focusWindow = useCallback((id: string) => {
    zCounter.current += 1;
    setActiveWindowId(id);
    setWindows((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, zIndex: zCounter.current, minimized: false, visible: true }
          : item
      )
    );
  }, []);

  const updateWindow = useCallback((id: string, patch: Partial<ConsoleWindow>) => {
    setWindows((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              title: windowTitle(
                patch.type ?? item.type,
                patch.instanceNumber ?? item.instanceNumber,
                patch.contextName ?? item.contextName
              )
            }
          : item
      )
    );
  }, []);

  const openWindow = useCallback(
    (
      type: WindowType,
      options: {
        contextName?: string;
        payload?: WindowPayload;
        focusExistingId?: string;
      } = {}
    ) => {
      if (options.focusExistingId) {
        focusWindow(options.focusExistingId);
        return;
      }
      const reusable = REUSABLE_WINDOW_TYPES.has(type) && !options.payload
        ? windows.find(
            (item) =>
              item.type === type &&
              !item.payload &&
              (!options.contextName || item.contextName === options.contextName)
          )
        : undefined;
      if (reusable) {
        focusWindow(reusable.id);
        return;
      }
      const next = (instanceCounts.current[type] ?? 0) + 1;
      instanceCounts.current[type] = next;
      zCounter.current += 1;
      const created = makeWindow(type, next, zCounter.current, {
        contextName: options.contextName,
        payload: options.payload
      });
      setWindows((items) => [...items, created]);
      setActiveWindowId(created.id);
    },
    [focusWindow, windows]
  );

  const openErrorWindow = useCallback(
    (error: GlitchErrorItem) => {
      const fingerprint = errorFingerprint(error);
      const existing = windows.find(
        (item) =>
          item.type === "error" &&
          item.payload?.error &&
          errorFingerprint(item.payload.error as GlitchErrorItem) === fingerprint
      );
      if (existing) {
        const existingError = existing.payload!.error as GlitchErrorItem;
        const repeatCount = (existingError.repeatCount ?? 1) + 1;
        zCounter.current += 1;
        setWindows((items) =>
          items.map((item) =>
            item.id === existing.id
              ? {
                  ...item,
                  zIndex: zCounter.current,
                  minimized: false,
                  visible: true,
                  contextName: `${error.code} (×${repeatCount})`,
                  title: windowTitle(
                    item.type,
                    item.instanceNumber,
                    `${error.code} (×${repeatCount})`
                  ),
                  payload: {
                    error: {
                      ...existingError,
                      id: error.id,
                      repeatCount,
                    } as GlitchErrorItem,
                  },
                }
              : item
          )
        );
        setActiveWindowId(existing.id);
        return;
      }
      openWindow("error", {
        contextName: error.code,
        payload: { error: { ...error, repeatCount: 1 } }
      });
    },
    [openWindow, windows]
  );

  const refreshSnapshot = useCallback(
    async (conversationId = snapshot?.selectedConversationId ?? null) => {
      try {
        const payload = await fetchGlitchSnapshot(conversationId, memoryQuery);
        setSnapshot(payload);
      } catch (error) {
        openErrorWindow(compactError(error));
      }
    },
    [memoryQuery, openErrorWindow, snapshot?.selectedConversationId]
  );

  useEffect(() => {
    void refreshSnapshot(null);
    const timer = window.setInterval(() => void refreshSnapshot(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    for (const error of snapshot.errors) {
      if (openedTraceErrorIds.current.has(error.id)) {
        continue;
      }
      openedTraceErrorIds.current.add(error.id);
      if (error.severity === "critical" || error.severity === "error") {
        openErrorWindow(error);
      }
    }
  }, [openErrorWindow, snapshot]);

  const closeWindow = useCallback((id: string) => {
    setWindows((items) =>
      items.flatMap((item) => {
        if (item.id !== id) {
          return [item];
        }
        if (PERSISTENT_TYPES.has(item.type)) {
          return [{ ...item, visible: false, minimized: false }];
        }
        return [];
      })
    );
    setActiveWindowId((current) => (current === id ? null : current));
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) {
        return;
      }
      if (isTextEntryElement(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        event.target.blur();
        return;
      }
      if (windowsMenuOpen) {
        event.preventDefault();
        event.stopPropagation();
        setWindowsMenuOpen(false);
        return;
      }
      const focused = windows.find(
        (item) => item.id === activeWindowId && item.visible && !item.minimized
      );
      const top = focused ?? topmostVisibleWindow(windows);
      if (!top) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      closeWindow(top.id);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeWindowId, closeWindow, windows, windowsMenuOpen]);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((items) =>
      items.map((item) =>
        item.id === id ? { ...item, minimized: true, visible: true } : item
      )
    );
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    setWindows((items) =>
      items.map((item) =>
        item.id === id ? { ...item, maximized: !item.maximized, minimized: false } : item
      )
    );
    focusWindow(id);
  }, [focusWindow]);

  const focusPanel = useCallback((id: string) => {
    zCounter.current += 1;
    setWindows((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              zIndex: zCounter.current,
              maximized: true,
              minimized: false,
              visible: true
            }
          : item.maximized
            ? { ...item, maximized: false }
            : item
      )
    );
    setActiveWindowId(id);
  }, []);

  const restoreFocusMode = useCallback(() => {
    setWindows((items) => items.map((item) => ({ ...item, maximized: false })));
  }, []);

  const resetLayout = useCallback(() => {
    const next = defaultWindows();
    instanceCounts.current = initialInstanceCounts(next);
    zCounter.current = 40;
    setWindows(next);
    setActiveWindowId(next[0]?.id ?? null);
  }, []);

  const restoreAll = useCallback(() => {
    setWindows((items) =>
      items.map((item) => ({ ...item, minimized: false, visible: true }))
    );
  }, []);

  const minimizeAll = useCallback(() => {
    setWindows((items) => items.map((item) => ({ ...item, minimized: true })));
  }, []);

  const submitChat = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || chatBusy) {
        return;
      }
      setChatBusy(true);
      setLastChatContent(trimmed);
      try {
        const result = await sendChatMessage(trimmed, snapshot?.selectedConversationId);
        setChatInput("");
        await refreshSnapshot(result.conversationId);
      } catch (error) {
        openErrorWindow(compactError(error));
      } finally {
        setChatBusy(false);
      }
    },
    [chatBusy, openErrorWindow, refreshSnapshot, snapshot?.selectedConversationId]
  );

  const searchMemory = useCallback(async () => {
    try {
      const cards = await fetchMemoryCards(memoryQuery);
      setSnapshot((current) =>
        current
          ? {
              ...current,
              memory: {
                ...current.memory,
                cards,
                totalVisible: cards.length,
                query: memoryQuery
              }
            }
          : current
      );
    } catch (error) {
      openErrorWindow(compactError(error));
    }
  }, [memoryQuery, openErrorWindow]);

  const reviewMindCandidate = useCallback(
    async (
      candidateId: string,
      action: "approve" | "reject" | "deactivate" | "reactivate"
    ) => {
      try {
        if (action === "approve") {
          await approveMindMemoryCandidate(candidateId);
        } else if (action === "reject") {
          await rejectMindMemoryCandidate(candidateId);
        } else if (action === "deactivate") {
          await deactivateMindMemoryCandidate(candidateId);
        } else {
          await reactivateMindMemoryCandidate(candidateId);
        }
        await refreshSnapshot();
      } catch (error) {
        openErrorWindow(compactError(error));
      }
    },
    [openErrorWindow, refreshSnapshot]
  );

  const editMindCandidate = useCallback(
    async (candidateId: string, patch: MindCandidateSafePatch) => {
      try {
        await updateMindMemoryCandidateSafeFields(candidateId, patch);
        await refreshSnapshot();
      } catch (error) {
        openErrorWindow(compactError(error));
      }
    },
    [openErrorWindow, refreshSnapshot]
  );

  const reviewGrowthEvent = useCallback(
    async (eventId: string, action: "approve" | "reject") => {
      try {
        if (action === "approve") {
          await approveGrowthEvent(eventId);
        } else {
          await rejectGrowthEvent(eventId);
        }
        await refreshSnapshot();
      } catch (error) {
        openErrorWindow(compactError(error));
      }
    },
    [openErrorWindow, refreshSnapshot]
  );

  const reviewToolRequest = useCallback(
    async (requestId: string, action: "approve" | "reject") => {
      try {
        if (action === "approve") {
          await approveToolRequest(requestId);
        } else {
          await rejectToolRequest(requestId);
        }
        await refreshSnapshot();
      } catch (error) {
        openErrorWindow(compactError(error));
      }
    },
    [openErrorWindow, refreshSnapshot]
  );

  const runSelfReviewAction = useCallback(async () => {
    try {
      await runSelfReview();
      await refreshSnapshot();
    } catch (error) {
      openErrorWindow(compactError(error));
    }
  }, [openErrorWindow, refreshSnapshot]);

  const reviewImprovementProposal = useCallback(
    async (
      proposalId: string,
      action: "approve" | "reject" | "convert"
    ) => {
      try {
        if (action === "approve") {
          await approveImprovementProposal(proposalId);
        } else if (action === "reject") {
          await rejectImprovementProposal(proposalId);
        } else {
          await convertImprovementProposalToCodexDraft(proposalId);
        }
        await refreshSnapshot();
      } catch (error) {
        openErrorWindow(compactError(error));
      }
    },
    [openErrorWindow, refreshSnapshot]
  );

  const visibleWindows = windows.filter((item) => item.visible && !item.minimized);
  const minimizedWindows = windows.filter((item) => item.minimized);
  const hiddenWindows = windows.filter((item) => !item.visible);
  const focusedWindow = visibleWindows.find((item) => item.maximized);
  const errorCount = snapshot?.errors.length ?? 0;

  return (
    <div
      className={`rin-os core-state-${coreVisualState} display-${uiSettings.displayMode} size-${uiSettings.displaySize} density-${uiSettings.density}`}
      onPointerMove={handleBackgroundPointerMove}
    >
      <div className="scanline-layer" />
      <div className="noise-layer" />
      <TopMenu
        snapshot={snapshot}
        coreVisualState={coreVisualState}
        errorCount={errorCount}
        windows={windows}
        minimizedWindows={minimizedWindows}
        hiddenWindows={hiddenWindows}
        windowsMenuOpen={windowsMenuOpen}
        setWindowsMenuOpen={setWindowsMenuOpen}
        openWindow={openWindow}
        focusWindow={focusWindow}
        restoreAll={restoreAll}
        minimizeAll={minimizeAll}
        resetLayout={resetLayout}
        uiSettings={uiSettings}
        setUiSettings={setUiSettings}
      />
      <main className="workspace">
        <CoreBackground snapshot={snapshot} visualState={coreVisualState} />
        {focusedWindow ? (
          <FocusNav
            windows={visibleWindows}
            activeWindowId={focusedWindow.id}
            onFocusPanel={focusPanel}
            onRestore={restoreFocusMode}
          />
        ) : null}
        {visibleWindows.map((item) => (
          <WindowFrame
            key={item.id}
            win={item}
            active={item.id === activeWindowId}
            onFocus={focusWindow}
            onUpdate={updateWindow}
            onClose={closeWindow}
            onMinimize={minimizeWindow}
            onMaximize={toggleMaximize}
          >
            <WindowContent
              win={item}
              snapshot={snapshot}
              chatInput={chatInput}
              setChatInput={setChatInput}
              chatBusy={chatBusy}
              lastChatContent={lastChatContent}
              submitChat={submitChat}
              refreshSnapshot={refreshSnapshot}
              memoryCompact={memoryCompact}
              setMemoryCompact={setMemoryCompact}
              memoryQuery={memoryQuery}
              setMemoryQuery={setMemoryQuery}
              searchMemory={searchMemory}
              reviewMindCandidate={reviewMindCandidate}
              editMindCandidate={editMindCandidate}
              reviewGrowthEvent={reviewGrowthEvent}
              reviewToolRequest={reviewToolRequest}
              runSelfReviewAction={runSelfReviewAction}
              reviewImprovementProposal={reviewImprovementProposal}
              uiSettings={uiSettings}
              setUiSettings={setUiSettings}
              openWindow={openWindow}
              openErrorWindow={openErrorWindow}
              closeWindow={closeWindow}
            />
          </WindowFrame>
        ))}
      </main>
    </div>
  );
}

function BodyStandaloneSurface({ mode }: { mode: "body" | "floating" }) {
  return <BodyStandalonePage mode={mode} />;
}

function TopMenu(props: {
  snapshot: GlitchSnapshot | null;
  coreVisualState: CoreVisualState;
  errorCount: number;
  windows: ConsoleWindow[];
  minimizedWindows: ConsoleWindow[];
  hiddenWindows: ConsoleWindow[];
  windowsMenuOpen: boolean;
  setWindowsMenuOpen: (open: boolean) => void;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload; focusExistingId?: string }) => void;
  focusWindow: (id: string) => void;
  restoreAll: () => void;
  minimizeAll: () => void;
  resetLayout: () => void;
  uiSettings: {
    displayMode: DisplayMode;
    displaySize: DisplaySize;
    density: Density;
  };
  setUiSettings: Dispatch<SetStateAction<{
    displayMode: DisplayMode;
    displaySize: DisplaySize;
    density: Density;
  }>>;
}) {
  const coreStatus = props.snapshot?.core.status ?? "booting";
  const providerName = props.snapshot?.provider.activeProvider ?? "provider";
  const providerHealth = props.snapshot?.provider.health ?? "loading";
  const memoryCount = props.snapshot?.memory.totalVisible ?? 0;
  const activeTypes = new Set(
    props.windows
      .filter((item) => item.visible && !item.minimized)
      .map((item) => item.type)
  );
  const cost = props.snapshot?.cost;
  const displayCurrency = cost?.displayCurrency ?? cost?.currency ?? "USD";
  const costValue = cost?.configuredEstimatedCostCny
    ?? cost?.configuredEstimatedCostUsd
    ?? cost?.totalEstimatedCost
    ?? 0;

  return (
    <header className="system-menu">
      <div className="menu-zone menu-left">
        <button
          type="button"
          className="brand-chip command-chip"
          onClick={() => props.openWindow("core")}
        >
          <span>RIN_CORE_OS</span>
          <small className={`core-status-dot ${props.coreVisualState}`}>{coreStatus}</small>
        </button>
      </div>
      <nav className="menu-zone menu-center" aria-label="RIN data domains">
        {DOMAIN_NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`menu-button domain-${item.tone} ${activeTypes.has(item.type) ? "active" : ""}`}
            onClick={() => props.openWindow(item.type)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="menu-zone menu-right">
        <button
          type="button"
          className={`status-chip windows-chip ${props.windowsMenuOpen ? "active" : ""}`}
          onClick={() => props.setWindowsMenuOpen(!props.windowsMenuOpen)}
          title="Window and view controls"
        >
          <span>VIEW</span>
          <small>{props.uiSettings.displayMode}/{props.uiSettings.density}</small>
        </button>
        <button
          type="button"
          className="status-chip provider-chip"
          onClick={() => props.openWindow("provider")}
          title="Provider status"
        >
          <span>PRV</span>
          <small>{providerName} / {providerHealth}</small>
        </button>
        <button
          type="button"
          className="status-chip cost-chip"
          onClick={() => props.openWindow("cost")}
          title="Cost and token usage"
        >
          <span>COST</span>
          <small>{formatCost(costValue)} {displayCurrency}</small>
        </button>
        <button
          type="button"
          className="status-chip memory-chip"
          onClick={() => props.openWindow("memory")}
          title="Visible memory cards"
        >
          <span>MEM</span>
          <small>{memoryCount}</small>
        </button>
        <button
          type="button"
          className={`status-badge ${props.errorCount ? "danger" : ""}`}
          onClick={() => props.openWindow("error", { contextName: "Recent Errors" })}
        >
          ERR {props.errorCount}
        </button>
      </div>
      {props.windowsMenuOpen ? (
        <section className="windows-menu">
          <div className="window-view-controls">
            <SegmentedControl
              label="Mode"
              value={props.uiSettings.displayMode}
              options={["basic", "advanced", "developer"]}
              onChange={(displayMode) =>
                props.setUiSettings((current) => ({ ...current, displayMode }))
              }
            />
            <SegmentedControl
              label="Size"
              value={props.uiSettings.displaySize}
              options={["small", "normal", "large", "xl"]}
              onChange={(displaySize) =>
                props.setUiSettings((current) => ({ ...current, displaySize }))
              }
            />
            <SegmentedControl
              label="Density"
              value={props.uiSettings.density}
              options={["compact", "normal", "detailed"]}
              onChange={(density) =>
                props.setUiSettings((current) => ({ ...current, density }))
              }
            />
          </div>
          <div className="windows-menu-actions">
            <button type="button" onClick={props.restoreAll}>Restore all</button>
            <button type="button" onClick={props.minimizeAll}>Minimize all</button>
            <button type="button" onClick={props.resetLayout}>Reset layout</button>
            <button type="button" onClick={() => props.openWindow("provider")}>Provider</button>
            <button type="button" onClick={() => props.openWindow("tools")}>Tools</button>
            <button type="button" onClick={() => props.openWindow("tasks")}>Tasks</button>
            <button type="button" onClick={() => props.openWindow("settings")}>Settings</button>
            <button type="button" onClick={() => props.openWindow("system")}>System</button>
          </div>
          <WindowMenuList
            title="Open windows"
            windows={props.windows.filter((item) => item.visible && !item.minimized)}
            onFocus={props.focusWindow}
          />
          <WindowMenuList
            title="Minimized"
            windows={props.minimizedWindows}
            onFocus={props.focusWindow}
          />
          <WindowMenuList
            title="Hidden persistent"
            windows={props.hiddenWindows}
            onFocus={props.focusWindow}
          />
        </section>
      ) : null}
    </header>
  );
}

function WindowMenuList(props: {
  title: string;
  windows: ConsoleWindow[];
  onFocus: (id: string) => void;
}) {
  return (
    <div className="window-menu-list">
      <h3>{props.title}</h3>
      {props.windows.length ? (
        props.windows.map((item) => (
          <button key={item.id} type="button" onClick={() => props.onFocus(item.id)}>
            {item.title}
          </button>
        ))
      ) : (
        <p>none</p>
      )}
    </div>
  );
}

function FocusNav(props: {
  windows: ConsoleWindow[];
  activeWindowId: string;
  onFocusPanel: (id: string) => void;
  onRestore: () => void;
}) {
  const majorWindows = props.windows.filter((item) =>
    ["core", "body", "chat", "mind", "memory", "context", "trace", "cost", "control"].includes(item.type)
  );
  return (
    <nav className="focus-nav" aria-label="Focus mode navigation">
      {majorWindows.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === props.activeWindowId ? "active" : ""}
          onClick={() => props.onFocusPanel(item.id)}
        >
          {WINDOW_META[item.type].code}
        </button>
      ))}
      <button type="button" onClick={props.onRestore}>RESTORE</button>
    </nav>
  );
}

function CoreBackground({
  snapshot,
  visualState
}: {
  snapshot: GlitchSnapshot | null;
  visualState: CoreVisualState;
}) {
  const assetPath = snapshot?.core.avatarAssetPath ?? "/picture/rin-core-background.png";
  return (
    <section className={`core-background core-visual-${visualState}`} aria-hidden="true">
      <div className="core-depth-layer far" />
      <div className="core-depth-layer near" />
      <img src={assetPath} alt="" className="core-rin-background-image" />
      <div className="data-grid data-grid-primary" />
      <div className="data-grid data-grid-secondary" />
      <div className="core-ring outer" />
      <div className="core-ring middle" />
      <div className="core-ring inner" />
      <div className="memory-fragment-field">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="core-eye-shell">
        <div className="core-eye-aperture" />
        <div className="core-eye-mask" />
        <div className="core-iris" />
        <div className="core-glitch-slice slice-a" />
        <div className="core-glitch-slice slice-b" />
        <div className="core-glitch-slice slice-c" />
      </div>
      <div className="foreground-trace-field">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="core-label">
        <span>RIN CORE</span>
        <small>{snapshot?.core.status ?? "booting"} / {visualState}</small>
      </div>
    </section>
  );
}

function WindowFrame(props: {
  win: ConsoleWindow;
  active: boolean;
  children: ReactNode;
  onFocus: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ConsoleWindow>) => void;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onMaximize: (id: string) => void;
}) {
  const { win } = props;
  const style: CSSProperties = win.maximized
    ? { zIndex: win.zIndex }
    : {
        transform: `translate(${win.x}px, ${win.y}px)`,
        width: `${win.width}px`,
        height: `${win.height}px`,
        zIndex: win.zIndex
      };

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (win.maximized) {
      return;
    }
    event.preventDefault();
    props.onFocus(win.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = win.x;
    const originY = win.y;
    const move = (moveEvent: PointerEvent) => {
      props.onUpdate(win.id, {
        x: Math.max(0, originX + moveEvent.clientX - startX),
        y: Math.max(0, originY + moveEvent.clientY - startY)
      });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    props.onFocus(win.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const originWidth = win.width;
    const originHeight = win.height;
    const move = (moveEvent: PointerEvent) => {
      props.onUpdate(win.id, {
        width: Math.max(300, originWidth + moveEvent.clientX - startX),
        height: Math.max(220, originHeight + moveEvent.clientY - startY)
      });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <section
      className={`os-window window-${windowTypeClass(win.type)} ${props.active ? "focused" : ""} ${win.maximized ? "maximized" : ""}`}
      data-window-type={win.type}
      style={style}
      onPointerDown={() => props.onFocus(win.id)}
    >
      <div
        className="window-titlebar"
        onPointerDown={beginDrag}
        onDoubleClick={() => props.onMaximize(win.id)}
      >
        <div>
          <span className="window-led" />
          <span className="window-type-badge">{WINDOW_META[win.type].code}</span>
          <strong>{win.title}</strong>
        </div>
        <div className="window-controls">
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => props.onMinimize(win.id)}>_</button>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => props.onMaximize(win.id)}>□</button>
          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => props.onClose(win.id)}>×</button>
        </div>
      </div>
      <div className="window-body">{props.children}</div>
      {!win.maximized ? <div className="resize-handle" onPointerDown={beginResize} /> : null}
    </section>
  );
}

function WindowContent(props: {
  win: ConsoleWindow;
  snapshot: GlitchSnapshot | null;
  chatInput: string;
  setChatInput: (value: string) => void;
  chatBusy: boolean;
  lastChatContent: string;
  submitChat: (content: string) => Promise<void>;
  refreshSnapshot: (conversationId?: string | null) => Promise<void>;
  memoryCompact: boolean;
  setMemoryCompact: (value: boolean) => void;
  memoryQuery: string;
  setMemoryQuery: (value: string) => void;
  searchMemory: () => Promise<void>;
  reviewMindCandidate: (
    candidateId: string,
    action: "approve" | "reject" | "deactivate" | "reactivate"
  ) => Promise<void>;
  editMindCandidate: (candidateId: string, patch: MindCandidateSafePatch) => Promise<void>;
  reviewGrowthEvent: (eventId: string, action: "approve" | "reject") => Promise<void>;
  reviewToolRequest: (requestId: string, action: "approve" | "reject") => Promise<void>;
  runSelfReviewAction: () => Promise<void>;
  reviewImprovementProposal: (
    proposalId: string,
    action: "approve" | "reject" | "convert"
  ) => Promise<void>;
  uiSettings: {
    displayMode: DisplayMode;
    displaySize: DisplaySize;
    density: Density;
  };
  setUiSettings: Dispatch<SetStateAction<{
    displayMode: DisplayMode;
    displaySize: DisplaySize;
    density: Density;
  }>>;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload; focusExistingId?: string }) => void;
  openErrorWindow: (error: GlitchErrorItem) => void;
  closeWindow: (id: string) => void;
}) {
  switch (props.win.type) {
    case "core":
      return <CoreStatus snapshot={props.snapshot} />;
    case "body":
      return <BodyWindow snapshot={props.snapshot} />;
    case "chat":
      return <ChatWindow {...props} />;
    case "memory":
      return <MemoryWindow {...props} />;
    case "memoryDetail":
      return (
        <MemoryDetailWindow
          card={props.win.payload?.card as MemoryCard | undefined}
          displayMode={props.uiSettings.displayMode}
        />
      );
    case "context":
      return (
        <ContextWindow
          snapshot={props.snapshot}
          displayMode={props.uiSettings.displayMode}
        />
      );
    case "trace":
      return (
        <TraceWindow
          trace={props.snapshot?.trace.latest ?? null}
          analytics={props.snapshot?.mind.analytics?.trace}
          displayMode={props.uiSettings.displayMode}
        />
      );
    case "cognition":
      return (
        <CognitionFlowWindow
          flow={props.snapshot?.cognitionFlow}
          displayMode={props.uiSettings.displayMode}
          openWindow={props.openWindow}
        />
      );
    case "provider":
      return (
        <ProviderWindow
          snapshot={props.snapshot}
          openWindow={props.openWindow}
          displayMode={props.uiSettings.displayMode}
        />
      );
    case "cost":
      return <CostWindow snapshot={props.snapshot} displayMode={props.uiSettings.displayMode} />;
    case "control":
      return (
        <ControlWindow
          snapshot={props.snapshot}
          displayMode={props.uiSettings.displayMode}
          uiSettings={props.uiSettings}
          setUiSettings={props.setUiSettings}
          reviewGrowthEvent={props.reviewGrowthEvent}
          reviewToolRequest={props.reviewToolRequest}
          runSelfReviewAction={props.runSelfReviewAction}
          reviewImprovementProposal={props.reviewImprovementProposal}
          openWindow={props.openWindow}
        />
      );
    case "mind":
      return (
        <MindWindow
          snapshot={props.snapshot}
          reviewMindCandidate={props.reviewMindCandidate}
          editMindCandidate={props.editMindCandidate}
          displayMode={props.uiSettings.displayMode}
        />
      );
    case "error":
      return (
        <ErrorWindow
          error={props.win.payload?.error as GlitchErrorItem | undefined}
          trace={props.snapshot?.trace.latest ?? null}
          openWindow={props.openWindow}
          onDismiss={() => props.closeWindow(props.win.id)}
        />
      );
    case "tasks":
    case "tools":
    case "settings":
    case "system":
      return <StubWindow type={props.win.type} snapshot={props.snapshot} />;
    default:
      return null;
  }
}

function CoreStatus({ snapshot }: { snapshot: GlitchSnapshot | null }) {
  const health = snapshot?.dashboard.health ?? {};
  return (
    <div className="core-status">
      <div className="module-strip">RIN CORE PRESENCE</div>
      <div className="core-status-grid">
        <Metric label="Core" value={snapshot?.core.status ?? "booting"} />
        <Metric label="Mode" value={snapshot?.core.mode ?? "local-first"} />
        <Metric label="Schema" value={snapshot?.dashboard.database.schemaVersion ?? "n/a"} />
        <Metric label="Memory" value={snapshot?.dashboard.memoryContext.memoryV2Traces ?? 0} />
        <Metric label="Body" value={snapshot?.body?.currentState ?? "idle"} />
      </div>
      <div className="health-matrix">
        {Object.entries(health).map(([key, value]) => (
          <span key={key} className={`health-pill ${value}`}>
            {key}: {value}
          </span>
        ))}
      </div>
      <p className="readable-note">
        Local-first runtime shell. Provider calls stay behind FastAPI adapters.
      </p>
    </div>
  );
}

function BodyWindow({ snapshot }: { snapshot: GlitchSnapshot | null }) {
  const currentState = normalizeBodyState(snapshot?.body?.currentState);
  return (
    <div className="body-window">
      <div className="module-strip">ACTIVE BODY</div>
      <BodyPanel currentState={currentState} compact showControls />
      <div className="body-window-links">
        <a href="/body" target="_blank" rel="noreferrer">Open /body</a>
        <a href="/body/floating" target="_blank" rel="noreferrer">Open /body/floating</a>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <article className="hud-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ChatWindow(props: {
  snapshot: GlitchSnapshot | null;
  chatInput: string;
  setChatInput: (value: string) => void;
  chatBusy: boolean;
  lastChatContent: string;
  submitChat: (content: string) => Promise<void>;
  refreshSnapshot: (conversationId?: string | null) => Promise<void>;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
}) {
  const messages = props.snapshot?.messages ?? [];
  const messageListRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div className="chat-module">
      <div className="module-strip">
        CHAT LINK · {props.snapshot?.selectedConversationId ?? "new session"}
      </div>
      <div className="message-list" ref={messageListRef}>
        {messages.length ? (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        ) : (
          <p className="empty-state">No active conversation messages.</p>
        )}
        <div ref={bottomRef} />
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          void props.submitChat(props.chatInput);
        }}
      >
        <textarea
          value={props.chatInput}
          onChange={(event) => props.setChatInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void props.submitChat(props.chatInput);
            }
          }}
          placeholder="Send a local owner message..."
        />
        <div className="composer-actions">
          <button type="submit" disabled={props.chatBusy || !props.chatInput.trim()}>
            {props.chatBusy ? "SENDING" : "SEND"}
          </button>
          <button
            type="button"
            disabled={!props.lastChatContent || props.chatBusy}
            onClick={() => void props.submitChat(props.lastChatContent)}
          >
            RETRY
          </button>
          <button
            type="button"
            disabled={!props.snapshot?.trace.latest}
            onClick={() => props.openWindow("trace", { contextName: "Latest Turn" })}
          >
            OPEN TRACE
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <article className={`message-bubble ${message.role}`}>
      <header>
        <span>{message.role}</span>
        <small>{message.shortId}</small>
      </header>
      <p>{message.content}</p>
      {message.hiddenReasoningRedacted ? (
        <small className="message-safety-note">hidden reasoning redacted</small>
      ) : null}
    </article>
  );
}

function MemoryWindow(props: {
  snapshot: GlitchSnapshot | null;
  memoryCompact: boolean;
  setMemoryCompact: (value: boolean) => void;
  memoryQuery: string;
  setMemoryQuery: (value: string) => void;
  searchMemory: () => Promise<void>;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
}) {
  const cards = props.snapshot?.memory.cards ?? [];
  return (
    <div className="memory-module">
      <div className="module-strip">MEMORY V2 · READ ONLY</div>
      <div className="memory-toolbar">
        <input
          value={props.memoryQuery}
          onChange={(event) => props.setMemoryQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void props.searchMemory();
            }
          }}
          placeholder="Filter memory metadata..."
        />
        <button type="button" onClick={() => void props.searchMemory()}>SEARCH</button>
        <button type="button" onClick={() => props.setMemoryCompact(!props.memoryCompact)}>
          {props.memoryCompact ? "EXPAND" : "COMPACT"}
        </button>
      </div>
      <div className={`memory-waterfall ${props.memoryCompact ? "compact" : "expanded"}`}>
        {cards.length ? (
          cards.map((card) => (
            <button
              key={`${card.kind}-${card.id}`}
              type="button"
              className="memory-card"
              onClick={() =>
                props.openWindow("memoryDetail", {
                  contextName: card.title,
                  payload: { card }
                })
              }
            >
              <span>{card.kind}</span>
              <strong>{card.title}</strong>
              <p>{card.contentPreview}</p>
              <dl>
                <div><dt>type</dt><dd>{card.type}</dd></div>
                <div><dt>score</dt><dd>{card.salienceScore}</dd></div>
                <div><dt>updated</dt><dd>{card.updatedAt}</dd></div>
              </dl>
            </button>
          ))
        ) : (
          <p className="empty-state">No memory cards match this filter.</p>
        )}
      </div>
    </div>
  );
}

function MemoryDetailWindow({
  card,
  displayMode
}: {
  card?: MemoryCard;
  displayMode: DisplayMode;
}) {
  if (!card) {
    return <p className="empty-state">No memory card selected.</p>;
  }
  return (
    <div className="detail-module">
      <div className="module-strip">{card.kind} · {card.shortId}</div>
      <h2>{card.title}</h2>
      <p>{card.summary}</p>
      <dl className="detail-list">
        <div><dt>memory_id</dt><dd>{card.id}</dd></div>
        <div><dt>type</dt><dd>{card.type}</dd></div>
        <div><dt>source</dt><dd>{card.source}</dd></div>
        <div><dt>linked session</dt><dd>{card.linkedSession}</dd></div>
        <div><dt>created_at</dt><dd>{card.createdAt}</dd></div>
        <div><dt>updated_at</dt><dd>{card.updatedAt}</dd></div>
        <div><dt>last_used_at</dt><dd>{card.lastUsedAt}</dd></div>
        <div><dt>confidence</dt><dd>{card.confidence}</dd></div>
        <div><dt>importance</dt><dd>{card.importance}</dd></div>
      </dl>
      <div className="tag-row">
        {card.tags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <JsonInspector
        value={card.metadata}
        visible={displayMode === "developer"}
        stringify={safeDisplayJson}
      />
    </div>
  );
}

function TraceWindow(props: {
  trace: RuntimeTrace | null;
  analytics?: MindTraceAnalytics;
  displayMode: DisplayMode;
}) {
  const trace = props.trace;
  if (!trace) {
    return <p className="empty-state">No runtime trace captured yet.</p>;
  }
  const analytics = props.analytics;
  const stages = analytics?.stages ?? trace.stages.map((stage) => ({
    name: stage.name,
    displayName: stage.displayName,
    status: stage.status,
    durationMs: stage.durationMs,
    summary: stage.summary,
    startedAt: stage.startedAt,
    endedAt: stage.endedAt
  }));
  const maxDuration = Math.max(1, ...stages.map((stage) => stage.durationMs));
  const hasError = trace.status === "failed" || (analytics?.latest.errorCount ?? 0) > 0;
  return (
    <div className="trace-module">
      <div className="module-strip">TRACE · {trace.status}</div>
      <div className="trace-summary-grid">
        <MetricCard label="turn" value={trace.turnShortId} />
        <MetricCard label="status" value={<StatusBadge value={trace.status} />} tone={hasError ? "danger" : "ok"} />
        <MetricCard label="elapsed" value={`${trace.totalDurationMs}ms`} />
        <MetricCard label="provider" value={`${analytics?.latest.providerDurationMs ?? "n/a"}ms`} />
        <MetricCard label="warnings" value={analytics?.latest.warningCount ?? 0} tone="warn" />
        <MetricCard label="errors" value={analytics?.latest.errorCount ?? (hasError ? 1 : 0)} tone={hasError ? "danger" : "ok"} />
        <MetricCard label="owner input last" value={analytics?.latest.currentOwnerInputLast ? "yes" : "n/a"} />
        <MetricCard label="raw prompt" value="hidden" tone="ok" />
      </div>
      <SectionPanel title="Pipeline Timeline" defaultOpen>
        <Timeline
          events={stages.map((stage) => ({
            id: `${stage.name}-${stage.startedAt}`,
            type: stage.displayName,
            label: `${stage.durationMs}ms`,
            at: stage.startedAt,
            status: stage.status
          }))}
        />
      </SectionPanel>
      {props.displayMode !== "basic" ? (
        <SectionPanel title="Stage Durations" defaultOpen>
          <div className="duration-list">
            {stages.map((stage) => (
              <article key={`${stage.name}-duration`}>
                <header>
                  <strong>{stage.displayName}</strong>
                  <span>{stage.durationMs}ms</span>
                </header>
                <MiniBar value={stage.durationMs} max={maxDuration} label={stage.summary} />
                <p>{stage.summary}</p>
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}
      <SectionPanel title="Safety Flags" defaultOpen={props.displayMode !== "basic"}>
        <div className="tag-row">
          <span>rawPromptIncluded=false</span>
          <span>hiddenReasoningIncluded=false</span>
          <span>rawModelOutputIncluded=false</span>
          <span>privacy={trace.privacyMode}</span>
        </div>
        {hasError ? <p className="readable-note">Latest trace reports {trace.errorCode ?? "a runtime error"}.</p> : null}
      </SectionPanel>
      <JsonInspector value={trace} visible={props.displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
}

function CognitionFlowWindow(props: {
  flow?: CognitionFlowPayload;
  displayMode: DisplayMode;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
}) {
  const flow = props.flow;
  if (!flow) {
    return <EmptyState message="Cognition Flow loading." />;
  }
  const requestMessages = Array.isArray(flow.providerSentContext.messages)
    ? flow.providerSentContext.messages as Array<Record<string, unknown>>
    : [];
  const contextSegments = flow.contextSegments;
  const turnImpact = flow.turnImpact;
  return (
    <div className="cognition-module">
      <div className="module-strip">COGNITION FLOW · SAFE TURN CHAIN</div>
      <div className="control-grid">
        <MetricCard label="turn" value={flow.turnShortId} />
        <MetricCard label="status" value={<StatusBadge value={flow.status} />} />
        <MetricCard label="trace" value={flow.traceAvailable ? "available" : "missing"} tone={flow.traceAvailable ? "ok" : "warn"} />
        <MetricCard label="mind snapshot" value={flow.snapshotAvailable ? "available" : "missing"} tone={flow.snapshotAvailable ? "ok" : "warn"} />
        <MetricCard label="owner input last" value={flow.ownerInput.latestOwnerInputPreservedAsFinalOwnerMessage ? "yes" : "no"} tone={flow.ownerInput.latestOwnerInputPreservedAsFinalOwnerMessage ? "ok" : "danger"} />
        <MetricCard label="raw prompt" value="hidden" tone="ok" />
      </div>
      <SectionPanel title="Causal Chain" defaultOpen>
        <Timeline
          events={flow.steps.map((step) => ({
            id: step.id,
            type: step.label,
            label: `${step.status} · ${step.durationMs}ms`,
            at: flow.createdAt,
            status: step.status
          }))}
        />
        <div className="cognition-step-list">
          {flow.steps.map((step) => (
            <article key={step.id} className={`cognition-step ${step.status}`}>
              <header>
                <strong>{step.label}</strong>
                <StatusBadge value={step.status} />
              </header>
              <p>{step.summary}</p>
              <small>
                localOnly={String(step.localOnly)} · sentToProvider={String(step.sentToProvider)}
              </small>
              <JsonInspector value={step.details} visible={props.displayMode === "developer"} stringify={safeDisplayJson} />
            </article>
          ))}
        </div>
      </SectionPanel>
      <SectionPanel title="Provider Request Structure" defaultOpen={props.displayMode !== "basic"}>
        <div className="mind-plan-grid">
          <MetricCard label="messages" value={String(flow.providerSentContext.requestMessageCount ?? "n/a")} />
          <MetricCard label="chars" value={String(flow.providerSentContext.requestCharacterCount ?? "n/a")} />
          <MetricCard label="raw prompt" value="not included" tone="ok" />
          <MetricCard label="latest owner input" value={flow.providerSentContext.currentOwnerInputLast ? "last" : "check"} />
        </div>
        <DataTable
          columns={[
            { key: "index", label: "index" },
            { key: "role", label: "role" },
            { key: "chars", label: "chars" },
            { key: "source", label: "source" },
            { key: "preview", label: "preview" }
          ]}
          rows={requestMessages.map((message) => ({
            index: String(message.index ?? "n/a"),
            role: String(message.role ?? "n/a"),
            chars: String(message.characterCount ?? "n/a"),
            source: String(message.sourceComponent ?? "n/a"),
            preview: message.previewIncluded === false ? "hidden" : "hidden"
          }))}
          empty="No provider request outline available."
        />
      </SectionPanel>
      <SectionPanel title="Context Segments" defaultOpen={props.displayMode !== "basic"}>
        <DataTable
          columns={[
            { key: "source", label: "source" },
            { key: "included", label: "included" },
            { key: "reason", label: "reason" },
            { key: "risk", label: "risk" },
            { key: "tokens", label: "tokens" },
            { key: "preview", label: "safe preview" }
          ]}
          rows={contextSegments.slice(0, props.displayMode === "developer" ? 32 : 14).map((segment) => ({
            source: `${String(segment.sourceKind ?? "n/a")}:${String(segment.sourceId ?? "n/a")}`,
            included: String(segment.included ?? false),
            reason: String(segment.reason ?? "n/a"),
            risk: String(segment.riskLevel ?? "n/a"),
            tokens: String(segment.estimatedTokens ?? "n/a"),
            preview: String(segment.safePreview ?? "")
          }))}
          empty="No context segment evidence available yet."
        />
      </SectionPanel>
      <SectionPanel title="Local-only Decisions" defaultOpen={props.displayMode !== "basic"}>
        <DataTable
          columns={[
            { key: "label", label: "decision" },
            { key: "usedFor", label: "used for" },
            { key: "sent", label: "sent" },
            { key: "raw", label: "raw text" }
          ]}
          rows={flow.localOnlyDecisions.map((decision) => ({
            label: String(decision.label ?? decision.id ?? "decision"),
            usedFor: String(decision.usedFor ?? "n/a"),
            sent: String(decision.sentToProvider ?? false),
            raw: "hidden"
          }))}
          empty="No local-only decisions recorded."
        />
      </SectionPanel>
      <SectionPanel title="Provider Response And Sanitizer" defaultOpen={props.displayMode !== "basic"}>
        <div className="mind-plan-grid">
          <MetricCard label="raw len" value={String(flow.providerResponseMetadata.rawContentLength ?? "n/a")} />
          <MetricCard label="raw hash" value={String(flow.providerResponseMetadata.rawContentHash ?? "n/a")} />
          <MetricCard label="thinking tag" value={<StatusBadge value={Boolean(flow.sanitizer.thinkingTagDetected)} />} />
          <MetricCard label="removed" value={String(flow.sanitizer.removedCharacterCount ?? 0)} />
          <MetricCard label="final safe" value={<StatusBadge value={Boolean(flow.sanitizer.finalAnswerSafe)} />} />
          <MetricCard label="raw output" value="hidden" tone="ok" />
        </div>
      </SectionPanel>
      <SectionPanel title="Turn Impact" defaultOpen>
        <div className="control-grid">
          <MetricCard label="memory candidates" value={String(turnImpact.memoryCandidates ? (turnImpact.memoryCandidates as unknown[]).length : 0)} />
          <MetricCard label="growth events" value={String(turnImpact.growthEvents ? (turnImpact.growthEvents as unknown[]).length : 0)} />
          <MetricCard label="tool proposals" value={String(turnImpact.toolProposals ? (turnImpact.toolProposals as unknown[]).length : 0)} />
          <MetricCard label="audit events" value={String(turnImpact.auditEvents ? (turnImpact.auditEvents as unknown[]).length : 0)} />
        </div>
        <div className="inline-actions">
          <button type="button" onClick={() => props.openWindow("mind")}>Mind</button>
          <button type="button" onClick={() => props.openWindow("memory")}>Memory</button>
          <button type="button" onClick={() => props.openWindow("control")}>Control</button>
        </div>
      </SectionPanel>
      <SectionPanel title="Locked Self-evolution Boundary" defaultOpen={props.displayMode !== "basic"}>
        <DataTable
          columns={[
            { key: "capability", label: "capability" },
            { key: "enabled", label: "enabled" },
            { key: "locked", label: "locked" }
          ]}
          rows={flow.dangerousCapabilities.map((item) => ({
            capability: String(item.label ?? item.id ?? "capability"),
            enabled: String(item.enabled ?? false),
            locked: String(item.locked ?? true)
          }))}
          empty="No capability registry available."
        />
      </SectionPanel>
      <JsonInspector value={flow} visible={props.displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
}

function ProviderWindow(props: {
  snapshot: GlitchSnapshot | null;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
  displayMode: DisplayMode;
}) {
  const provider = props.snapshot?.provider;
  if (!provider) {
    return <p className="empty-state">Provider status loading.</p>;
  }
  return (
    <div className="provider-module">
      <div className="module-strip">PROVIDER STATUS · SAFE CONFIG</div>
      <div className="provider-grid">
        <MetricCard label="provider" value={provider.activeProvider} />
        <MetricCard label="adapter" value={provider.activeAdapter} />
        <MetricCard label="model" value={provider.activeModel} />
        <MetricCard label="health" value={<StatusBadge value={provider.health} />} />
        <MetricCard label="latency" value={provider.lastLatencyMs} />
        <MetricCard label="streaming" value={provider.streamingSupport} />
      </div>
      <JsonInspector value={provider.safeConfig} visible={props.displayMode === "developer"} stringify={safeDisplayJson} />
      {provider.lastError !== "n/a" ? (
        <button
          type="button"
          className="danger-action"
          onClick={() =>
            props.openWindow("error", {
              contextName: provider.lastError,
              payload: {
                error: {
                  id: `provider-${provider.lastError}`,
                  code: provider.lastError,
                  severity: "error",
                  module: "provider",
                  message: "Provider reported an error in the latest trace.",
                  lastStep: "provider",
                  traceAvailable: true
                }
              }
            })
          }
        >
          OPEN PROVIDER ERROR
        </button>
      ) : null}
    </div>
  );
}

function ContextWindow(props: { snapshot: GlitchSnapshot | null; displayMode: DisplayMode }) {
  const latest = props.snapshot?.mind.latest;
  const analytics = props.snapshot?.mind.analytics?.context;
  if (!latest) {
    return <p className="empty-state">No context plan captured yet.</p>;
  }
  const outline = analytics?.providerRequestOutline;
  return (
    <div className="context-module">
      <div className="module-strip">CONTEXT · PROVIDER REQUEST SHAPE</div>
      <div className="mind-plan-grid">
        <MetricCard label="messages" value={outline?.messageCount ?? "n/a"} />
        <MetricCard label="memory selected" value={outline?.selectedMemoryCount ?? latest.memoryRetrieval.selected.length} />
        <MetricCard label="memory excluded" value={outline?.excludedMemoryCount ?? latest.memoryRetrieval.excluded.length} />
        <MetricCard
          label="owner input last"
          value={outline?.currentOwnerInputLast ? "yes" : "n/a"}
          tone={outline?.currentOwnerInputLast ? "ok" : "warn"}
        />
      </div>
      <SectionPanel title="Context Budget" defaultOpen>
        <ContextPlanView
          analytics={analytics}
          fallbackPlan={latest.contextPlan}
          displayMode={props.displayMode}
        />
      </SectionPanel>
      <SectionPanel title="Safe Retrieval Inputs" defaultOpen={props.displayMode !== "basic"}>
        <div className="mind-list">
          {latest.memoryRetrieval.selected.length ? latest.memoryRetrieval.selected.map((item) => (
            <article key={`${item.sourceKind}:${item.sourceId}`} className="mind-row">
              <strong>{item.sourceKind}</strong>
              <p>{item.safeSummary}</p>
              {item.normalizedValue ? <small>{item.normalizedValue}</small> : null}
              <small>score={item.score} · rawTextIncluded=false</small>
            </article>
          )) : <EmptyState message="No memory selected for current provider context." />}
        </div>
      </SectionPanel>
      <SectionPanel title="Safety Flags" defaultOpen={props.displayMode !== "basic"}>
        <div className="tag-row">
          <span>rawPromptIncluded=false</span>
          <span>rawMemoryIncluded=false</span>
          <span>hiddenReasoningIncluded=false</span>
          <span>latestOwnerInputLast={String(outline?.currentOwnerInputLast ?? false)}</span>
        </div>
      </SectionPanel>
    </div>
  );
}

function ControlWindow(props: {
  snapshot: GlitchSnapshot | null;
  displayMode: DisplayMode;
  uiSettings: {
    displayMode: DisplayMode;
    displaySize: DisplaySize;
    density: Density;
  };
  setUiSettings: Dispatch<SetStateAction<{
    displayMode: DisplayMode;
    displaySize: DisplaySize;
    density: Density;
  }>>;
  reviewGrowthEvent: (eventId: string, action: "approve" | "reject") => Promise<void>;
  reviewToolRequest: (requestId: string, action: "approve" | "reject") => Promise<void>;
  runSelfReviewAction: () => Promise<void>;
  reviewImprovementProposal: (
    proposalId: string,
    action: "approve" | "reject" | "convert"
  ) => Promise<void>;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
}) {
  const mind = props.snapshot?.mind;
  const dataMap = props.snapshot?.dataMap;
  const configRegistry = props.snapshot?.configRegistry;
  const selfReview = props.snapshot?.selfReview;
  const improvementProposals = props.snapshot?.improvementProposals;
  const growthEvents = mind
    ? (mind.growthEvents.length ? mind.growthEvents : mind.latest?.growthEvents ?? [])
    : [];
  const toolRequests = mind
    ? (mind.toolInvocationRequests.length
      ? mind.toolInvocationRequests
      : mind.latest?.toolInvocationRequests ?? [])
    : [];
  const pendingGrowth = growthEvents.filter(
    (event) => !["owner_approved", "rejected"].includes(event.reviewStatus)
  );
  const pendingTools = toolRequests.filter(
    (request) => !["approved", "rejected", "executed", "blocked"].includes(request.status)
  );
  const policy = mind?.policy;
  const dangerousFlags = policy ? [
    ["embeddings", policy.enableEmbeddings],
    ["model summaries", policy.enableModelSummaries],
    ["agent tools", policy.enableAgentTools],
    ["high-risk memory export", policy.allowHighRiskMemoryExport],
    ["self-model auto apply", policy.selfModelAutoApply]
  ] : [];

  return (
    <div className="control-module">
      <div className="module-strip">CONTROL · GOVERNANCE CENTER</div>
      <div className="control-grid">
        <MetricCard label="data blocks" value={dataMap?.dataBlocks.length ?? 0} />
        <MetricCard label="memory candidates" value={mind?.candidateCount ?? 0} />
        <MetricCard label="growth pending" value={pendingGrowth.length} tone={pendingGrowth.length ? "warn" : "ok"} />
        <MetricCard label="tool proposals" value={pendingTools.length} tone={pendingTools.length ? "warn" : "ok"} />
        <MetricCard label="danger defaults" value={policy?.dangerousDefaultsDisabled ? "disabled" : "check"} tone={policy?.dangerousDefaultsDisabled ? "ok" : "danger"} />
        <MetricCard label="provider keys" value="hidden" tone="ok" />
      </div>
      <SectionPanel title="View Controls" defaultOpen>
        <div className="control-settings">
          <SegmentedControl
            label="Mode"
            value={props.uiSettings.displayMode}
            options={["basic", "advanced", "developer"]}
            onChange={(displayMode) =>
              props.setUiSettings((current) => ({ ...current, displayMode }))
            }
          />
          <SegmentedControl
            label="Size"
            value={props.uiSettings.displaySize}
            options={["small", "normal", "large", "xl"]}
            onChange={(displaySize) =>
              props.setUiSettings((current) => ({ ...current, displaySize }))
            }
          />
          <SegmentedControl
            label="Density"
            value={props.uiSettings.density}
            options={["compact", "normal", "detailed"]}
            onChange={(density) =>
              props.setUiSettings((current) => ({ ...current, density }))
            }
          />
        </div>
        <div className="windows-menu-actions inline-actions">
          <button type="button" onClick={() => props.openWindow("cognition")}>Cognition</button>
          <button type="button" onClick={() => props.openWindow("provider")}>Provider</button>
          <button type="button" onClick={() => props.openWindow("tools")}>Tools</button>
          <button type="button" onClick={() => props.openWindow("tasks")}>Tasks</button>
          <button type="button" onClick={() => props.openWindow("settings")}>Settings</button>
          <button type="button" onClick={() => props.openWindow("system")}>System</button>
        </div>
      </SectionPanel>
      <SectionPanel title="Config Registry" defaultOpen>
        <ConfigRegistryView registry={configRegistry} displayMode={props.displayMode} />
      </SectionPanel>
      <SectionPanel title="Self-review Reports" defaultOpen={props.displayMode !== "basic"}>
        <SelfReviewPanel
          selfReview={selfReview}
          onRunSelfReview={props.runSelfReviewAction}
          displayMode={props.displayMode}
        />
      </SectionPanel>
      <SectionPanel title="Improvement Proposals" defaultOpen>
        <ImprovementProposalPanel
          payload={improvementProposals}
          reviewImprovementProposal={props.reviewImprovementProposal}
          displayMode={props.displayMode}
        />
      </SectionPanel>
      <SectionPanel title="Policy Guardrails" defaultOpen>
        <div className="tag-row">
          {dangerousFlags.map(([label, enabled]) => (
            <span key={String(label)}>{label}: {enabled ? "enabled" : "disabled"}</span>
          ))}
        </div>
        {policy?.warnings.length ? (
          <ExplanationList items={policy.warnings} />
        ) : (
          <p className="readable-note">Dangerous capabilities are disabled by default and policy writes are not exposed here.</p>
        )}
      </SectionPanel>
      <SectionPanel title="Growth Governance" defaultOpen={props.displayMode !== "basic"}>
        <div className="governance-list">
          {growthEvents.length ? growthEvents.slice(0, 12).map((event) => {
            const actionable = !["owner_approved", "rejected"].includes(event.reviewStatus);
            return (
              <article key={event.id} className={`governance-row ${event.riskLevel}`}>
                <header>
                  <strong>{event.eventType}</strong>
                  <ReviewStatusBadge value={event.reviewStatus} />
                </header>
                <p>{event.summary}</p>
                <small>autoApplied=false · rawTextIncluded=false · active={String(event.active)}</small>
                {actionable ? (
                  <div className="mind-actions">
                    <button type="button" onClick={() => void props.reviewGrowthEvent(event.id, "approve")}>
                      APPROVE
                    </button>
                    <button type="button" onClick={() => void props.reviewGrowthEvent(event.id, "reject")}>
                      REJECT
                    </button>
                  </div>
                ) : null}
              </article>
            );
          }) : <EmptyState message="No growth events awaiting review." />}
        </div>
      </SectionPanel>
      <SectionPanel title="Tool Proposal Governance" defaultOpen={props.displayMode !== "basic"}>
        <div className="governance-list">
          {toolRequests.length ? toolRequests.slice(0, 12).map((request) => {
            const actionable = !["approved", "rejected", "executed", "blocked"].includes(request.status);
            return (
              <article key={request.id} className={`governance-row ${request.riskLevel}`}>
                <header>
                  <strong>{request.toolName}</strong>
                  <StatusBadge value={request.status} />
                </header>
                <p>{request.actionSummary}</p>
                <small>executionDisabledByDefault=true · rawInputIncluded=false</small>
                {actionable ? (
                  <div className="mind-actions">
                    <button type="button" onClick={() => void props.reviewToolRequest(request.id, "approve")}>
                      APPROVE PROPOSAL
                    </button>
                    <button type="button" onClick={() => void props.reviewToolRequest(request.id, "reject")}>
                      REJECT
                    </button>
                  </div>
                ) : null}
              </article>
            );
          }) : <EmptyState message="Tool execution remains disabled; no proposals." />}
        </div>
      </SectionPanel>
      <SectionPanel title="Data Map" defaultOpen={props.displayMode !== "basic"}>
        <DataMapView dataMap={dataMap} displayMode={props.displayMode} />
      </SectionPanel>
      <SectionPanel title="Provider And Cost Control" defaultOpen={props.displayMode === "developer"}>
        <div className="control-grid">
          <MetricCard label="provider" value={props.snapshot?.provider.activeProvider ?? "n/a"} />
          <MetricCard label="model" value={props.snapshot?.provider.activeModel ?? "n/a"} />
          <MetricCard label="pricing profile" value={props.snapshot?.cost.pricingProfile ?? "n/a"} />
          <MetricCard label="billing match" value={props.snapshot?.cost.officialBillingMatch ?? "n/a"} />
        </div>
        <p className="readable-note">Provider config is display-only. API keys and env values are never editable from this console.</p>
      </SectionPanel>
      <JsonInspector
        value={{ dataMap, policy, growthEvents, toolRequests, configRegistry, selfReview, improvementProposals }}
        visible={props.displayMode === "developer"}
        stringify={safeDisplayJson}
      />
    </div>
  );
}

function ConfigRegistryView(props: {
  registry?: ConfigRegistryPayload;
  displayMode: DisplayMode;
}) {
  const registry = props.registry;
  if (!registry) {
    return <EmptyState message="Configuration registry loading." />;
  }
  const highRiskCount = registry.items.filter((item) => item.riskLevel === "high").length;
  const editableCount = registry.items.filter((item) => item.editable).length;
  if (props.displayMode === "basic") {
    return (
      <div className="control-grid">
        <MetricCard label="sections" value={registry.sections.length} />
        <MetricCard label="items" value={registry.items.length} />
        <MetricCard label="high risk" value={highRiskCount} tone={highRiskCount ? "warn" : "ok"} />
        <MetricCard label="editable" value={editableCount} />
      </div>
    );
  }
  return (
    <div className="config-registry-view">
      <div className="data-map-grid">
        {registry.sections.map((section) => (
          <article key={section.id} className="data-domain domain-color-blue">
            <header>
              <strong>{section.label}</strong>
              <span>{registry.items.filter((item) => item.key.startsWith(section.id.split("-")[0])).length} items</span>
            </header>
            <small>{section.description}</small>
          </article>
        ))}
      </div>
      <DataTable
        columns={[
          { key: "key", label: "key" },
          { key: "value", label: "current" },
          { key: "source", label: "source" },
          { key: "risk", label: "risk" },
          { key: "editable", label: "edit" },
          { key: "effect", label: "affects" }
        ]}
        rows={registry.items.map((item) => ({
          key: item.key,
          value: displaySafeValue(item.currentValue),
          source: item.envName ? `${item.source}:${item.envName}` : item.source,
          risk: item.riskLevel,
          editable: item.editable ? "yes" : "locked",
          effect: item.affects.join(", ")
        }))}
      />
      <p className="readable-note">Backend config editing is disabled in v1 except existing safe memory fields. API keys and env values are never shown or edited here.</p>
      <JsonInspector value={registry} visible={props.displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
}

function SelfReviewPanel(props: {
  selfReview?: GlitchSnapshot["selfReview"];
  onRunSelfReview: () => Promise<void>;
  displayMode: DisplayMode;
}) {
  const selfReview = props.selfReview;
  if (!selfReview) {
    return <EmptyState message="Self-review reports loading." />;
  }
  return (
    <div className="self-review-panel">
      <div className="control-grid">
        <MetricCard label="reports" value={selfReview.reports.length} />
        <MetricCard label="proposal count" value={selfReview.proposalCount} />
        <MetricCard label="allowed level" value={`L${selfReview.allowedLevel}`} />
        <MetricCard label="L4+" value={selfReview.level4PlusLocked ? "locked" : "check"} tone={selfReview.level4PlusLocked ? "ok" : "danger"} />
      </div>
      <div className="inline-actions">
        <button type="button" onClick={() => void props.onRunSelfReview()}>
          RUN SELF REVIEW
        </button>
      </div>
      <div className="governance-list">
        {selfReview.reports.length ? selfReview.reports.slice(0, 6).map((report) => (
          <article key={report.id} className={`governance-row ${report.riskLevel}`}>
            <header>
              <strong>{shortLabel(report.createdAt)}</strong>
              <StatusBadge value={report.status} />
            </header>
            <p>{report.summary}</p>
            <small>proposalIds={report.proposalIds.length} · rawTextIncluded=false</small>
          </article>
        )) : <EmptyState message="No self-review report yet. Run manual self review when needed." />}
      </div>
      <JsonInspector value={selfReview} visible={props.displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
}

function ImprovementProposalPanel(props: {
  payload?: GlitchSnapshot["improvementProposals"];
  reviewImprovementProposal: (
    proposalId: string,
    action: "approve" | "reject" | "convert"
  ) => Promise<void>;
  displayMode: DisplayMode;
}) {
  const payload = props.payload;
  if (!payload) {
    return <EmptyState message="Improvement proposals loading." />;
  }
  return (
    <div className="proposal-panel">
      <div className="control-grid">
        <MetricCard label="proposals" value={payload.proposals.length} />
        <MetricCard label="execution" value={payload.executionEnabled ? "enabled" : "disabled"} tone={payload.executionEnabled ? "danger" : "ok"} />
        <MetricCard label="auto PR" value={payload.autoPrEnabled ? "enabled" : "disabled"} tone={payload.autoPrEnabled ? "danger" : "ok"} />
        <MetricCard label="code write" value={payload.autoCodeWriteEnabled ? "enabled" : "disabled"} tone={payload.autoCodeWriteEnabled ? "danger" : "ok"} />
      </div>
      <div className="governance-list">
        {payload.proposals.length ? payload.proposals.slice(0, 10).map((proposal) => (
          <ImprovementProposalRow
            key={proposal.id}
            proposal={proposal}
            reviewImprovementProposal={props.reviewImprovementProposal}
            displayMode={props.displayMode}
          />
        )) : <EmptyState message="No improvement proposals yet. Run manual self review to create safe proposals." />}
      </div>
      <JsonInspector value={payload} visible={props.displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
}

function ImprovementProposalRow(props: {
  proposal: ImprovementProposal;
  reviewImprovementProposal: (
    proposalId: string,
    action: "approve" | "reject" | "convert"
  ) => Promise<void>;
  displayMode: DisplayMode;
}) {
  const proposal = props.proposal;
  const actionable = !["rejected", "implemented", "verified", "archived", "blocked"].includes(proposal.status);
  return (
    <article className={`governance-row ${proposal.riskLevel}`}>
      <header>
        <strong>{proposal.title}</strong>
        <StatusBadge value={proposal.status} />
      </header>
      <p>{proposal.problemSummary}</p>
      <small>
        {proposal.type} · priority={proposal.priority} · requiresOwnerApproval={String(proposal.requiresOwnerApproval)}
      </small>
      {props.displayMode !== "basic" ? (
        <div className="proposal-details">
          <p>{proposal.expectedBenefit}</p>
          <small>{proposal.safetyImpact} · {proposal.dataPrivacyImpact}</small>
          {proposal.codexPromptDraft ? (
            <pre className="safe-json">{proposal.codexPromptDraft}</pre>
          ) : null}
        </div>
      ) : null}
      {actionable ? (
        <div className="mind-actions">
          <button type="button" onClick={() => void props.reviewImprovementProposal(proposal.id, "approve")}>
            APPROVE
          </button>
          <button type="button" onClick={() => void props.reviewImprovementProposal(proposal.id, "reject")}>
            REJECT
          </button>
          <button type="button" onClick={() => void props.reviewImprovementProposal(proposal.id, "convert")}>
            CODEX DRAFT
          </button>
        </div>
      ) : null}
    </article>
  );
}

function DataMapView(props: {
  dataMap?: GlitchSnapshot["dataMap"];
  displayMode: DisplayMode;
}) {
  const dataMap = props.dataMap;
  if (!dataMap) {
    return <EmptyState message="Console data map loading." />;
  }
  const blocksByDomain = new Map<string, ConsoleDataMapBlock[]>();
  for (const block of dataMap.dataBlocks) {
    blocksByDomain.set(block.domain, [...(blocksByDomain.get(block.domain) ?? []), block]);
  }
  if (props.displayMode === "basic") {
    return (
      <div className="data-map-basic">
        <MetricCard label="domains" value={dataMap.domains.length} />
        <MetricCard label="blocks" value={dataMap.dataBlocks.length} />
        <MetricCard label="raw prompt" value="hidden" tone="ok" />
        <MetricCard label="secrets" value="hidden" tone="ok" />
      </div>
    );
  }
  return (
    <div className="data-map-view">
      <div className="data-map-grid">
        {dataMap.domains.map((domain) => {
          const blocks = blocksByDomain.get(domain.id) ?? [];
          const writable = blocks.filter((block) => block.writable).length;
          return (
            <article key={domain.id} className={`data-domain domain-color-${domain.color}`}>
              <header>
                <strong>{domain.label}</strong>
                <span>{blocks.length} blocks</span>
              </header>
              <small>{writable} writable · {blocks.filter((block) => block.hasGovernanceActions).length} governed</small>
            </article>
          );
        })}
      </div>
      {props.displayMode === "developer" ? (
        <DataTable
          columns={[
            { key: "label", label: "block" },
            { key: "domain", label: "domain" },
            { key: "panel", label: "panel" },
            { key: "writable", label: "write" },
            { key: "actions", label: "actions" },
            { key: "safety", label: "safety" }
          ]}
          rows={dataMap.dataBlocks.map((block) => ({
            label: block.label,
            domain: block.domain,
            panel: block.recommendedPanel,
            writable: block.writable ? "yes" : "no",
            actions: block.controlActions.join(", ") || "none",
            safety: `${block.safetyLevel} / raw=${String(block.rawTextIncluded)}`
          }))}
          empty="No data blocks registered."
        />
      ) : null}
    </div>
  );
}

function CostWindow(props: { snapshot: GlitchSnapshot | null; displayMode: DisplayMode }) {
  const cost = props.snapshot?.cost;
  if (!cost) {
    return <p className="empty-state">Cost and token usage loading.</p>;
  }
  const latest = cost.latest;
  const maxRecentTokens = Math.max(1, ...cost.recent.map((item) => item.totalTokens));
  const avgTokens = cost.eventCount ? Math.round(cost.totalTokens / cost.eventCount) : 0;
  const displayCurrency = cost.displayCurrency ?? cost.currency;
  const displayTotal = cost.configuredEstimatedCostCny
    ?? cost.configuredEstimatedCostUsd
    ?? cost.totalEstimatedCost;
  const avgCost = cost.eventCount ? displayTotal / cost.eventCount : 0;
  const providerDistribution = distribution(cost.recent.map((item) => item.providerId));
  const modelDistribution = distribution(cost.recent.map((item) => item.model));
  const rangeAvailable = cost.minEstimatedCostUsd !== null
    && cost.maxEstimatedCostUsd !== null
    && cost.configuredEstimatedCostUsd !== null;
  return (
    <div className="cost-module">
      <div className="module-strip">COST / TOKEN · SAFE LEDGER</div>
      <div className="cost-grid">
        <MetricCard label="provider" value={cost.provider} />
        <MetricCard label="model" value={cost.model} />
        <MetricCard label="config" value={<StatusBadge value={cost.configurationStatus} />} />
        <MetricCard label="pricing" value={cost.pricingProfile} />
        <MetricCard label="unit" value={cost.pricingUnit} />
        <MetricCard label="billing match" value={<StatusBadge value={cost.officialBillingMatch} />} />
        <MetricCard label="records" value={cost.eventCount} />
        <MetricCard label="total tokens" value={cost.totalTokens} />
        <MetricCard
          label="total cost"
          value={`${formatCost(displayTotal)} ${displayCurrency}`}
        />
        <MetricCard label="avg tokens" value={avgTokens} />
        <MetricCard label="avg cost" value={`${formatCost(avgCost)} ${displayCurrency}`} />
        <MetricCard label="cache split" value={cost.cacheBreakdownAvailable ? "provider" : "estimated"} />
      </div>
      <div className="cost-latest">
        <span>latest turn</span>
        {latest ? (
          <strong>
            {latest.inputTokens} in / {latest.outputTokens} out / {latest.totalTokens} total · {formatCost(latest.configuredEstimatedCostCny ?? latest.configuredEstimatedCostUsd ?? latest.estimatedCost)} {latest.displayCurrency ?? latest.currency}
          </strong>
        ) : (
          <strong>no usage records yet</strong>
        )}
      </div>
      <ChartCard title="DeepSeek Cost Range" note={cost.cacheBreakdownAvailable ? "provider cache tokens available" : "cache breakdown unavailable"}>
        <div className="cost-range-grid">
          <MetricCard label="min usd" value={cost.minEstimatedCostUsd === null ? "n/a" : formatCost(cost.minEstimatedCostUsd)} />
          <MetricCard label="configured usd" value={cost.configuredEstimatedCostUsd === null ? "n/a" : formatCost(cost.configuredEstimatedCostUsd)} />
          <MetricCard label="max usd" value={cost.maxEstimatedCostUsd === null ? "n/a" : formatCost(cost.maxEstimatedCostUsd)} />
          <MetricCard label="configured cny" value={cost.configuredEstimatedCostCny === null ? "n/a" : formatCost(cost.configuredEstimatedCostCny)} />
        </div>
        {rangeAvailable ? (
          <StackedBar
            segments={[
              { label: "min", value: cost.minEstimatedCostUsd ?? 0, tone: "input" },
              { label: "configured", value: cost.configuredEstimatedCostUsd ?? 0, tone: "candidate" },
              { label: "max", value: cost.maxEstimatedCostUsd ?? 0, tone: "output" }
            ]}
          />
        ) : null}
        <p className="readable-note">{cost.explanation}</p>
      </ChartCard>
      {latest ? (
        <ChartCard title="Latest Input / Output Split">
          <StackedBar
            segments={[
              { label: "input", value: latest.inputTokens, tone: "input" },
              { label: "output", value: latest.outputTokens, tone: "output" }
            ]}
          />
          <p className="readable-note">
            Context characters: {latest.contextCharacterCount}. Raw prompt text is not exposed.
          </p>
        </ChartCard>
      ) : null}
      <div className="cost-record-list">
        {cost.recent.length ? (
          cost.recent.slice(0, 20).map((item) => (
            <article key={item.id} className="cost-record">
              <div>
                <span>{shortLabel(item.createdAt)}</span>
                <b>{item.totalTokens} tok</b>
              </div>
              <div className="cost-bar" aria-hidden="true">
                <span style={{ width: `${Math.max(4, (item.totalTokens / maxRecentTokens) * 100)}%` }} />
              </div>
              <small>
                {formatCost(item.configuredEstimatedCostCny ?? item.configuredEstimatedCostUsd ?? item.estimatedCost)} {item.displayCurrency ?? item.currency}
                {" "}· {item.estimateMethod} · {item.officialBillingMatch ?? "estimate"}
              </small>
            </article>
          ))
        ) : (
          <p className="empty-state">Configure API chat and complete a turn to record usage.</p>
        )}
      </div>
      {props.displayMode !== "basic" ? (
        <>
          <ChartCard title="Provider Distribution">
            <DataTable
              columns={[
                { key: "label", label: "provider/model" },
                { key: "value", label: "turns" }
              ]}
              rows={[...providerDistribution, ...modelDistribution]}
              empty="No provider usage records."
            />
          </ChartCard>
          <ExplanationList
            items={[
              "Token records are stored as safe usage metadata only.",
              "Context size is shown next to token use so high-cost turns can be diagnosed without exposing prompt text.",
              "DeepSeek official cache-hit billing can only be exact when provider usage includes cache hit and miss token counts.",
              "Daily trend needs more dated records; v1 keeps per-turn bars when history is short."
            ]}
          />
        </>
      ) : null}
      <JsonInspector value={cost} visible={props.displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
}

function MindWindow(props: {
  snapshot: GlitchSnapshot | null;
  reviewMindCandidate: (
    candidateId: string,
    action: "approve" | "reject" | "deactivate" | "reactivate"
  ) => Promise<void>;
  editMindCandidate: (candidateId: string, patch: MindCandidateSafePatch) => Promise<void>;
  displayMode: DisplayMode;
}) {
  const mind = props.snapshot?.mind;
  const latest = mind?.latest;
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  if (!mind || !latest) {
    return <p className="empty-state">No RIN Mind snapshot captured yet.</p>;
  }
  const understanding = latest.messageUnderstanding;
  const ownerState = latest.ownerState;
  const contextPlan = latest.contextPlan;
  const retrieval = latest.memoryRetrieval;
  const responsePlan = latest.responsePlan;
  const candidates = mind.memoryCandidates.length ? mind.memoryCandidates : latest.memoryCandidates;
  const analytics = mind.analytics;
  const memoryAnalytics = analytics?.memory;
  const contextAnalytics = analytics?.context;
  const candidateAnalytics = memoryAnalytics?.candidates ?? [];
  const analyticsById = new Map(candidateAnalytics.map((item) => [item.candidateId, item]));
  const typeOptions = uniqueValues(candidates.map((candidate) => candidate.type));
  const filteredCandidates = candidates.filter((candidate) => {
    const searchable = [
      candidate.safeSummary,
      candidate.normalizedValue ?? "",
      candidate.type,
      candidate.reviewStatus,
      candidate.riskLevel,
      candidate.tags.join(" ")
    ].join(" ").toLowerCase();
    const activeMatch = activeFilter === "all"
      || (activeFilter === "active" && candidate.active)
      || (activeFilter === "inactive" && !candidate.active);
    return (
      (statusFilter === "all" || candidate.reviewStatus === statusFilter)
      && (riskFilter === "all" || candidate.riskLevel === riskFilter)
      && (typeFilter === "all" || candidate.type === typeFilter)
      && activeMatch
      && (!candidateSearch.trim() || searchable.includes(candidateSearch.trim().toLowerCase()))
    );
  });
  const selectedCandidate = (
    selectedCandidateId
      ? candidateAnalytics.find((item) => item.candidateId === selectedCandidateId)
      : undefined
  ) ?? candidateAnalytics[0];
  const disabledFeatures: Array<[string, boolean]> = [
    ["embeddings", mind.policy.enableEmbeddings],
    ["model summaries", mind.policy.enableModelSummaries],
    ["agent tools", mind.policy.enableAgentTools],
    ["high-risk memory export", mind.policy.allowHighRiskMemoryExport],
    ["self-model auto apply", mind.policy.selfModelAutoApply]
  ];
  return (
    <div className="mind-module">
      <div className="module-strip">RIN MIND · SAFE SNAPSHOT</div>
      <div className="mind-grid">
        <MetricCard label="mode" value={understanding.mode} />
        <MetricCard label="support" value={ownerState.supportNeed} />
        <MetricCard label="urgency" value={<StatusBadge value={understanding.urgency} />} />
        <MetricCard label="risk" value={<RiskBadge value={understanding.privacyRisk} />} />
        <MetricCard label="memory selected" value={retrieval.selected.length} />
        <MetricCard label="candidates" value={mind.candidateCount} />
      </div>
      <SectionPanel title="Mind Policy" defaultOpen={props.displayMode !== "basic"}>
        <div className="mind-plan-grid">
          <MetricCard label="ctx" value={mind.policy.contextMaxCharacters} />
          <MetricCard label="recent max" value={mind.policy.recentHistorySelectedLimit} />
          <MetricCard label="memory max" value={mind.policy.memoryMaxSelected} />
          <MetricCard label="dangerous defaults" value={mind.policy.dangerousDefaultsDisabled ? "disabled" : "check"} tone={mind.policy.dangerousDefaultsDisabled ? "ok" : "danger"} />
        </div>
        <div className="tag-row">
          {disabledFeatures.map(([label, enabled]) => (
            <span key={String(label)}>{label}: {enabled ? "enabled" : "disabled"}</span>
          ))}
        </div>
        {mind.policy.warnings.length ? (
          <p className="readable-note">{mind.policy.warnings.join(" · ")}</p>
        ) : null}
      </SectionPanel>
      <SectionPanel title="Message Understanding" defaultOpen>
        <p className="readable-note">{understanding.intentSummary}</p>
        <div className="tag-row">
          {understanding.topicTags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        {props.displayMode !== "basic" ? (
          <div className="mind-plan-grid">
            <MetricCard label="confidence" value={understanding.confidence.toFixed(2)} />
            <MetricCard label="tone" value={understanding.emotionalTone} />
            <MetricCard label="relationship" value={understanding.relationshipRelevance} />
            <MetricCard label="memory signal" value={understanding.memorySignalType} />
          </div>
        ) : null}
        <ExplanationList items={understanding.reasons.slice(0, props.displayMode === "basic" ? 3 : 8)} />
      </SectionPanel>
      <SectionPanel title="Owner State" defaultOpen>
        <OwnerStateView ownerState={ownerState} trend={analytics?.ownerStateTrend} displayMode={props.displayMode} />
      </SectionPanel>
      <SectionPanel title="Response Plan" defaultOpen={props.displayMode !== "basic"}>
        <ResponsePlanView
          responsePlan={responsePlan}
          ownerState={ownerState}
          selectedMemoryCount={retrieval.selected.length}
          displayMode={props.displayMode}
        />
      </SectionPanel>
      <SectionPanel title="Memory Visualization" defaultOpen>
        <MemoryAnalyticsView
          analytics={memoryAnalytics}
          candidates={candidates}
          selectedCandidate={selectedCandidate}
          setSelectedCandidateId={setSelectedCandidateId}
          displayMode={props.displayMode}
        />
      </SectionPanel>
      {props.displayMode !== "basic" ? (
        <SectionPanel title="Context Plan Explainability" defaultOpen>
          <ContextPlanView analytics={contextAnalytics} fallbackPlan={contextPlan} displayMode={props.displayMode} />
        </SectionPanel>
      ) : null}
      {props.displayMode !== "basic" ? (
        <SectionPanel title="Memory Retrieval" defaultOpen>
          <div className="mind-list">
            {retrieval.selected.length ? retrieval.selected.map((item) => (
              <article key={`${item.sourceKind}:${item.sourceId}`} className="mind-row">
                <strong>{item.sourceKind}</strong>
                <span>score {item.score}</span>
                <p>{item.safeSummary}</p>
                {item.normalizedValue ? <small>{item.normalizedValue}</small> : null}
                <small>{item.reasons.join(", ") || "selected"}</small>
              </article>
            )) : <p className="empty-state">No relevant memory selected.</p>}
          </div>
        </SectionPanel>
      ) : null}
      <SectionPanel title="Memory Editor" defaultOpen={props.displayMode !== "basic"}>
        <div className="mind-filter-row">
          <label>
            search
            <input
              value={candidateSearch}
              onChange={(event) => setCandidateSearch(event.target.value)}
              placeholder="safe summary / value / tag"
            />
          </label>
          <label>
            type
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">all</option>
              {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">all</option>
              <option value="candidate">candidate</option>
              <option value="review_required">review_required</option>
              <option value="auto_promoted">auto_promoted</option>
              <option value="owner_approved">owner_approved</option>
              <option value="rejected">rejected</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
          <label>
            risk
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
              <option value="all">all</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="blocked">blocked</option>
            </select>
          </label>
          <label>
            active
            <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
              <option value="all">all</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
        </div>
        <div className="mind-list">
          {filteredCandidates.length ? filteredCandidates.map((candidate) => (
            <MemoryCandidateRow
              key={candidate.id}
              candidate={candidate}
              analytics={analyticsById.get(candidate.id)}
              reviewMindCandidate={props.reviewMindCandidate}
              editMindCandidate={props.editMindCandidate}
              setSelectedCandidateId={setSelectedCandidateId}
              displayMode={props.displayMode}
            />
          )) : <p className="empty-state">No memory candidates match filters.</p>}
        </div>
      </SectionPanel>
      <SectionPanel title="Conversation Summary">
        {latest.conversationSummary ? (
          <div className="mind-list">
            <article className="mind-row">
              <strong>{latest.conversationSummary.activeMode}</strong>
              <p>{latest.conversationSummary.topicTags.join(", ") || "No topic tags."}</p>
              <small>modelGenerated={String(latest.conversationSummary.modelGenerated)} rawTextIncluded=false</small>
            </article>
          </div>
        ) : (
          <p className="empty-state">No deterministic summary yet.</p>
        )}
        <JsonInspector value={latest.conversationSummary} visible={props.displayMode === "developer"} stringify={safeDisplayJson} />
      </SectionPanel>
      <SectionPanel title="Self Growth">
        <div className="mind-list">
          {mind.growthEvents.length ? mind.growthEvents.map((event) => (
            <article key={event.id} className={`mind-row ${event.riskLevel}`}>
              <strong>{event.eventType}</strong>
              <ReviewStatusBadge value={event.reviewStatus} />
              <p>{event.summary}</p>
              <small>safe summary only · rawTextIncluded=false</small>
            </article>
          )) : <p className="empty-state">No self-growth candidates.</p>}
        </div>
      </SectionPanel>
      <SectionPanel title="Tool Proposals">
        <div className="mind-list">
          {mind.toolInvocationRequests.length ? mind.toolInvocationRequests.map((request) => (
            <article key={request.id} className={`mind-row ${request.riskLevel}`}>
              <strong>{request.toolName}</strong>
              <StatusBadge value={request.status} />
              <p>{request.actionSummary}</p>
              <small>execution disabled by default · requiresOwnerApproval={String(request.requiresOwnerApproval)}</small>
            </article>
          )) : <p className="empty-state">Tool execution disabled; no proposals.</p>}
        </div>
      </SectionPanel>
      <SectionPanel title="Lifecycle">
        <Timeline
          events={latest.lifecycle.stages.map((stage, index) => ({
            id: `${stage}-${index}`,
            type: stage,
            label: "complete",
            at: latest.createdAt,
            status: "ok"
          }))}
        />
        <JsonInspector
          value={{ lifecycle: latest.lifecycle, embeddings: mind.embeddingStatus }}
          visible={props.displayMode === "developer"}
          stringify={safeDisplayJson}
        />
      </SectionPanel>
      <JsonInspector
        value={{ latest, memoryAnalytics, contextAnalytics }}
        visible={props.displayMode === "developer"}
        stringify={safeDisplayJson}
      />
    </div>
  );
}

function OwnerStateView(props: {
  ownerState: MindOwnerState;
  trend?: MindOwnerStateTrend;
  displayMode: DisplayMode;
}) {
  const rows = [
    ["energy", props.ownerState.energyLevel],
    ["mood", props.ownerState.moodValence],
    ["arousal", props.ownerState.arousalLevel],
    ["focus", props.ownerState.focusState],
    ["motivation", props.ownerState.motivationState],
    ["immersion", props.ownerState.immersionInertia],
    ["interrupt", props.ownerState.interruptionRisk],
    ["urgency", props.ownerState.resultUrgency]
  ];
  return (
    <div className="owner-state-view">
      <div className="state-bar-grid">
        {rows.map(([label, value]) => (
          <article key={label}>
            <header>
              <span>{label}</span>
              <strong>{value}</strong>
            </header>
            <MiniBar value={levelValue(value)} />
          </article>
        ))}
      </div>
      <div className="mind-plan-grid">
        <MetricCard label="support" value={props.ownerState.supportNeed} />
        <MetricCard label="confidence" value={props.ownerState.confidence.toFixed(2)} />
        <MetricCard label="ttl" value={`${props.ownerState.ttlHours}h`} />
        <MetricCard label="expires" value={shortLabel(props.ownerState.expiresAt)} />
      </div>
      {props.displayMode !== "basic" && props.trend?.points.length ? (
        <ChartCard title="Recent Owner State Trend" note={props.trend.explanation}>
          <DataTable
            columns={[
              { key: "createdAt", label: "time" },
              { key: "moodValence", label: "mood" },
              { key: "focusState", label: "focus" },
              { key: "supportNeed", label: "support" },
              { key: "confidence", label: "conf" }
            ]}
            rows={props.trend.points.slice(-8).map((point) => ({
              createdAt: shortLabel(String(point.createdAt ?? "")),
              moodValence: String(point.moodValence ?? "n/a"),
              focusState: String(point.focusState ?? "n/a"),
              supportNeed: String(point.supportNeed ?? "n/a"),
              confidence: String(point.confidence ?? "n/a")
            }))}
          />
        </ChartCard>
      ) : null}
    </div>
  );
}

function ResponsePlanView(props: {
  responsePlan: MindResponsePlan;
  ownerState: MindOwnerState;
  selectedMemoryCount: number;
  displayMode: DisplayMode;
}) {
  const explanations = [
    props.responsePlan.provideComfort || props.ownerState.moodValence === "negative"
      ? "RIN uses a warmer or more supportive tone because owner state indicates comfort may help."
      : "RIN keeps the tone direct because owner state does not require comfort-first handling.",
    props.responsePlan.provideStructure
      ? "RIN provides structure because the response plan requests organized next steps."
      : "RIN avoids extra structure because the current plan is conversational.",
    props.responsePlan.referenceMemory && props.selectedMemoryCount
      ? "RIN may reference memory because safe approved memory was selected for this turn."
      : "RIN will not force memory references when no safe selected memory is needed."
  ];
  return (
    <div className="response-plan-view">
      <div className="mind-plan-grid">
        <MetricCard label="tone" value={props.responsePlan.tone} />
        <MetricCard label="length" value={props.responsePlan.length} />
        <MetricCard label="directness" value={props.responsePlan.directness} />
        <MetricCard label="warmth" value={props.responsePlan.warmth} />
        <MetricCard label="initiative" value={props.responsePlan.initiativeLevel} />
        <MetricCard label="next action" value={props.responsePlan.nextActionStyle} />
      </div>
      <div className="tag-row">
        <span>comfort={String(props.responsePlan.provideComfort)}</span>
        <span>structure={String(props.responsePlan.provideStructure)}</span>
        <span>referenceMemory={String(props.responsePlan.referenceMemory)}</span>
        <span>avoidOverexplaining={String(props.responsePlan.avoidOverexplaining)}</span>
      </div>
      <ExplanationList items={props.displayMode === "basic" ? explanations.slice(0, 2) : [...explanations, ...props.responsePlan.reasons]} />
      <JsonInspector value={props.responsePlan} visible={props.displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
}

function MemoryAnalyticsView(props: {
  analytics?: MindMemoryAnalytics;
  candidates: MindMemoryCandidate[];
  selectedCandidate?: MemoryCandidateAnalytics;
  setSelectedCandidateId: (candidateId: string) => void;
  displayMode: DisplayMode;
}) {
  const counts = props.analytics?.counts;
  if (!props.analytics) {
    return <EmptyState message="Memory analytics not available yet." />;
  }
  const reviewSegments = recordDistributionSegments(counts?.byReviewStatus ?? {});
  const riskSegments = recordDistributionSegments(counts?.byRiskLevel ?? {});
  return (
    <div className="memory-analytics-view">
      <div className="mind-plan-grid">
        <MetricCard label="total" value={counts?.total ?? props.candidates.length} />
        <MetricCard label="active" value={counts?.active ?? 0} tone="ok" />
        <MetricCard label="inactive" value={counts?.inactive ?? 0} />
        <MetricCard label="pending" value={props.analytics.pendingReview.length} tone="warn" />
        <MetricCard label="near decay" value={props.analytics.nearDecayThreshold.length} tone="warn" />
        <MetricCard label="selected now" value={props.analytics.selectedInCurrentContextIds.length} />
      </div>
      <ChartCard title="Review Status Distribution">
        <StackedBar segments={reviewSegments} />
      </ChartCard>
      <ChartCard title="Risk Distribution">
        <StackedBar segments={riskSegments} />
      </ChartCard>
      {props.displayMode !== "basic" ? (
        <ChartCard title="Memory Strength Ranking" note={props.analytics.formula}>
          <div className="strength-ranking">
            {props.analytics.strongest.length ? props.analytics.strongest.map((item) => (
              <button
                key={item.candidateId}
                type="button"
                onClick={() => props.setSelectedCandidateId(item.candidateId)}
              >
                <span>{item.shortId}</span>
                <strong>{item.type}</strong>
                <MiniBar value={item.memoryStrength} />
                <small>{item.safeSummary}</small>
              </button>
            )) : <EmptyState message="No memory candidates yet." />}
          </div>
        </ChartCard>
      ) : null}
      {props.selectedCandidate && props.displayMode !== "basic" ? (
        <MemoryCandidateDetail analytics={props.selectedCandidate} displayMode={props.displayMode} />
      ) : null}
    </div>
  );
}

function MemoryCandidateDetail(props: {
  analytics: MemoryCandidateAnalytics;
  displayMode: DisplayMode;
}) {
  return (
    <ChartCard title="Selected Memory Detail" note={props.analytics.explanation}>
      <div className="mind-plan-grid">
        <MetricCard label="strength" value={props.analytics.memoryStrength} />
        <MetricCard label="risk" value={<RiskBadge value={props.analytics.riskLevel} />} />
        <MetricCard label="review" value={<ReviewStatusBadge value={props.analytics.reviewStatus} />} />
        <MetricCard label="decay" value={props.analytics.decayPolicy} />
      </div>
      <p className="readable-note">{props.analytics.safeSummary}</p>
      {props.analytics.normalizedValue ? <p className="readable-note">{props.analytics.normalizedValue}</p> : null}
      <ForgettingCurve analytics={props.analytics} />
      <Timeline events={props.analytics.eventMarkers.map((event) => ({
        type: event.type,
        label: event.label,
        at: event.at
      }))} />
      <div className="mind-plan-grid">
        <MetricCard label="retrieval events" value={props.analytics.retrievalEvents.length} />
        <MetricCard label="context injections" value={props.analytics.contextInjectionEvents.length} />
        <MetricCard label="conflict" value={props.analytics.contradictionOf ?? "none"} />
        <MetricCard label="supersedes" value={props.analytics.supersedes ?? "none"} />
      </div>
      <JsonInspector value={props.analytics} visible={props.displayMode === "developer"} stringify={safeDisplayJson} />
    </ChartCard>
  );
}

function ForgettingCurve({ analytics }: { analytics: MemoryCandidateAnalytics }) {
  const width = 520;
  const height = 160;
  const padding = 24;
  const points = analytics.predictedDecayPoints;
  if (!points.length) {
    return <EmptyState message="Not enough history for a forgetting curve." />;
  }
  const maxHours = Math.max(1, ...points.map((point) => point.elapsedHours));
  const path = points.map((point, index) => {
    const x = padding + (point.elapsedHours / maxHours) * (width - padding * 2);
    const y = height - padding - point.memoryStrength * (height - padding * 2);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const weakeningY = height - padding - analytics.thresholds.weakening * (height - padding * 2);
  const forgettingY = height - padding - analytics.thresholds.forgetting * (height - padding * 2);
  return (
    <svg className="forgetting-curve" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Memory forgetting curve">
      <line x1={padding} y1={weakeningY} x2={width - padding} y2={weakeningY} className="threshold weakening" />
      <line x1={padding} y1={forgettingY} x2={width - padding} y2={forgettingY} className="threshold forgetting" />
      <path d={path} />
      {points.map((point) => {
        const x = padding + (point.elapsedHours / maxHours) * (width - padding * 2);
        const y = height - padding - point.memoryStrength * (height - padding * 2);
        return (
          <circle key={point.at} cx={x} cy={y} r="4">
            <title>{`${point.at} · ${point.memoryStrength}`}</title>
          </circle>
        );
      })}
      <text x={padding} y={16}>memory strength</text>
      <text x={width - padding - 86} y={height - 7}>time</text>
    </svg>
  );
}

function ContextPlanView(props: {
  analytics?: MindContextAnalytics;
  fallbackPlan: MindContextPlan;
  displayMode: DisplayMode;
}) {
  const analytics = props.analytics;
  if (!analytics) {
    return <EmptyState message="Context analytics not available yet." />;
  }
  return (
    <div className="context-plan-view">
      <div className="context-flow">
        {analytics.flow.map((step) => <span key={step}>{step}</span>)}
      </div>
      <ChartCard title="Context Budget">
        <StackedBar
          segments={analytics.budget.segments.map((segment) => ({
            label: segment.type,
            value: segment.estimatedTokens,
            tone: segment.type
          }))}
        />
        <p className="readable-note">{analytics.explanation}</p>
      </ChartCard>
      <DataTable
        columns={[
          { key: "source", label: "source" },
          { key: "included", label: "included" },
          { key: "reason", label: "reason" },
          { key: "risk", label: "risk" },
          { key: "tokens", label: "tokens" },
          { key: "preview", label: "safe preview" }
        ]}
        rows={analytics.sources.slice(0, 16).map((source) => ({
          source: `${source.sourceKind}:${source.sourceId}`,
          included: source.included ? "yes" : "no",
          reason: source.reason,
          risk: source.riskLevel,
          tokens: String(source.estimatedTokens),
          preview: source.safePreview || "n/a"
        }))}
      />
      <div className="mind-plan-grid">
        <MetricCard label="messages" value={analytics.providerRequestOutline.messageCount} />
        <MetricCard label="memory selected" value={analytics.providerRequestOutline.selectedMemoryCount} />
        <MetricCard label="excluded" value={analytics.providerRequestOutline.excludedMemoryCount} />
        <MetricCard label="owner input last" value={analytics.providerRequestOutline.currentOwnerInputLast ? "yes" : "no"} tone={analytics.providerRequestOutline.currentOwnerInputLast ? "ok" : "danger"} />
      </div>
      <JsonInspector
        value={{ analytics, fallbackPlan: props.fallbackPlan }}
        visible={props.displayMode === "developer"}
        stringify={safeDisplayJson}
      />
    </div>
  );
}

function MemoryCandidateRow(props: {
  candidate: MindMemoryCandidate;
  analytics?: MemoryCandidateAnalytics;
  reviewMindCandidate: (
    candidateId: string,
    action: "approve" | "reject" | "deactivate" | "reactivate"
  ) => Promise<void>;
  editMindCandidate: (candidateId: string, patch: MindCandidateSafePatch) => Promise<void>;
  setSelectedCandidateId: (candidateId: string) => void;
  displayMode: DisplayMode;
}) {
  const candidate = props.candidate;
  const [safeSummary, setSafeSummary] = useState(candidate.safeSummary);
  const [normalizedValue, setNormalizedValue] = useState(candidate.normalizedValue ?? "");
  const [tagsText, setTagsText] = useState(candidate.tags.join(", "));
  const actionable = ["candidate", "review_required"].includes(candidate.reviewStatus)
    && candidate.riskLevel !== "blocked";
  const canDeactivate = candidate.active && candidate.riskLevel !== "blocked";
  const canReactivate = !candidate.active && candidate.riskLevel !== "blocked";
  const canSafeEdit = candidate.riskLevel !== "blocked"
    && ["low", "medium"].includes(candidate.riskLevel)
    && props.displayMode !== "basic";
  return (
    <article className={`mind-candidate ${candidate.riskLevel}`}>
      <header>
        <button type="button" className="link-button" onClick={() => props.setSelectedCandidateId(candidate.id)}>
          {candidate.type}
        </button>
        <ReviewStatusBadge value={candidate.reviewStatus} />
      </header>
      <p>{candidate.safeSummary}</p>
      {candidate.normalizedValue ? (
        <p className="readable-note">{candidate.normalizedValue}</p>
      ) : null}
      <dl className="detail-list compact">
        <div><dt>risk</dt><dd><RiskBadge value={candidate.riskLevel} /></dd></div>
        <div><dt>confidence</dt><dd>{candidate.confidence}</dd></div>
        <div><dt>salience</dt><dd>{candidate.salience}</dd></div>
        <div><dt>strength</dt><dd>{props.analytics?.memoryStrength ?? "n/a"}</dd></div>
        <div><dt>auto</dt><dd>{candidate.autoPromote ? "yes" : "no"}</dd></div>
        <div><dt>active</dt><dd>{candidate.active ? "yes" : "no"}</dd></div>
        <div><dt>redacted</dt><dd>{candidate.redacted ? "yes" : "no"}</dd></div>
      </dl>
      {props.analytics ? <MiniBar value={props.analytics.memoryStrength} /> : null}
      <div className="tag-row">
        {candidate.tags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      {canSafeEdit ? (
        <div className="candidate-editor">
          <label>
            safeSummary
            <textarea value={safeSummary} onChange={(event) => setSafeSummary(event.target.value)} />
          </label>
          <label>
            normalizedValue
            <textarea value={normalizedValue} onChange={(event) => setNormalizedValue(event.target.value)} />
          </label>
          <label>
            tags
            <input value={tagsText} onChange={(event) => setTagsText(event.target.value)} />
          </label>
          <button
            type="button"
            onClick={() =>
              void props.editMindCandidate(candidate.id, {
                safeSummary,
                normalizedValue: normalizedValue.trim() ? normalizedValue : null,
                tags: tagsText.split(",").map((item) => item.trim()).filter(Boolean)
              })
            }
          >
            SAVE SAFE EDIT
          </button>
        </div>
      ) : null}
      {actionable ? (
        <div className="mind-actions">
          <button
            type="button"
            onClick={() => void props.reviewMindCandidate(candidate.id, "approve")}
          >
            APPROVE
          </button>
          <button
            type="button"
            onClick={() => void props.reviewMindCandidate(candidate.id, "reject")}
          >
            REJECT
          </button>
        </div>
      ) : null}
      {canDeactivate ? (
        <div className="mind-actions">
          <button
            type="button"
            onClick={() => void props.reviewMindCandidate(candidate.id, "deactivate")}
          >
            DEACTIVATE
          </button>
        </div>
      ) : null}
      {canReactivate ? (
        <div className="mind-actions">
          <button
            type="button"
            onClick={() => void props.reviewMindCandidate(candidate.id, "reactivate")}
          >
            REACTIVATE
          </button>
        </div>
      ) : null}
      <JsonInspector value={{ candidate, analytics: props.analytics }} visible={props.displayMode === "developer"} stringify={safeDisplayJson} />
    </article>
  );
}

function formatCost(value: number) {
  if (value === 0) {
    return "0.000000";
  }
  return value.toFixed(6);
}

function distribution(values: string[]) {
  const counts = values.reduce<Record<string, number>>((items, value) => {
    items[value] = (items[value] ?? 0) + 1;
    return items;
  }, {});
  return Object.entries(counts).map(([label, value]) => ({ label, value: String(value) }));
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function recordDistributionSegments(counts: Record<string, number>) {
  return Object.entries(counts).map(([label, value]) => ({
    label,
    value,
    tone: label
  }));
}

function levelValue(value: string | number) {
  if (typeof value === "number") {
    return Math.max(0, Math.min(1, value));
  }
  const normalized = value.toLowerCase();
  if (["high", "positive", "immersed", "stable", "activated"].includes(normalized)) {
    return 0.82;
  }
  if (["medium", "normal", "neutral", "calm"].includes(normalized)) {
    return 0.58;
  }
  if (["low", "negative", "scattered", "blocked", "stressed", "unstable"].includes(normalized)) {
    return 0.28;
  }
  return 0.12;
}

function shortLabel(value: string) {
  if (!value || value === "n/a") {
    return "n/a";
  }
  return value.replace("T", " ").replace("Z", "").slice(0, 19);
}

function ErrorWindow(props: {
  error?: GlitchErrorItem;
  trace: RuntimeTrace | null;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
  onDismiss: () => void;
}) {
  const error = props.error;
  if (!error) {
    return <p className="empty-state">No error selected.</p>;
  }
  const repeatNote = error.repeatCount && error.repeatCount > 1
    ? ` (repeated ${error.repeatCount}×)`
    : "";
  return (
    <div className={`error-module ${error.severity}`}>
      <div className="module-strip">ERROR · {error.severity}{repeatNote}</div>
      <dl className="detail-list">
        <div><dt>code</dt><dd>{error.code}</dd></div>
        <div><dt>severity</dt><dd>{error.severity}</dd></div>
        <div><dt>module</dt><dd>{error.module}</dd></div>
        <div><dt>last step</dt><dd>{error.lastStep}</dd></div>
      </dl>
      <p>{error.message}</p>
      <div className="error-actions">
        <button
          type="button"
          disabled={!error.traceAvailable || !props.trace}
          onClick={() => props.openWindow("trace", { contextName: "Error Trace" })}
        >
          OPEN TRACE
        </button>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(safeDisplayJson(error))}
        >
          COPY ERROR
        </button>
        <button type="button" onClick={props.onDismiss}>DISMISS</button>
      </div>
    </div>
  );
}

function StubWindow({ type, snapshot }: { type: WindowType; snapshot: GlitchSnapshot | null }) {
  const info = useMemo(() => {
    if (type === "system") {
      return snapshot?.dashboard ?? {};
    }
    return {
      status: "stub",
      reason: "UI placeholder only; no tool execution implemented"
    };
  }, [snapshot?.dashboard, type]);
  return (
    <div className="stub-module">
      <div className="module-strip">{WINDOW_META[type].label.toUpperCase()}</div>
      <pre className="safe-json">{safeDisplayJson(info)}</pre>
    </div>
  );
}
