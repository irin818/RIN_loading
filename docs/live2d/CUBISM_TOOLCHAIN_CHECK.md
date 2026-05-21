# RIN Cubism Toolchain Check

Date: 2026-05-21

## Result

Official Cubism export is blocked in this unattended environment.

RIN now has a complete project-side fallback model package:

- `public/live2d/rin/rin-asset-model.json`
- `public/live2d/rin/rin-runtime-manifest.json`
- `public/live2d/rin/*.png`
- `live2d-development/01_source_art/rin-layered-source.psd`

It does not contain a real Cubism `.moc3` or `.model3.json`.

## Official Editor Check

Source checked:

- `https://www.live2d.com/en/cubism/download/editor/`
- `https://cubism.live2d.com/editor/js/download.js`

Current official macOS Apple Silicon release found:

- Live2D Cubism Editor `5.3.02`
- Release date `2026-04-02`
- Official package URL pattern:
  `https://cubism.live2d.com/editor/bin/Live2D_Cubism_Setup_5.3.02_arm64.pkg`

The package was downloaded to a temporary local path and verified:

- Developer ID Installer: `Live2D Inc. (89ZTYDY3J5)`
- Apple notarization: trusted
- Package target: `/Applications/Live2D Cubism 5.3`

## Blocking Points

- Homebrew has no `live2d` or `cubism` cask.
- The official package requires root installation.
- Non-interactive `sudo -n installer ...` fails because a password is required.
- The package payload can be extracted, but the Editor app exposes no usable
  command-line import/export interface.
- Running the Editor binary with `--help` does not expose a batch export mode.
- Cubism authoring still requires GUI work: PSD import, ArtMesh creation,
  deformers, parameters, physics, expressions, motions, and runtime export.

## Practical Outcome

The repository-side final deliverable for this stage is the asset-layered model
package and generated PSD handoff. It is suitable for RIN runtime integration
and for handing off to a manual Cubism authoring session.

The next real Cubism step is manual:

1. Install Cubism Editor through macOS authorization.
2. Open `live2d-development/01_source_art/rin-layered-source.psd`.
3. Split the composite guide layers into final ArtMesh-ready parts.
4. Save `live2d-development/03_cubism_project/rin.cmo3`.
5. Export runtime files to `live2d-development/04_exports/rin/`.
