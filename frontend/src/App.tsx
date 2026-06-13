import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode
} from "react";

import { fetchGlitchSnapshot, fetchMemoryCards, sendChatMessage } from "./api";
import type {
  ChatMessage,
  ConsoleWindow,
  GlitchErrorItem,
  GlitchSnapshot,
  MemoryCard,
  RuntimeTrace,
  WindowPayload,
  WindowType
} from "./types";

const LAYOUT_KEY = "rin.glitch-core.window-layout.v2";
const PERSISTENT_TYPES = new Set<WindowType>(["chat", "memory", "trace", "cost"]);
const REUSABLE_WINDOW_TYPES = new Set<WindowType>([
  "core",
  "chat",
  "memory",
  "trace",
  "provider",
  "cost",
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
  chat: { label: "Chat", context: "Default Session", code: "CHAT" },
  memory: { label: "Memory", context: "Recent Memories", code: "MEM" },
  memoryDetail: { label: "Memory Detail", context: "Memory Record", code: "MEM+" },
  trace: { label: "Trace", context: "Runtime Trace", code: "TRC" },
  provider: { label: "Provider", context: "API Provider", code: "PRV" },
  cost: { label: "Cost / Token", context: "Usage Ledger", code: "COST" },
  error: { label: "Error", context: "Runtime Error", code: "ERR" },
  tasks: { label: "Tasks", context: "Mission Queue", code: "TASK" },
  tools: { label: "Tools", context: "Tool Layer", code: "TOOL" },
  settings: { label: "Settings", context: "Local UI", code: "SET" },
  system: { label: "System", context: "Health", code: "SYS" }
};

const MENU_ITEMS: Array<{ label: string; type?: WindowType }> = [
  { label: "RIN_CORE_OS", type: "core" },
  { label: "CHAT", type: "chat" },
  { label: "MEMORY", type: "memory" },
  { label: "TRACE", type: "trace" },
  { label: "PROVIDERS", type: "provider" },
  { label: "COST", type: "cost" },
  { label: "TASKS", type: "tasks" },
  { label: "TOOLS", type: "tools" },
  { label: "SETTINGS", type: "settings" },
  { label: "WINDOWS" },
  { label: "SYSTEM", type: "system" }
];

const CENTER_MENU_ITEMS = MENU_ITEMS.filter((item) => item.label !== "RIN_CORE_OS");

const DEFAULT_LAYOUT: Array<Pick<
  ConsoleWindow,
  "type" | "contextName" | "x" | "y" | "width" | "height"
>> = [
  { type: "core", contextName: "RIN Core", x: 440, y: 58, width: 410, height: 250 },
  { type: "chat", contextName: "Default Session", x: 28, y: 76, width: 410, height: 516 },
  { type: "memory", contextName: "Recent Memories", x: 850, y: 82, width: 406, height: 488 },
  { type: "trace", contextName: "Latest Turn", x: 372, y: 432, width: 548, height: 236 },
  { type: "provider", contextName: "API Provider", x: 888, y: 492, width: 360, height: 200 },
  { type: "cost", contextName: "Usage Ledger", x: 498, y: 104, width: 382, height: 248 }
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
  chat: { x: 44, y: 84, width: 430, height: 516, offsetX: 34, offsetY: 28 },
  memory: { x: 828, y: 84, width: 420, height: 488, offsetX: -34, offsetY: 28 },
  memoryDetail: { x: 520, y: 118, width: 430, height: 420, offsetX: 28, offsetY: 28 },
  trace: { x: 346, y: 396, width: 570, height: 268, offsetX: 38, offsetY: -24 },
  provider: { x: 838, y: 424, width: 390, height: 244, offsetX: -30, offsetY: -18 },
  cost: { x: 54, y: 470, width: 438, height: 300, offsetX: 30, offsetY: -26 },
  error: { x: 500, y: 124, width: 460, height: 340, offsetX: 28, offsetY: 30 },
  tasks: { x: 96, y: 128, width: 420, height: 320, offsetX: 32, offsetY: 30 },
  tools: { x: 744, y: 154, width: 410, height: 318, offsetX: -32, offsetY: 30 },
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

export default function App() {
  const [snapshot, setSnapshot] = useState<GlitchSnapshot | null>(null);
  const [windows, setWindows] = useState<ConsoleWindow[]>(() => loadLayout());
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [windowsMenuOpen, setWindowsMenuOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryCompact, setMemoryCompact] = useState(true);
  const [lastChatContent, setLastChatContent] = useState("");
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

  const visibleWindows = windows.filter((item) => item.visible && !item.minimized);
  const minimizedWindows = windows.filter((item) => item.minimized);
  const hiddenWindows = windows.filter((item) => !item.visible);
  const errorCount = snapshot?.errors.length ?? 0;

  return (
    <div
      className={`rin-os core-state-${coreVisualState}`}
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
      />
      <main className="workspace">
        <CoreBackground snapshot={snapshot} visualState={coreVisualState} />
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
}) {
  const coreStatus = props.snapshot?.core.status ?? "booting";
  const providerName = props.snapshot?.provider.activeProvider ?? "provider";
  const providerHealth = props.snapshot?.provider.health ?? "loading";
  const memoryCount = props.snapshot?.memory.totalVisible ?? 0;

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
      <nav className="menu-zone menu-center" aria-label="RIN system menu">
        {CENTER_MENU_ITEMS.map((item) =>
          item.label === "WINDOWS" ? (
            <button
              key={item.label}
              type="button"
              className={`menu-button ${props.windowsMenuOpen ? "active" : ""}`}
              onClick={() => props.setWindowsMenuOpen(!props.windowsMenuOpen)}
            >
              WINDOWS
            </button>
          ) : (
            <button
              key={item.label}
              type="button"
              className="menu-button"
              onClick={() => item.type && props.openWindow(item.type)}
            >
              {item.label}
            </button>
          )
        )}
      </nav>
      <div className="menu-zone menu-right">
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
          <div className="windows-menu-actions">
            <button type="button" onClick={props.restoreAll}>Restore all</button>
            <button type="button" onClick={props.minimizeAll}>Minimize all</button>
            <button type="button" onClick={props.resetLayout}>Reset layout</button>
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
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload; focusExistingId?: string }) => void;
  openErrorWindow: (error: GlitchErrorItem) => void;
  closeWindow: (id: string) => void;
}) {
  switch (props.win.type) {
    case "core":
      return <CoreStatus snapshot={props.snapshot} />;
    case "chat":
      return <ChatWindow {...props} />;
    case "memory":
      return <MemoryWindow {...props} />;
    case "memoryDetail":
      return <MemoryDetailWindow card={props.win.payload?.card as MemoryCard | undefined} />;
    case "trace":
      return <TraceWindow trace={props.snapshot?.trace.latest ?? null} openWindow={props.openWindow} />;
    case "provider":
      return <ProviderWindow snapshot={props.snapshot} openWindow={props.openWindow} />;
    case "cost":
      return <CostWindow snapshot={props.snapshot} />;
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

function MemoryDetailWindow({ card }: { card?: MemoryCard }) {
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
      <pre className="safe-json">{safeDisplayJson(card.metadata)}</pre>
    </div>
  );
}

function TraceWindow(props: {
  trace: RuntimeTrace | null;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
}) {
  const trace = props.trace;
  if (!trace) {
    return <p className="empty-state">No runtime trace captured yet.</p>;
  }
  const hasError = trace.status === "failed";
  return (
    <div className="trace-module">
      <div className="module-strip">TRACE · {trace.status}</div>
      <details open>
        <summary>Run Summary</summary>
        <div className="trace-summary-grid">
          <Metric label="turn" value={trace.turnShortId} />
          <Metric label="duration" value={`${trace.totalDurationMs}ms`} />
          <Metric label="privacy" value={trace.privacyMode} />
          <Metric label="error" value={trace.errorCode ?? "none"} />
        </div>
      </details>
      <details open>
        <summary>Timeline</summary>
        <ol className="trace-timeline-list">
          {trace.stages.map((stage) => (
            <li key={`${stage.name}-${stage.startedAt}`} className={stage.status}>
              <span>{stage.displayName}</span>
              <b>{stage.durationMs}ms</b>
              <p>{stage.summary}</p>
            </li>
          ))}
        </ol>
      </details>
      <TraceSection title="Provider" trace={trace} names={["model_request", "raw_model_response"]} />
      <TraceSection title="Memory" trace={trace} names={["memory_v2_retrieval", "memory_update"]} />
      <TraceSection title="Sanitizer" trace={trace} names={["sanitization_final_answer"]} />
      <TraceSection title="Storage" trace={trace} names={["persist_owner_message", "store_reply"]} />
      <details open={hasError}>
        <summary>Error</summary>
        <pre className="safe-json">
          {safeDisplayJson({
            status: trace.status,
            errorCode: trace.errorCode ?? "none"
          })}
        </pre>
      </details>
    </div>
  );
}

function TraceSection(props: { title: string; trace: RuntimeTrace; names: string[] }) {
  const stages = props.trace.stages.filter((stage) => props.names.includes(stage.name));
  return (
    <details>
      <summary>{props.title}</summary>
      <pre className="safe-json">{safeDisplayJson(stages)}</pre>
    </details>
  );
}

function ProviderWindow(props: {
  snapshot: GlitchSnapshot | null;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
}) {
  const provider = props.snapshot?.provider;
  if (!provider) {
    return <p className="empty-state">Provider status loading.</p>;
  }
  return (
    <div className="provider-module">
      <div className="module-strip">PROVIDER STATUS · SAFE CONFIG</div>
      <div className="provider-grid">
        <Metric label="provider" value={provider.activeProvider} />
        <Metric label="adapter" value={provider.activeAdapter} />
        <Metric label="model" value={provider.activeModel} />
        <Metric label="health" value={provider.health} />
        <Metric label="latency" value={provider.lastLatencyMs} />
        <Metric label="streaming" value={provider.streamingSupport} />
      </div>
      <pre className="safe-json">{safeDisplayJson(provider.safeConfig)}</pre>
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

function CostWindow(props: { snapshot: GlitchSnapshot | null }) {
  const cost = props.snapshot?.cost;
  if (!cost) {
    return <p className="empty-state">Cost and token usage loading.</p>;
  }
  const latest = cost.latest;
  const maxRecentTokens = Math.max(1, ...cost.recent.map((item) => item.totalTokens));
  return (
    <div className="cost-module">
      <div className="module-strip">COST / TOKEN · SAFE LEDGER</div>
      <div className="cost-grid">
        <Metric label="provider" value={cost.provider} />
        <Metric label="model" value={cost.model} />
        <Metric label="config" value={cost.configurationStatus} />
        <Metric label="records" value={cost.eventCount} />
        <Metric label="total tokens" value={cost.totalTokens} />
        <Metric
          label="total cost"
          value={`${formatCost(cost.totalEstimatedCost)} ${cost.currency}`}
        />
      </div>
      <div className="cost-latest">
        <span>latest turn</span>
        {latest ? (
          <strong>
            {latest.inputTokens} in / {latest.outputTokens} out / {latest.totalTokens} total · {formatCost(latest.estimatedCost)} {latest.currency}
          </strong>
        ) : (
          <strong>no usage records yet</strong>
        )}
      </div>
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
              <small>{formatCost(item.estimatedCost)} {item.currency} · {item.estimateMethod}</small>
            </article>
          ))
        ) : (
          <p className="empty-state">Configure API chat and complete a turn to record usage.</p>
        )}
      </div>
    </div>
  );
}

function formatCost(value: number) {
  if (value === 0) {
    return "0.000000";
  }
  return value.toFixed(6);
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
