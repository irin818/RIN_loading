# Live2D Tooling Research

Date: 2026-05-20

This note records tools and projects that can reduce friction when creating and integrating RIN's future Live2D body.

## Local Check

- No Live2D Cubism, Photoshop, CLIP STUDIO PAINT, VTube Studio, Spine, or Inochi2D app was found in `/Applications` or Spotlight.
- The RIN project is currently React + Vite. The body adapter type already reserves `kind: "live2d"`, so runtime integration can be added without changing the identity/runtime boundary.
- Current npm state has no PixiJS or Live2D runtime dependency installed.
- Homebrew has no Live2D/Cubism cask available by `brew search --cask live2d cubism`.
- Official Cubism Editor download requires the website flow: platform selection, individual/enterprise choice, email input, and consent to Live2D's software license and privacy policy.

## Recommended Stack

### 1. Model Creation

Use Live2D Cubism Editor as the primary model authoring tool.

Why:
- It is the official tool for `.cmo3` authoring and `.moc3` / `.model3.json` export.
- It supports PSD/PNG image input and WAV audio input on macOS.
- It provides the standard parameter, deformer, physics, expression, motion, and export workflows.

Source:
- https://www.live2d.com/en/cubism/download/editor/
- https://www.live2d.com/en/cubism/download/spec/
- https://docs.live2d.com/en/cubism-editor-manual/new-feature-introduction-title/

Local status:
- Not currently installed.

Version note:
- Official release history lists Cubism `5.3.02` on 2026-04-02.

### 2. Art / PSD Preparation

Preferred tools:
- Adobe Photoshop
- CLIP STUDIO PAINT

Live2D's PSD notes explicitly confirm these as image editing applications known to load PSDs correctly in Cubism Editor. PSDs should be prepared as:

- PSD format
- RGB color mode
- 8 bit/channel
- sRGB profile
- unique layer names
- merged line/fill/clipping layers where needed
- no layer masks for import PSDs

Source:
- https://docs.live2d.com/en/cubism-editor-manual/precautions-for-psd-data/
- https://docs.live2d.com/en/cubism-editor-manual/psd-import/

Useful official helper:
- Live2D Photoshop Scripts, especially cleanup/preprocess scripts for import PSDs.
- https://www.live2d.com/en/cubism/download/ps-script/

Local status:
- Photoshop and CLIP STUDIO PAINT were not found locally.

### 3. Runtime Integration Into RIN

RIN's front end is web-based, so prioritize Cubism Web runtimes.

Option A: Official Cubism SDK for Web
- Best for long-term control and staying closest to official behavior.
- Uses WebGL and TypeScript/JavaScript.
- Requires Live2D Cubism Core files from the official SDK package.

Sources:
- https://docs.live2d.com/en/cubism-sdk-manual/cubism-sdk-for-web/
- https://www.live2d.com/en/sdk/about/

Option B: `untitled-pixi-live2d-engine`
- Fastest practical candidate for RIN's React/Vite prototype.
- PixiJS v8 based.
- Supports Cubism 2 / 3 / 4 / 5 models.
- npm package checked: `untitled-pixi-live2d-engine@1.2.0`, MIT.
- Peer/dependency stack includes `pixi.js@^8.13.1` and `@pixi/sound`.

Source:
- https://github.com/Untitled-Story/untitled-pixi-live2d-engine

Option C: `pixi-live2d-display`
- Mature and widely referenced.
- npm package checked: `pixi-live2d-display@0.4.0`, MIT.
- Older PixiJS v6 peer dependency stack, so it may be less aligned with a new Vite integration than Option B.

Source:
- https://github.com/guansss/pixi-live2d-display

Initial recommendation:
- Use Cubism Editor for authoring.
- Export standard Cubism runtime files.
- Prototype RIN loading with `untitled-pixi-live2d-engine` first, while keeping the adapter boundary small enough to switch to the official SDK if needed.

### 4. Parameter Standard

Use official Live2D standard parameter IDs unless the design requires a custom extension.

Core IDs to preserve:
- `ParamAngleX`
- `ParamAngleY`
- `ParamAngleZ`
- `ParamEyeLOpen`
- `ParamEyeROpen`
- `ParamEyeBallX`
- `ParamEyeBallY`
- `ParamMouthOpenY`
- `ParamBodyAngleX`
- `ParamBodyAngleY`
- `ParamBodyAngleZ`
- hair/body sway parameters as needed

Reason:
- Standard IDs make runtime control, blink/lip-sync setup, and external tools easier.
- VTube Studio auto-setup also assumes default Live2D parameter IDs and value ranges.

Sources:
- https://docs.live2d.com/cubism-editor-manual/standard-parameter-list/
- https://github.com/DenchiSoft/VTubeStudio/wiki/Getting-Started

### 5. Preview / External Validation

Use these only for verification, not as RIN's core runtime:

- Cubism Viewer / official preview tools: check exported model, physics, expressions, and motions.
- VTube Studio: optional compatibility check if we want the model to also behave like a VTuber model.

### 6. Open-Source Alternatives

Inochi2D is worth knowing as an open-source 2D puppet ecosystem, but it should not be the main path for this task unless the goal changes away from real Live2D/Cubism.

Reason:
- It has its own editor, SDK, and puppet format.
- It is useful as conceptual reference for layered puppet workflows.
- It does not replace Cubism export files such as `.moc3` and `.model3.json`.

Source:
- https://nlnet.nl/project/Inochi2D/

## Proposed RIN Live2D Workflow

1. Receive design image.
2. Save references under `live2d-development/00_reference/`.
3. Produce a material separation plan in `live2d-development/docs/`.
4. Prepare or request layered PSD assets under `live2d-development/01_source_art/`.
5. Build Cubism project under `live2d-development/03_cubism_project/`.
6. Export runtime files under `live2d-development/04_exports/`.
7. Add a RIN `live2d` body adapter under `src/body` and a React renderer under `src/ui`.
8. Verify model loading, state-to-parameter mapping, expressions, idle motion, drag behavior, and build/test output.

## Early Decisions

- Do not place Live2D working files directly in `src/`.
- Keep `.cmo3`, PSD, exports, screenshots, and tool notes inside `live2d-development/`.
- Do not make RIN identity or memory depend on Live2D state.
- Use standard parameter IDs first; add RIN-specific custom parameters only after the base face/body rig works.
- Avoid Cubism 5.3-only export features until the target web runtime is confirmed to load them correctly.
