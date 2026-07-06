import { memo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { SegmentedControl } from "../visualization";
import { formatCost } from "../utils";
import type { ConsoleWindow, GlitchSnapshot, WindowPayload, WindowType } from "../types";
import type { Density, DisplayMode, DisplaySize } from "../visualization";

type CoreVisualState = "idle" | "thinking" | "streaming" | "memory" | "warning" | "error" | "critical";

const DOMAIN_NAV_ITEMS: Array<{ label: string; type: WindowType; tone: string }> = [
  { label: "Overview", type: "core", tone: "overview" },
  { label: "Body", type: "body", tone: "body" },
  { label: "Chat", type: "chat", tone: "chat" },
  { label: "Mind", type: "mind", tone: "mind" },
  { label: "Cognition", type: "cognition", tone: "runtime" },
  { label: "Memory", type: "memory", tone: "memory" },
  { label: "Gallery", type: "gallery", tone: "body" },
  { label: "Context", type: "context", tone: "context" },
  { label: "Runtime", type: "trace", tone: "runtime" },
  { label: "Cost", type: "cost", tone: "cost" },
  { label: "Control", type: "control", tone: "control" },
];

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
}) {
  const coreStatus = snapshot?.core.status ?? "booting";
  const providerName = snapshot?.provider.activeProvider ?? "provider";
  const providerHealth = snapshot?.provider.health ?? "loading";
  const memoryCount = snapshot?.memory.totalVisible ?? 0;
  const activeTypes = new Set(windows.filter((item) => item.visible && !item.minimized).map((item) => item.type));
  const cost = snapshot?.cost;
  const displayCurrency = cost?.displayCurrency ?? cost?.currency ?? "USD";
  const costValue = cost?.configuredEstimatedCostCny ?? cost?.configuredEstimatedCostUsd ?? cost?.totalEstimatedCost ?? 0;

  return (
    <header className="system-menu">
      <div className="menu-zone menu-left">
        <button type="button" className="brand-chip command-chip" onClick={() => openWindow("core")}>
          <span>RIN CORE</span>
          <small className={`core-status-dot ${coreVisualState}`}>{coreStatus}</small>
        </button>
      </div>
      <nav className="menu-zone menu-center" aria-label="RIN data domains">
        {DOMAIN_NAV_ITEMS.map((item) => (
          <button key={item.label} type="button" className={`menu-button domain-${item.tone} ${activeTypes.has(item.type) ? "active" : ""}`} onClick={() => openWindow(item.type)}>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="menu-zone menu-right">
        <button type="button" className={`status-chip windows-chip ${windowsMenuOpen ? "active" : ""}`} onClick={() => setWindowsMenuOpen(!windowsMenuOpen)} title="Window and view controls">
          <span>VIEW</span><small>{uiSettings.displayMode}/{uiSettings.density}</small>
        </button>
        <button type="button" className="status-chip provider-chip" onClick={() => openWindow("provider")} title="Provider status">
          <span>PRV</span><small>{providerName} / {providerHealth}</small>
        </button>
        <button type="button" className="status-chip cost-chip" onClick={() => openWindow("cost")} title="Cost and token usage">
          <span>COST</span><small>{formatCost(costValue)} {displayCurrency}</small>
        </button>
        <button type="button" className="status-chip memory-chip" onClick={() => openWindow("memory")} title="Visible memory cards">
          <span>MEM</span><small>{memoryCount}</small>
        </button>
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
            <button type="button" onClick={() => openWindow("provider")}>Provider</button>
            <button type="button" onClick={() => openWindow("gallery")}>Gallery</button>
            <button type="button" onClick={() => openWindow("tools")}>Tools</button>
            <button type="button" onClick={() => openWindow("tasks")}>Tasks</button>
            <button type="button" onClick={() => openWindow("settings")}>Settings</button>
            <button type="button" onClick={() => openWindow("system")}>System</button>
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
