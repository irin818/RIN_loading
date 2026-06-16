const { app, BrowserWindow, Menu, screen } = require("electron");
const path = require("path");

const BODY_URL = process.env.RIN_BODY_DESKTOP_URL || "http://127.0.0.1:8765/body/floating";
const SMOKE = process.env.RIN_BODY_DESKTOP_SMOKE === "1";

const NARROW_W = 260;
const NARROW_H = 580;
const MIN_W = 160;
const MIN_H = 240;

let mainWin = null;

function createWindow() {
  mainWin = new BrowserWindow({
    width: NARROW_W,
    height: NARROW_H,
    minWidth: MIN_W,
    minHeight: MIN_H,
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

  mainWin.loadURL(BODY_URL).catch(() => {
    mainWin.loadFile(path.join(__dirname, "fallback.html"));
  });

  mainWin.webContents.on("did-fail-load", () => {
    if (!mainWin.isDestroyed()) {
      mainWin.loadFile(path.join(__dirname, "fallback.html"));
    }
  });

  // Pass mouse events through to desktop (CSS pointer-events:auto on image/chat overrides)
  mainWin.setIgnoreMouseEvents(true, { forward: true });

  // Cmd+Q / Cmd+W to quit
  mainWin.webContents.on("before-input-event", (_event, input) => {
    const key = input.key.toLowerCase();
    if (input.meta && (key === "q" || key === "w")) {
      app.quit();
    }
  });

  // Listen for chat toggle from the renderer via page title change
  mainWin.webContents.on("page-title-updated", (_event, title) => {
    if (!mainWin || mainWin.isDestroyed()) return;
    const bounds = mainWin.getBounds();
    if (title === "chat-open") {
      const display = screen.getPrimaryDisplay();
      const { width: sw } = display.workAreaSize;
      mainWin.setBounds({ x: 0, y: bounds.y, width: sw, height: bounds.height });
    } else {
      // Restore narrow width, keep current x position (character stays put)
      mainWin.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: NARROW_W,
        height: bounds.height,
      });
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
