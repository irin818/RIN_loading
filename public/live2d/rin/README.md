# RIN Live2D Runtime Asset Contract

Place the production RIN Live2D runtime export here when the model is ready:

```text
public/live2d/rin/
  rin.model3.json
  rin.moc3
  textures/
  motions/ optional
  expressions/ optional
  physics.json optional
  pose.json optional
```

The web console loads the runtime URL `/live2d/rin/rin.model3.json`.
This repository currently serves that URL from `public/live2d/rin/` through
FastAPI. A frontend-only dev mirror may use `frontend/public/live2d/rin/`, but
do not keep divergent copies of the same model in both locations.

Current state:

- `rin.model3.json` is installed at the standard runtime path and references
  the existing RIN `.moc3` plus `textures/texture_00.png`.
- Production motions, expressions, physics, and pose are not installed.
- The official local Cubism Core script is installed at
  `public/live2d/cubism-core/live2dcubismcore.min.js` from the official Cubism
  SDK for Web R5 package. Its source, SHA-256, and license status are documented
  in `public/live2d/cubism-core/README.md`.
- The browser renderer uses the vendored official Cubism SDK for Web R5
  Framework path in `frontend/src/vendor/live2d-cubism-framework/`.
  Required WebGL shader resources are installed under
  `public/live2d/cubism-framework/Shaders/WebGL/`.
- `rin-runtime-manifest.json` and `rin-asset-model.json` describe the current
  PNG fallback body. The PNG fallback is not Live2D and must not be reported as
  a loaded Cubism model.
- `cubism/rin-layered-source/` contains an interim static Cubism export with a
  `.model3.json`, `.moc3`, display info, and one texture atlas. It is preserved
  as the current continuation artifact. The standardized runtime files were
  copied from this export; no motions or expressions were fabricated.
- The Cubism authoring project is
  `live2d-development/03_cubism_project/rin-layered-source.cmo3`.

Validate the current local contract from the repository root:

```sh
python3 python/scripts/validate_live2d_assets.py
python3 python/scripts/validate_live2d_assets.py --json
```

Expected status after standardization: `available` for the asset package, with
`runtimePackageReady=true`, `runtimeCoreScriptPresent=true`,
`runtimeShaderFilesPresent=true`, and `runtimeReady=true`.

Manual Cubism export checklist:

1. Open `/Applications/Live2D Cubism 5.3/Live2D Cubism Editor 5.3.app`.
2. Open `live2d-development/03_cubism_project/rin-layered-source.cmo3`.
3. Finish the production rig: deformers, face angles, blink, mouth parameters,
   breathing, expressions, motions, and optional physics/pose.
4. Export runtime files from Cubism Editor as a model3 package.
5. Place the exported model at `public/live2d/rin/rin.model3.json`.
6. Place referenced `.moc3`, textures, motions, expressions, and optional
   physics/pose files under `public/live2d/rin/` using relative references.
7. Keep the official Cubism Core Web runtime at
   `public/live2d/cubism-core/live2dcubismcore.min.js`.
8. Keep the official Cubism Framework WebGL shader resources under
   `public/live2d/cubism-framework/Shaders/WebGL/`.
9. Run the validator above and reload `/body` or `/body/floating`.

Do not commit paid, proprietary, private, or unlicensed model assets.
