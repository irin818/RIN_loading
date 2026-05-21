# RIN Live2D Asset Runtime

Date: 2026-05-21

## Current Status

RIN currently uses an asset-layered Live2D-compatible runtime model, not a real
Cubism `.moc3` export.

Runtime model ID:

- `rin-live2d-layered-mvp-v1`

Production runtime code:

- `src/live2d/rinRuntime.ts`
- `src/body/rinLive2dAdapter.ts`
- `src/ui/RinLive2DModel.tsx`
- `src/ui/styles.css`

Browser-served assets:

- `public/live2d/rin/`
- `public/live2d/rin/rin-asset-model.json`

Development source references:

- `live2d-development/photo/`
- `live2d-development/01_source_art/rin-layered-source.psd`
- `live2d-development/02_layered_assets/rin-cubism-source-layers/`

## Asset Generation

Regenerate runtime assets with:

```sh
npm run live2d:assets
```

The generator reads design boards and element cutouts from
`live2d-development/photo/`, crops the current runtime assets, removes connected
white board background where needed, and writes:

- `public/live2d/rin/*.png`
- `public/live2d/rin/rin-runtime-manifest.json`
- `public/live2d/rin/rin-asset-model.json`

The generated manifest intentionally uses a deterministic `generatedAt` value so
re-running the script does not create timestamp-only diffs.

Verify the runtime model package with:

```sh
npm run live2d:verify-runtime
```

The verifier checks that `rin-asset-model.json` matches the generated runtime
manifest, every referenced PNG exists at the recorded dimensions, expressions
map to known motions, required parameter IDs are present, and the fallback model
does not claim Cubism export availability.

Generate the Cubism handoff source bundle with:

```sh
npm run live2d:source
```

This command regenerates runtime assets, writes a layered PSD handoff file, and
then verifies that the PSD can be read back with the expected groups and bitmap
layers.

Generated source-art outputs:

- `live2d-development/01_source_art/rin-layered-source.psd`
- `live2d-development/01_source_art/rin-layered-source-manifest.json`
- `live2d-development/02_layered_assets/rin-cubism-source-layers/*.png`
- `live2d-development/02_layered_assets/rin-cubism-source-layers/composite_preview.png`

## Runtime Asset Manifest

`public/live2d/rin/rin-runtime-manifest.json` records:

- source file for each generated runtime asset
- crop coordinates
- output dimensions
- supported expression IDs
- supported motion group IDs
- current Cubism export status

This file is runtime metadata for the asset-layered MVP. It is not Cubism
`model3.json`.

`public/live2d/rin/rin-asset-model.json` is the higher-level fallback model
descriptor for the React/CSS runtime. It records:

- runtime model ID
- canvas coordinate system
- layer stack
- implemented parameter IDs
- expression-to-motion mapping
- source PSD handoff paths
- explicit Cubism export status

## Expression And Motion Mapping

`src/live2d/rinRuntime.ts` owns the Live2D-facing runtime vocabulary:

- expression normalization
- motion group selection
- runtime asset paths

`src/body/rinLive2dAdapter.ts` adapts local RIN AI state into the shared body
adapter protocol. This keeps RIN state and Live2D visual control separated.

Supported expressions:

- `neutral`
- `listening`
- `focused`
- `thinking`
- `happy`
- `warning`
- `sleepy`
- `confused`
- `slight-smile`
- `dissatisfied`

Supported motions:

- `idle-breathing`
- `attentive-sway`
- `focused-still`
- `sleepy-breathing`
- `soft-sway`

## Preview

Default body view:

```text
http://127.0.0.1:5173/body
```

Expression preview examples:

```text
http://127.0.0.1:5173/body?expression=happy
http://127.0.0.1:5173/body?expression=warning
http://127.0.0.1:5173/body?expression=sleepy
```

Final browser QA screenshots are stored under
`live2d-development/06_tests/`, including
`final-rin-live2d-expression-sheet.png`.

## Known Limits

- This model is high-fidelity compared with the SVG draft, but it is still a
  browser asset rig.
- A baseline Cubism `.moc3` / `.model3.json` export exists, but it is a static
  composite-layer export without finished deformers, physics settings, motion
  files, or expression files.
- Current expression changes use RIN-side overlays and filters, not true Cubism
  parameter deformation.
- The generated PSD is a Cubism handoff/source organization file, not a final
  production PSD. The bust still needs manual part separation and redraw work.
- A production Cubism model requires the cleaned layered PSD and Live2D Cubism
  Editor.
