# RIN Live2D MVP QA Notes

Date: 2026-05-20

## Browser Preview

Dev server:

- `http://127.0.0.1:5173/body`

Expression preview URLs:

- `http://127.0.0.1:5173/body?expression=listening`
- `http://127.0.0.1:5173/body?expression=happy`
- `http://127.0.0.1:5173/body?expression=warning`
- `http://127.0.0.1:5173/body?expression=sleepy`

Saved screenshots:

- `rin-live2d-listening.png`
- `rin-live2d-happy.png`
- `rin-live2d-warning.png`
- `rin-live2d-sleepy.png`

## Checks

- [x] Model renders nonblank in Chrome.
- [x] Model is centered in `/body`.
- [x] Model uses high-fidelity cropped assets from `live2d-development/photo`.
- [x] Fox ears, emerald eyes, forehead AI mark, black/green outfit, pendant, fox mask, front charms, and tail are visible.
- [x] Body shell accessibility label reports adapter `rin-live2d-layered-mvp-v1`.
- [x] Expression preview query changes visible face state.
- [x] No obvious text overlap in `/body`.
- [x] Drag/click target remains the body shell actor.
- [x] `npm run typecheck` passes.
- [x] `npm run test` passes.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

## Known Limit

This QA validates the RIN-integrated asset-layered Live2D MVP. It does not validate a Cubism `.moc3` export because Live2D Cubism Editor is not installed locally and no layered PSD source file has been provided yet.
