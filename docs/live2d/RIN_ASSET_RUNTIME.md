# RIN Live2D Asset Runtime

Date: 2026-05-20

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

Development source references:

- `live2d-development/photo/`

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

The generated manifest intentionally uses a deterministic `generatedAt` value so
re-running the script does not create timestamp-only diffs.

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

## Known Limits

- This model is high-fidelity compared with the SVG draft, but it is still a
  browser asset rig.
- It does not yet contain Cubism ArtMeshes, deformers, physics settings, motion
  files, expression files, or a `.moc3`.
- Current expression changes use RIN-side overlays and filters, not true Cubism
  parameter deformation.
- A production Cubism model requires a layered PSD and Live2D Cubism Editor.
