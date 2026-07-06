import { memo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { SegmentedControl } from "../visualization";
import type { ConsoleWindow, GlitchSnapshot, WindowPayload, WindowType } from "../types";
import type { Density, DisplayMode, DisplaySize } from "../visualization";

type CoreVisualState = "idle" | "thinking" | "streaming" | "memory" | "warning" | "error" | "critical";

const MAIN_NAV_ITEMS: Array<{ label: string; type: WindowType; tone: string }> = [
  { label: "Chat", type: "chat", tone: "chat" },
  { label: "Memory", type: "memory", tone: "memory" },
  { label: "Tasks", type: "tasks", tone: "tasks" },
  { label: "Body", type: "body", tone: "body" },
  { label: "Settings", type: "settings", tone: "settings" },
];

const DEVELOPER_NAV_ITEM: { label: string; type: WindowType; tone: string } = {
  label: "Developer",
  type: "developer",
  tone: "developer",
};

export const TopMenu = memo(function TopMenu({
  snapshot,
  coreVisualState,
  errorCount,
  windows,
  minimizedWindows,
  hiddenWindows,
  windowsMenuOpen,
  setWindowsMenuOpen,
  openWindow,
  focusWindow,
  restoreAll,
  minimizeAll,
  resetLayout,
  uiSettings,
  setUiSettings,
  onNavigate,
}: {
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
  uiSettings: { displayMode: DisplayMode; displaySize: DisplaySize; density: Density };
  setUiSettings: Dispatch<SetStateAction<{ displayMode: DisplayMode; displaySize: DisplaySize; density: Density }>>;
  onNavigate: (path: string) => void;
}) {
  const coreStatus = snapshot?.core.status ?? "booting";
  const providerName = snapshot?.provider.activeProvider ?? "provider";
  const providerHealth = snapshot?.provider.health ?? "loading";
  const modelName = snapshot?.provider.activeModel ?? "model";
  const memoryCount = snapshot?.memory.totalVisible ?? 0;
  const activeTypes = new Set(windows.filter((item) => item.visible && !item.minimized).map((item) => item.type));
  const cost = snapshot?.cost;
  const latestTokens = cost?.latest?.totalTokens ?? cost?.totalTokens ?? 0;
  const navItems = uiSettings.displayMode === "basic"
    ? MAIN_NAV_ITEMS
    : [...MAIN_NAV_ITEMS, DEVELOPER_NAV_ITEM];

  return (
    <header className="system-menu">
      <div className="menu-zone menu-left">
        <button type="button" className="brand-chip command-chip" onClick={() => openWindow("chat")}>
          <span>RIN CORE</span>
          <small className={`core-status-dot ${coreVisualState}`}>{coreStatus}</small>
        </button>
        <button type="button" className="menu-button nav-home-btn" onClick={() => onNavigate("/")} title="Return to welcome page">
          HOME
        </button>
        <button type="button" className="menu-button nav-archive-btn" onClick={() => onNavigate("/archive")} title="RIN Archive — creative memory gallery">
          ARCHIVE
        </button>
      </div>
      <nav className="menu-zone menu-center" aria-label="RIN data domains">
        {navItems.map((item) => (
          <button key={item.label} type="button" className={`menu-button domain-${item.tone} ${activeTypes.has(item.type) ? "active" : ""}`} onClick={() => openWindow(item.type)}>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="menu-zone menu-right">
        <button type="button" className={`status-chip windows-chip ${windowsMenuOpen ? "active" : ""}`} onClick={() => setWindowsMenuOpen(!windowsMenuOpen)} title="Window and view controls">
          <span>VIEW</span><small>{uiSettings.displayMode}/{uiSettings.density}</small>
        </button>
        <button type="button" className="status-chip provider-chip" onClick={() => openWindow("settings")} title="Model and provider settings">
          <span>MODEL</span><small>{providerName} / {modelName}</small>
        </button>
        <button type="button" className="status-chip cost-chip" onClick={() => openWindow("settings")} title="Latest token usage">
          <span>TOKENS</span><small>{latestTokens}</small>
        </button>
        <button type="button" className="status-chip memory-chip" onClick={() => openWindow("memory")} title="Visible memory cards">
          <span>MEM</span><small>{memoryCount}</small>
        </button>
        {uiSettings.displayMode !== "basic" ? (
          <button type="button" className="status-chip developer-chip" onClick={() => openWindow("developer")} title="Developer diagnostics">
            <span>DEV</span><small>{providerHealth}</small>
          </button>
        ) : null}
        <button type="button" className={`status-badge ${errorCount ? "danger" : ""}`} onClick={() => openWindow("error", { contextName: "Recent Errors" })}>
          ERR {errorCount}
        </button>
      </div>
      {windowsMenuOpen ? (
        <section className="windows-menu">
          <div className="window-view-controls">
            <SegmentedControl label="Mode" value={uiSettings.displayMode} options={["basic", "advanced", "developer"]} onChange={(displayMode) => setUiSettings((c) => ({ ...c, displayMode }))} />
            <SegmentedControl label="Size" value={uiSettings.displaySize} options={["small", "normal", "large", "xl"]} onChange={(displaySize) => setUiSettings((c) => ({ ...c, displaySize }))} />
            <SegmentedControl label="Density" value={uiSettings.density} options={["compact", "normal", "detailed"]} onChange={(density) => setUiSettings((c) => ({ ...c, density }))} />
          </div>
          <div className="windows-menu-actions">
            <button type="button" onClick={restoreAll}>Restore all</button>
            <button type="button" onClick={minimizeAll}>Minimize all</button>
            <button type="button" onClick={resetLayout}>Reset layout</button>
            <button type="button" onClick={() => openWindow("tasks")}>Tasks</button>
            <button type="button" onClick={() => openWindow("settings")}>Settings</button>
            {uiSettings.displayMode !== "basic" ? <button type="button" onClick={() => openWindow("developer")}>Developer</button> : null}
          </div>
          <WindowMenuList title="Open windows" windows={windows.filter((item) => item.visible && !item.minimized)} onFocus={focusWindow} />
          <WindowMenuList title="Minimized" windows={minimizedWindows} onFocus={focusWindow} />
          <WindowMenuList title="Hidden persistent" windows={hiddenWindows} onFocus={focusWindow} />
        </section>
      ) : null}
    </header>
  );
});

const WindowMenuList = memo(function WindowMenuList({ title, windows, onFocus }: { title: string; windows: ConsoleWindow[]; onFocus: (id: string) => void }) {
  return (
    <div className="window-menu-list">
      <h3>{title}</h3>
      {windows.length ? windows.map((item) => <button key={item.id} type="button" onClick={() => onFocus(item.id)}>{item.title}</button>) : <p>none</p>}
    </div>
  );
});
