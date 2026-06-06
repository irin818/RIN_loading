# Python Preview Guide

Status: preview candidate mode only.

## What This Does

The Python preview runs the candidate FastAPI backend against safe temporary
data. It does not replace the TypeScript production backend and does not use the
owner's real `.rin-data`.

## Safety Rules

- Preview data must live under `/tmp/rin-python-preview-*`.
- The production data path `/Users/irin/Documents/RIN_loading/.rin-data` is
  rejected.
- The server binds to `127.0.0.1` only.
- Default preview smoke uses the mock adapter and calls no providers.
- Existing TypeScript launchers are not changed.

## Commands

Run the provider-free smoke:

```sh
cd /Users/irin/Documents/RIN_loading_python
npm run rin-python-preview-smoke
```

Run the preview server:

```sh
cd /Users/irin/Documents/RIN_loading_python
npm run rin-python-preview-server
```

Open:

```text
http://127.0.0.1:8765/readiness
```

Manual macOS preview launcher:

```sh
scripts/python-preview/Start_RIN_Python_Preview.command
```

Optional local model smoke, local Ollama only:

```sh
RIN_MODEL_ADAPTER=rin-ollama-local \
RIN_OLLAMA_TIMEOUT_MS=180000 \
npm run rin-python-preview-local-model-smoke
```

## Non-Goals

- No production cutover.
- No production launcher switch.
- No real `.rin-data` writes.
- No TypeScript Core removal.
- No external API calls.
