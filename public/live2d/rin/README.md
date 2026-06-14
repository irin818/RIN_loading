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
- `rin-runtime-manifest.json` and `rin-asset-model.json` describe the current PNG fallback body.
- `cubism/rin-layered-source/` contains an interim static Cubism export.

Do not commit paid, proprietary, private, or unlicensed model assets.
