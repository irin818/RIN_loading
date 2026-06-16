# RIN Layered Avatar Assets

Active production body renderer: Layered Avatar.

Cubism / Live2D is disabled and archived for the current production body route.

## Files

- `manifest.json`: renderer contract used by the web body surfaces.
- `assets/body/rin_default.png`: current production full-body transparent cutout.
- `assets/reference/`: owner-provided source/reference images copied from `/Users/irin/Documents/RIN_design_`.

## Current Mode

The current owner assets are design sheets, not a complete set of aligned separate layers.
The active manifest therefore uses `assetMode: "state-images"` and applies state-specific
motion/effects to the production full-body image.

Future true layer assets can be added under `assets/head`, `assets/eyes`, `assets/mouth`,
`assets/hair`, `assets/ears`, `assets/tail`, `assets/accessories`, `assets/effects`, and
`assets/shadow`, then the manifest can switch to `assetMode: "layered-parts"`.
