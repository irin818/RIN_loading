const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

const SMOKE = process.env.RIN_BODY_DESKTOP_SMOKE === "1";
const DEFAULT_BODY_URLS = [
  "http://127.0.0.1:5173/body/floating",
  "http://127.0.0.1:8765/body/floating",
];

const CONFIG_PATH = path.join(app.getPath("userData"), "window-position.json");

function loadWindowPosition() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
      const pos = JSON.parse(raw);
      if (typeof pos.x === "number" && typeof pos.y === "number") {
        return { x: pos.x, y: pos.y };
      }
    }
  } catch { /* corrupted — ignore */ }
  return null;
}

function saveWindowPosition(x, y) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ x, y }), "utf-8");
  } catch { /* non-critical */ }
}

function normalizeBodyUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/body/floating";
    }
    return url.toString();
  } catch {
    return null;
  }
}

function bodyUrlCandidates() {
  const envUrl = process.env.RIN_BODY_DESKTOP_URL;
  return Array.from(
    new Set([envUrl, ...DEFAULT_BODY_URLS].filter(Boolean).map(normalizeBodyUrl).filter(Boolean)),
  );
}

async function routeLooksUsable(url) {
  if (typeof fetch !== "function") return true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return false;
    const text = await res.text();
    return !text.includes("React build not found");
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadBodyRoute(win) {
  for (const url of bodyUrlCandidates()) {
    try {
      if (!(await routeLooksUsable(url))) continue;
      await win.loadURL(url);
      return;
    } catch {
      // Try the next local route before showing the offline fallback.
    }
  }
  await win.loadFile(path.join(__dirname, "fallback.html"));
}

function createWindow() {
  // Keep in sync with body.css :root vars:
  //   width  = --win-width  (default 240px)
  //   height = --bubble-area + --body-height  (default 86 + 380 = 466)
  const winWidth = 240;
  const winHeight = 466;

  // Restore saved position or default to bottom-right corner
  const saved = loadWindowPosition();
  const { screen } = require("electron");
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

  const x = saved ? saved.x : Math.max(0, screenW - winWidth - 20);
  const y = saved ? saved.y : screenH - winHeight - 40;

  const win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y,
    minWidth: 120,
    minHeight: 200,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    title: "RIN",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);

  // Save position when window is moved
  win.on("moved", () => {
    const [wx, wy] = win.getPosition();
    saveWindowPosition(wx, wy);
  });

  loadBodyRoute(win).catch(() => {
    if (!win.isDestroyed()) void win.loadFile(path.join(__dirname, "fallback.html"));
  });

  win.webContents.on("before-input-event", (_event, input) => {
    const key = input.key.toLowerCase();
    if (input.meta && (key === "q" || key === "w")) {
      app.quit();
    }
  });

  if (SMOKE) {
    setTimeout(() => app.quit(), 3000);
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
