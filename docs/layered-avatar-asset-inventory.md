# RIN Layered Avatar Asset Inventory

Source folder: `/Users/irin/Documents/RIN_design_`

Production folder: `public/body/rin-layered/`

Active renderer: Layered Avatar

Cubism / Live2D status: disabled and archived for the current production body route.

## Classification Summary

| Class | Result |
|---|---|
| PRIMARY_BODY | `public/body/rin-layered/assets/body/rin_default.png` |
| LAYER_PARTS | Reference sheets contain visual parts, but no clean aligned production layer files were provided. |
| EXPRESSIONS | Reference-only expression/eye/mouth samples in source sheets. |
| EYES | Reference-only samples in source sheets. |
| MOUTH | Reference-only samples in source sheets. |
| TAIL | Reference-only samples in source sheets; current production body includes a cropped tail edge. |
| EARS | Reference-only samples in source sheets. |
| HAIR | Reference-only in full-body/reference sheets. |
| ACCESSORIES | Reference-only headphones/belt/shoes samples in source sheets. |
| EFFECTS | No separate effect image assets provided. Effects are CSS-rendered by the Layered Avatar renderer. |
| REFERENCE_ONLY | Four owner-provided design/reference sheets copied under `assets/reference/`. |
| UNUSABLE | Old `public/live2d/` and `live2d-development/` Cubism resources are not production body sources. |

## Selected Production Asset

| Source path | Target path | Purpose | Size | Transparency | Use |
|---|---|---|---|---|---|
| `/Users/irin/Documents/RIN_design_/拆分元素图总揽.png` | `public/body/rin-layered/assets/body/rin_default.png` | Current full-body Layered Avatar image | 255x860 | yes | production-use |

Generation note: `rin_default.png` was cropped from the owner-provided split-elements overview and edge-background-cleaned locally. The crop avoids old Cubism assets and does not introduce third-party art.

## Copied Reference Assets

| Source path | Target path | Purpose | Size | Transparency | Use |
|---|---|---|---|---|---|
| `/Users/irin/Documents/RIN_design_/image.png` | `public/body/rin-layered/assets/reference/rin_design_overview.png` | Design overview/reference | 1024x1536 | no | reference-only |
| `/Users/irin/Documents/RIN_design_/image_design.png` | `public/body/rin-layered/assets/reference/rin_layer_reference_board.png` | Layer/parts design board | 1536x1024 | no | reference-only |
| `/Users/irin/Documents/RIN_design_/主体部位元素图.png` | `public/body/rin-layered/assets/reference/rin_primary_elements_sheet.png` | Primary element sheet | 1024x1536 | yes | reference-only |
| `/Users/irin/Documents/RIN_design_/拆分元素图总揽.png` | `public/body/rin-layered/assets/reference/rin_split_elements_overview.png` | Split element overview sheet | 1024x1536 | yes | reference-only |

## Current Constraints

- No clean aligned separate head/eye/mouth/tail/ear/hair PNG layer set exists in the confirmed source folder.
- State-specific expression images are not production-ready as separate aligned transparent layers.
- The renderer therefore uses state-based animation/effects on one full-body image and keeps layered-parts support available for future properly prepared assets.
