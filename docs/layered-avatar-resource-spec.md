# RIN Body Resource Spec

Simple state-image body system. One full-body image per state.

## Resource Locations

Production folder:

```text
public/body/rin/
```

Manifest:

```text
public/body/rin/manifest.json
```

State images:

```text
public/body/rin/states/
  idle.png
  thinking.png
  speaking.png
  memory.png
  warning.png
  error.png
  sleeping.png
  listening.png
  reviewing.png
```

## Manifest Shape

```json
{
  "name": "RIN Body",
  "version": 1,
  "defaultState": "idle",
  "states": {
    "idle": { "label": "Idle", "image": "states/idle.png" },
    ...
  }
}
```

## Replacing a State Image

1. Replace the file under `public/body/rin/states/`.
2. Keep the same filename — no manifest changes needed.
3. Must be transparent RGBA PNG.
4. Recommended height: 2048–4096px for sharp desktop rendering.
5. Keep the same character proportions.

Run after replacement:

```sh
python3 python/scripts/validate_body_assets.py
cd frontend && npm run build
```

## Adding a New State

1. Add the image under `public/body/rin/states/`.
2. Add the state entry to `manifest.json`.
3. Update `BODY_STATES` in `frontend/src/body/bodyState.ts`.
4. Run validator and build.

## Core Background vs Body Asset Boundary

The Glitch Core main page background must use its own dedicated asset — never a body/avatar image.

- Core background asset: `frontend/public/picture/rin-core-background.png`
- Body assets are restricted to: `/body`, `/body/floating`, Body panel/window, desktop body wrapper
