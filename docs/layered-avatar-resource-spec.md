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

The current body image (`255×860 RGBA PNG`) was cropped from the owner-provided design sheet. The owner will replace it with a higher-resolution version.

### Simple Replacement (recommended)

1. **Replace the file** at `public/body/rin-layered/assets/body/rin_default.png` with a higher-resolution transparent PNG.
2. Keep the same filename — no manifest changes needed.
3. Recommended minimum height: **2048 px**.
4. Preferred height: **3000–4096 px** for sharp desktop rendering.
5. Must have **transparent background** (RGBA PNG).
6. Keep the same character proportions and bottom-aligned framing.
7. Crop tightly to the character — no extra canvas space.

### After Replacement

Run:

```sh
python3 python/scripts/validate_body_assets.py
cd frontend && npm run build
```

### CSS Rendering Notes

The avatar image uses:
- `object-fit: contain` — image scales proportionally within its container
- `image-rendering: auto` — smooth browser interpolation (correct for high-res downscaling)
- `max-width: 100%; max-height: 100%` — image fills the available stage area
- `transform: scale(var(--avatar-scale, 1))` — driven by manifest `canvas.baseScale`
- `object-position: 50% calc(var(--avatar-center-y, 0.54) * 100%)` — vertical framing from manifest

No CSS changes are needed after replacing the image — the renderer automatically scales to fit.

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
