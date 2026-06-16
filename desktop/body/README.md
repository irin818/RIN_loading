# RIN Layered Avatar Desktop Wrapper

Minimal Electron wrapper for the active Layered Avatar body route.

## Architecture

- **Security:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- **Frame:** Transparent, frameless, always-on-top
- **Default size:** 420×760 (min 300×420, resizable)
- **No secrets, no .env access, no provider calls, no local RIN data access**

## Usage

Start RIN backend + frontend first, then:

```sh
cd desktop/body
npm install
npm run start
```

The wrapper loads `http://127.0.0.1:8765/body/floating` by default.

Override URL:

```sh
RIN_BODY_DESKTOP_URL=http://127.0.0.1:8765/body npm run start
```

## Smoke Test

```sh
cd desktop/body
npm run smoke
```

Launches the window, loads the body route, and auto-quits after 3 seconds. If RIN is not running, the fallback page is shown.

## Fallback

If the RIN backend is unreachable, the wrapper shows `fallback.html` — a static page instructing the user to start RIN.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd+Q` | Quit app |
| `Cmd+W` | Close window |
