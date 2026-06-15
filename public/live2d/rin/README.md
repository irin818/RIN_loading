# RIN Live2D Runtime Asset Contract

Place the production RIN Live2D runtime export here when the model is ready:

```text
public/live2d/rin/
  rin.model3.json
  textures/
  motions/
  expressions/
  physics.json optional
  pose.json optional
```

The web console loads the runtime URL `/live2d/rin/rin.model3.json`.
This repository currently serves that URL from `public/live2d/rin/` through
FastAPI. A frontend-only dev mirror may use `frontend/public/live2d/rin/`, but
do not keep divergent copies of the same model in both locations.

Current state:

- `rin.model3.json` is not installed at the standard runtime path.
- `rin-runtime-manifest.json` and `rin-asset-model.json` describe the current
  PNG fallback body. The PNG fallback is not Live2D and must not be reported as
  a loaded Cubism model.
- `cubism/rin-layered-source/` contains an interim static Cubism export with a
  `.model3.json`, `.moc3`, display info, and one texture atlas. It is preserved
  as the current continuation artifact, but it is not the standard runtime
  contract because it is not installed at `/live2d/rin/rin.model3.json` and has
  no production motions or expressions.
- The Cubism authoring project is
  `live2d-development/03_cubism_project/rin-layered-source.cmo3`.

Validate the current local contract from the repository root:

```sh
python3 python/scripts/validate_live2d_assets.py
python3 python/scripts/validate_live2d_assets.py --json
```

Expected status before the production model export is completed: `partial`.

Manual Cubism export checklist:

1. Open `/Applications/Live2D Cubism 5.3/Live2D Cubism Editor 5.3.app`.
2. Open `live2d-development/03_cubism_project/rin-layered-source.cmo3`.
3. Finish the production rig: deformers, face angles, blink, mouth parameters,
   breathing, expressions, motions, and optional physics/pose.
4. Export runtime files from Cubism Editor as a model3 package.
5. Place the exported model at `public/live2d/rin/rin.model3.json`.
6. Place referenced `.moc3`, textures, motions, expressions, and optional
   physics/pose files under `public/live2d/rin/` using relative references.
7. Run the validator above and reload `/body` or `/body/floating`.

Do not commit paid, proprietary, private, or unlicensed model assets.
