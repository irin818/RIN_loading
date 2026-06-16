const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

const BODY_URL = process.env.RIN_BODY_DESKTOP_URL || "http://127.0.0.1:8765/body/floating";
const SMOKE = process.env.RIN_BODY_DESKTOP_SMOKE === "1";

function createWindow() {
  const win = new BrowserWindow({
    width: 300,
    height: 620,
    minWidth: 180,
    minHeight: 300,
    transparent: true,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    title: "RIN Body",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
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

  win.webContents.on("before-input-event", (event, input) => {
    const key = input.key.toLowerCase();
    if (input.meta && key === "q") {
      app.quit();
    }
    if (input.meta && key === "w") {
      win.close();
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
