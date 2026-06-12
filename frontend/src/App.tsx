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

const LAYOUT_KEY = "rin.glitch-core.window-layout.v1";
const PERSISTENT_TYPES = new Set<WindowType>(["chat", "memory", "trace"]);

const WINDOW_META: Record<WindowType, { label: string; context: string }> = {
  core: { label: "Core Status", context: "RIN Core" },
  chat: { label: "Chat", context: "Default Session" },
  memory: { label: "Memory", context: "Recent Memories" },
  memoryDetail: { label: "Memory Detail", context: "Memory Record" },
  trace: { label: "Trace", context: "Runtime Trace" },
  provider: { label: "Provider", context: "Local Provider" },
  error: { label: "Error", context: "Runtime Error" },
  tasks: { label: "Tasks", context: "Stub" },
  tools: { label: "Tools", context: "Stub" },
  settings: { label: "Settings", context: "Local UI" },
  system: { label: "System", context: "Health" }
};

const MENU_ITEMS: Array<{ label: string; type?: WindowType }> = [
  { label: "RIN_CORE_OS", type: "core" },
  { label: "CHAT", type: "chat" },
  { label: "MEMORY", type: "memory" },
  { label: "TRACE", type: "trace" },
  { label: "PROVIDERS", type: "provider" },
  { label: "TASKS", type: "tasks" },
  { label: "TOOLS", type: "tools" },
  { label: "SETTINGS", type: "settings" },
  { label: "WINDOWS" },
  { label: "SYSTEM", type: "system" }
];

const DEFAULT_LAYOUT: Array<Pick<
  ConsoleWindow,
  "type" | "contextName" | "x" | "y" | "width" | "height"
>> = [
  { type: "core", contextName: "RIN Core", x: 420, y: 52, width: 420, height: 360 },
  { type: "chat", contextName: "Default Session", x: 32, y: 64, width: 390, height: 520 },
  { type: "memory", contextName: "Recent Memories", x: 858, y: 64, width: 390, height: 500 },
  { type: "trace", contextName: "Latest Turn", x: 260, y: 400, width: 520, height: 250 },
  { type: "provider", contextName: "Local Provider", x: 762, y: 420, width: 360, height: 230 }
];

function windowTitle(type: WindowType, instanceNumber: number, contextName: string) {
  return `${WINDOW_META[type].label} #${instanceNumber} · ${contextName}`;
}

function makeWindow(
  type: WindowType,
  instanceNumber: number,
  zIndex: number,
  overrides: Partial<ConsoleWindow> = {}
): ConsoleWindow {
  const layout = DEFAULT_LAYOUT.find((item) => item.type === type);
  const contextName = overrides.contextName ?? layout?.contextName ?? WINDOW_META[type].context;
  const x = overrides.x ?? layout?.x ?? 140 + instanceNumber * 28;
  const y = overrides.y ?? layout?.y ?? 96 + instanceNumber * 28;
  const width = overrides.width ?? layout?.width ?? 420;
  const height = overrides.height ?? layout?.height ?? 340;
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

function safeDisplayJson(value: unknown) {
  return JSON.stringify(value, null, 2)
    .replaceAll("<think>", "[thinking-tag]")
    .replaceAll("</think>", "[/thinking-tag]");
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
    [focusWindow]
  );

  const openErrorWindow = useCallback(
    (error: GlitchErrorItem) => {
      openWindow("error", {
        contextName: error.code,
        payload: { error }
      });
    },
    [openWindow]
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
  }, []);

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
    <div className="rin-os">
      <div className="scanline-layer" />
      <div className="noise-layer" />
      <TopMenu
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
        <CoreBackground snapshot={snapshot} />
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
            />
          </WindowFrame>
        ))}
      </main>
    </div>
  );
}

function TopMenu(props: {
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
  return (
    <header className="system-menu">
      <div className="brand-chip">RIN // GLITCH CORE</div>
      <nav>
        {MENU_ITEMS.map((item) =>
          item.label === "WINDOWS" ? (
            <button
              key={item.label}
              type="button"
              className="menu-button"
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
      <button
        type="button"
        className={`status-badge ${props.errorCount ? "danger" : ""}`}
        onClick={() => props.openWindow("error", { contextName: "Recent Errors" })}
      >
        ERR {props.errorCount}
      </button>
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

function CoreBackground({ snapshot }: { snapshot: GlitchSnapshot | null }) {
  return (
    <section className="core-background" aria-hidden="true">
      <div className="data-grid" />
      <div className="core-ring outer" />
      <div className="core-ring inner" />
      <img
        src={snapshot?.core.avatarAssetPath ?? "/live2d/rin/rin-front-fullbody.png"}
        alt=""
        className="core-rin-image"
      />
      <div className="core-label">RIN CORE</div>
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
      className={`os-window ${props.active ? "focused" : ""} ${win.maximized ? "maximized" : ""}`}
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
    case "error":
      return (
        <ErrorWindow
          error={props.win.payload?.error as GlitchErrorItem | undefined}
          trace={props.snapshot?.trace.latest ?? null}
          openWindow={props.openWindow}
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
  return (
    <div className="chat-module">
      <div className="module-strip">
        CHAT LINK · {props.snapshot?.selectedConversationId ?? "new session"}
      </div>
      <div className="message-list">
        {messages.length ? (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        ) : (
          <p className="empty-state">No active conversation messages.</p>
        )}
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

function ErrorWindow(props: {
  error?: GlitchErrorItem;
  trace: RuntimeTrace | null;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
}) {
  const error = props.error;
  if (!error) {
    return <p className="empty-state">No error selected.</p>;
  }
  return (
    <div className={`error-module ${error.severity}`}>
      <div className="module-strip">ERROR · {error.severity}</div>
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
        <button type="button">DISMISS</button>
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
