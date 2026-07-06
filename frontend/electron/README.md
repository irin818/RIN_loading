# RIN Body Desktop Wrapper

Minimal Electron wrapper for the shared RIN body route.

## Architecture

- Loads the same React `/body/floating` surface used by the Web UI.
- Prefers `http://127.0.0.1:5173/body/floating` during local Vite development.
- Falls back to `http://127.0.0.1:8765/body/floating` when a backend-served React build exists.
- Does not read `.env`, local databases, memory data, or provider secrets.
- Uses `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.

## Usage

Start RIN with the root launcher:

```sh
./Start_RIN.command
```

Or run the wrapper manually after backend and frontend are already running:

```sh
cd frontend/electron
npm install
npm run start
```

Override the loaded route:

```sh
RIN_BODY_DESKTOP_URL=http://127.0.0.1:5173/body/floating npm run start
```

## Smoke Test

```sh
cd frontend/electron
npm run smoke
```

The smoke command launches the wrapper and quits after three seconds.
