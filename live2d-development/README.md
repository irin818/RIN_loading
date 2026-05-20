# RIN Live2D Development Workspace

This workspace contains Live2D model development files for RIN. It is intentionally separate from the main RIN runtime code.

## Directory Map

- `00_reference/`
  - Original design boards, visual references, and guide images.
- `01_source_art/`
  - Source art files such as PSD, CSP exports, or high-resolution PNG layers.
- `02_layered_assets/`
  - Processed model layers prepared for Cubism import.
- `03_cubism_project/`
  - Live2D Cubism project files such as `.cmo3`.
- `04_exports/`
  - Runtime export files such as `.model3.json`, `.moc3`, textures, physics, expressions, and motions.
- `05_integration/`
  - Notes or scratch files for integrating exported Live2D assets into RIN.
- `06_tests/`
  - Preview screenshots, videos, QA notes, and load-test records.
- `docs/`
  - Design analysis, tooling research, layer breakdown, parameter plans, and production checklists.

## Current Documents

- `docs/tooling-research.md`
- `docs/design-analysis.md`
- `docs/layer-breakdown-plan.md`
- `docs/parameter-and-motion-plan.md`
- `docs/production-checklist.md`

## Rule

Keep source art, Cubism authoring files, and runtime exports in this workspace. Only integration code that is meant to ship with RIN should be added under `src/`.
