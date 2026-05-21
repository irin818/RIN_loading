# RIN Cubism Toolchain Check

Date: 2026-05-21

## Result

Official Cubism Editor `5.3.02` is installed and a baseline RIN Cubism export
has been produced through the GUI workflow.

RIN now has both a project-side fallback model package and a baseline official
Cubism runtime export:

- `public/live2d/rin/rin-asset-model.json`
- `public/live2d/rin/rin-runtime-manifest.json`
- `public/live2d/rin/*.png`
- `live2d-development/01_source_art/rin-layered-source.psd`
- `live2d-development/03_cubism_project/rin-layered-source.cmo3`
- `live2d-development/04_exports/rin-layered-source/rin-layered-source.model3.json`
- `live2d-development/04_exports/rin-layered-source/rin-layered-source.moc3`
- `live2d-development/04_exports/rin-layered-source/rin-layered-source.1024/texture_00.png`

The Cubism export is a baseline composite-layer model. It is not yet the final
fully rigged production model with deformers, physics, expression files, and
motion files.

## Official Editor Check

Source checked:

- `https://www.live2d.com/en/cubism/download/editor/`
- `https://cubism.live2d.com/editor/js/download.js`

Current official macOS Apple Silicon release found:

- Live2D Cubism Editor `5.3.02`
- Release date `2026-04-02`
- Official package URL pattern:
  `https://cubism.live2d.com/editor/bin/Live2D_Cubism_Setup_5.3.02_arm64.pkg`

The package was downloaded to a temporary local path, verified, and installed:

- Developer ID Installer: `Live2D Inc. (89ZTYDY3J5)`
- Apple notarization: trusted
- Package target: `/Applications/Live2D Cubism 5.3`
- Editor app: `/Applications/Live2D Cubism 5.3/Live2D Cubism Editor 5.3.app`

## Remaining Constraints

- Homebrew has no `live2d` or `cubism` cask.
- The Editor app exposes no usable command-line import/export interface.
- Running the Editor binary with `--help` does not expose a batch export mode.
- Full production Cubism authoring still requires GUI work: final PSD cleanup,
  manual ArtMeshes, deformers, parameter binding, physics, expressions, motions,
  and runtime export.

## Practical Outcome

The repository-side deliverable for this stage is the asset-layered model
package, generated PSD handoff, saved `.cmo3` project, and baseline official
Cubism runtime export. The export is mirrored into `public/live2d/rin/cubism/`
by `npm run live2d:assets`.

The next Cubism production step is manual refinement:

1. Split the composite guide layers into final ArtMesh-ready parts.
2. Build deformers and bind standard parameters.
3. Add physics, expression files, and motion files.
4. Export updated runtime files to `live2d-development/04_exports/rin-layered-source/`.
