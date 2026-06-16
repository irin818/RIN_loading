# RIN Layered Avatar Resource Spec

## Resource Locations

Source resource folder:

```text
/Users/irin/Documents/RIN_design_
```

Production resource folder:

```text
public/body/rin-layered/
```

Manifest path:

```text
public/body/rin-layered/manifest.json
```

## Core Background vs Body Asset Boundary

The Glitch Core main page background must use its own dedicated asset or CSS system — **never** a body/avatar image from `public/body/rin-layered/`.

- Core background asset: `frontend/public/picture/rin-core-background.png`
- Core background API field: `core.avatarAssetPath` must point to `/picture/rin-core-background.png`
- Body assets are restricted to: `/body`, `/body/floating`, Body panel/window, desktop body wrapper
- The console HTML templates may show a body character in a dedicated avatar/presence panel — that is correct

## Naming

- Use lowercase snake_case names.
- Keep production assets under the matching part folder.
- Keep design boards and non-production references under `assets/reference/`.
- Do not point the manifest at `public/live2d/`, Cubism atlases, `.moc3`, `.model3.json`, or other archived Live2D files.

## Image Requirements

- Preferred production format: transparent PNG.
- Supported manifest asset formats: `.png`, `.webp`, `.svg`.
- State images should be tightly cropped, centered, and large enough for desktop and mobile.
- Layered parts must be aligned to the same coordinate system before being added to the manifest.

## Replacing the Current Body Image

1. Put the replacement file under `public/body/rin-layered/assets/body/`.
2. Update `states.<state>.image` and any relevant `layers[].src` in `manifest.json`.
3. Run:

```sh
python3 python/scripts/validate_body_assets.py
```

4. Run frontend checks:

```sh
cd frontend
npm run typecheck
npm run build
```

## Adding a State Image

1. Add a transparent image such as `assets/body/rin_thinking.png`.
2. Set `states.thinking.image` to that file.
3. Keep the state label, animation profile, and effect profile accurate.
4. Validate with `python3 python/scripts/validate_body_assets.py`.

## Adding True Layer Parts

1. Add aligned transparent assets under the relevant folder, for example:
   - `assets/eyes/rin_eye_left_open.png`
   - `assets/mouth/rin_mouth_smile.png`
   - `assets/tail/rin_tail.png`
2. Add layer entries to `manifest.json` with `id`, `src`, `zIndex`, `anchor`, `position`, and `stateVisibility`.
3. Switch `assetMode` from `state-images` to `layered-parts` only after the layer set is complete and visually aligned.
4. Do not use old Cubism exports as production layers.

## Future Codex Resource Updates

Codex should:

- inspect the source folder first;
- copy only owner-provided or explicitly approved assets;
- record source-to-target mappings in `docs/layered-avatar-asset-inventory.md`;
- keep Cubism/Live2D disabled unless the owner explicitly reopens that route with a properly authored model;
- run the body asset validator and frontend checks after changes.
