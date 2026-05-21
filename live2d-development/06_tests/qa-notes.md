# RIN Live2D MVP QA Notes

Date: 2026-05-21

## Browser Preview

Dev server:

- `http://127.0.0.1:5173/body`

Expression preview URLs:

- `http://127.0.0.1:5173/body?expression=neutral`
- `http://127.0.0.1:5173/body?expression=listening`
- `http://127.0.0.1:5173/body?expression=focused`
- `http://127.0.0.1:5173/body?expression=thinking`
- `http://127.0.0.1:5173/body?expression=happy`
- `http://127.0.0.1:5173/body?expression=warning`
- `http://127.0.0.1:5173/body?expression=sleepy`
- `http://127.0.0.1:5173/body?expression=confused`
- `http://127.0.0.1:5173/body?expression=slight-smile`
- `http://127.0.0.1:5173/body?expression=dissatisfied`

Saved screenshots:

- `final-rin-live2d-expression-sheet.png`
- `final-rin-live2d-neutral.png`
- `final-rin-live2d-listening.png`
- `final-rin-live2d-focused.png`
- `final-rin-live2d-thinking.png`
- `final-rin-live2d-happy.png`
- `final-rin-live2d-warning.png`
- `final-rin-live2d-sleepy.png`
- `final-rin-live2d-confused.png`
- `final-rin-live2d-slight_smile.png`
- `final-rin-live2d-dissatisfied.png`

## Checks

- [x] `npm run live2d:assets` regenerates runtime PNG assets and manifest.
- [x] `npm run live2d:verify-runtime` validates runtime model package assets, expressions, motions, and parameters.
- [x] `npm run live2d:source` regenerates runtime assets, source PSD handoff, layer PNGs, and verifies PSD structure.
- [x] Model renders nonblank in Chrome.
- [x] Model is centered in `/body`.
- [x] Model uses high-fidelity cropped assets from `live2d-development/photo`.
- [x] Fox ears, emerald eyes, forehead AI mark, black/green outfit, pendant, fox mask, front charms, and tail are visible.
- [x] Body shell accessibility label reports adapter `rin-live2d-layered-mvp-v1`.
- [x] Expression preview query changes visible face state.
- [x] Expression preview query maps expected motions: neutral `idle-breathing`, listening `attentive-sway`, focused `focused-still`, thinking `idle-breathing`, happy `soft-sway`, warning `focused-still`, sleepy `sleepy-breathing`, confused `idle-breathing`, slight-smile `soft-sway`, dissatisfied `sleepy-breathing`.
- [x] Final expression sheet records all supported RIN Live2D expressions.
- [x] No obvious text overlap in `/body`.
- [x] Mobile/narrow viewport renders the happy body preview without clipping the core body.
- [x] Drag/click target remains the body shell actor; drag moved `--body-x`/`--body-y` from `0px` to `38px`/`36px` in browser QA.
- [x] `npm run typecheck` passes.
- [x] `npm run test` passes.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

## Known Limit

This QA validates the RIN-integrated asset-layered Live2D MVP and the generated source PSD handoff structure. It does not validate a Cubism `.moc3` export because Live2D Cubism Editor is not installed locally and the generated PSD still requires manual production layer separation.
