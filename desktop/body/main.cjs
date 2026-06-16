const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

const BODY_URL = process.env.RIN_BODY_DESKTOP_URL || "http://127.0.0.1:8765/body/floating";
const SMOKE = process.env.RIN_BODY_DESKTOP_SMOKE === "1";

function createWindow() {
  const win = new BrowserWindow({
    width: 280,
    height: 480,
    minWidth: 160,
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

  win.loadURL(BODY_URL).catch(() => {
    win.loadFile(path.join(__dirname, "fallback.html"));
  });

  win.webContents.on("did-fail-load", () => {
    if (!win.isDestroyed()) {
      win.loadFile(path.join(__dirname, "fallback.html"));
    }
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
