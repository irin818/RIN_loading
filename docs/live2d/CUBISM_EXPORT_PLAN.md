# RIN Cubism Export Plan

Date: 2026-05-20

## Goal

Convert the current RIN Live2D visual design into a real Cubism runtime export:

- `.cmo3` authoring project
- `.moc3`
- `.model3.json`
- texture atlas
- `*.physics3.json`
- `*.exp3.json`
- `*.motion3.json`

## Current Blocker

Live2D Cubism Editor is not installed locally, and the repository does not yet
contain a production layered PSD.

Homebrew search did not find a Cubism cask. The official Cubism Editor download
flow requires platform selection, usage category, email, and acceptance of
Live2D's license/privacy terms.

Official references:

- https://www.live2d.com/en/cubism/download/editor/
- https://www.live2d.com/en/cubism/download/spec/
- https://docs.live2d.com/en/cubism-editor-manual/precautions-for-psd-data/
- https://docs.live2d.com/en/cubism-editor-manual/psd-import/
- https://docs.live2d.com/cubism-editor-manual/standard-parameter-list/

## Required Source PSD

The production PSD should be stored under:

```text
live2d-development/01_source_art/
```

Minimum production layers:

- head base
- face shadows/blush
- forehead AI mark
- left/right eye whites
- left/right irises
- left/right pupils
- left/right eye highlights
- upper/lower lashes
- left/right brows
- mouth line, mouth inner, teeth, tongue
- front bangs
- side hair
- back hair
- ponytail
- left/right fox ears
- inner ear fur
- neck
- upper body clothing
- choker
- pendant
- front charms
- fox mask
- tail base
- tail green tip

PSD constraints:

- RGB color mode
- 8 bit/channel
- sRGB profile
- unique layer names
- no import-blocking layer masks
- no duplicate layer names
- each ArtMesh-ready visual element already merged into a clean import layer

## Cubism Authoring Steps

1. Install/open Live2D Cubism Editor.
2. Import the layered PSD.
3. Save the project as:

```text
live2d-development/03_cubism_project/rin.cmo3
```

4. Create ArtMeshes for all visible parts.
5. Build the deformer hierarchy:
   - root
   - body
   - head
   - face
   - eyes
   - mouth
   - brows
   - ears
   - hair
   - clothes
   - accessories
   - tail
6. Bind standard parameters:
   - `ParamAngleX`
   - `ParamAngleY`
   - `ParamAngleZ`
   - `ParamEyeLOpen`
   - `ParamEyeROpen`
   - `ParamEyeBallX`
   - `ParamEyeBallY`
   - `ParamMouthOpenY`
   - `ParamMouthForm`
   - `ParamBodyAngleX`
   - `ParamBodyAngleY`
   - `ParamBodyAngleZ`
   - `ParamBreath`
7. Add RIN-specific parameters:
   - `ParamRinEarL`
   - `ParamRinEarR`
   - `ParamRinHairFrontSway`
   - `ParamRinPonytailSway`
   - `ParamRinPendantSway`
   - `ParamRinTailSway`
   - `ParamRinAIMarkGlow`
8. Configure physics:
   - ears
   - side hair
   - ponytail
   - pendant
   - charms
   - tail
9. Create expressions:
   - neutral
   - listening
   - focused
   - thinking
   - happy
   - warning
   - sleepy
   - confused
   - slight smile
   - dissatisfied
10. Create initial motions:
   - idle breathing
   - attentive sway
   - focused still
   - sleepy breathing
   - tap notice
11. Export runtime files to:

```text
live2d-development/04_exports/rin/
```

## RIN Integration Target

Once Cubism export exists, add a separate loader under:

```text
src/live2d/
```

The existing body adapter can remain stable. Replace only the renderer
implementation behind the same body state fields:

- expression
- motion
- mouthSync
- attention
- idleBehavior

The current asset-layered renderer should remain as fallback until the Cubism
loader is verified in both dev and production builds.
