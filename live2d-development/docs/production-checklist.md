# RIN Live2D Production Checklist

Date: 2026-05-21

## Phase 0 - References

- [x] Create Live2D development workspace.
- [x] Record tooling research.
- [x] Analyze provided design boards.
- [ ] Save original reference images into `00_reference/`.
- [ ] Decide canonical height/age note if needed for documentation consistency.
- [x] Decide MVP framing: bust-front runtime with tail/background layers.

## Phase 1 - Source Art

- [x] Generate interim PSD handoff from current cutout assets.
- [x] Verify interim PSD can be read back with expected groups/layers.
- [x] Confirm interim PSD is RGB, 8 bit/channel.
- [x] Ensure interim PSD layer names are unique.
- [ ] Obtain or create final production layered PSD.
- [ ] Confirm production PSD is RGB, 8 bit/channel, sRGB.
- [ ] Ensure every production import layer has a unique stable name.
- [ ] Merge line/fill/clipping layers per import ArtMesh.
- [ ] Remove import-blocking layer masks.
- [ ] Separate core face layers.
- [ ] Separate eyes, brows, and mouth.
- [ ] Separate front hair, side hair, back hair, and ponytail.
- [ ] Separate ears and inner fur.
- [ ] Separate upper body clothing and hood.
- [ ] Separate choker, pendant, fox mask, visible charms.
- [ ] Decide whether tail is MVP or second pass.

## Phase 2 - Cubism Model

- [x] Download and inspect official Cubism Editor package.
- [x] Confirm unattended Cubism export is blocked in current environment.
- [ ] Install or open Live2D Cubism Editor through macOS authorization.
- [ ] Import PSD into a new Cubism project.
- [ ] Save `.cmo3` under `03_cubism_project/`.
- [ ] Build ArtMesh layout.
- [ ] Build deformer hierarchy.
- [ ] Bind face angle parameters.
- [ ] Bind blink and eye gaze.
- [ ] Bind brow and mouth parameters.
- [ ] Bind breathing.
- [ ] Add ear, hair, pendant, and charm physics.
- [ ] Create expression files.
- [ ] Create initial idle/listen/tap motions.

## Phase 3 - Export

- [ ] Export runtime model files into `04_exports/`.
- [ ] Confirm `.model3.json` references are relative and portable.
- [ ] Confirm `.moc3`, textures, physics, expressions, and motions exist.
- [ ] Check exported model in Cubism Viewer or equivalent preview.
- [ ] Run MOC3 consistency check if using external model files.

## Phase 4 - RIN Integration

- [x] Add React asset-layered Live2D MVP without external runtime dependency.
- [x] Replace SVG draft model with high-fidelity cropped assets from `live2d-development/photo`.
- [x] Add reproducible runtime asset generator.
- [x] Add runtime asset manifest.
- [x] Add runtime asset model package descriptor.
- [x] Add runtime asset model verifier.
- [x] Add reproducible source PSD handoff generator.
- [x] Move Live2D expression/motion vocabulary into `src/live2d/`.
- [x] Add `live2d` body adapter.
- [x] Add React Live2D renderer component.
- [x] Map RIN body state to expression and motion.
- [x] Preserve current SVG rig fallback.
- [x] Verify Vite dev loading.
- [x] Verify production build.
- [x] Add tests around adapter mapping.

Note:

- The generated `rin-layered-source.psd` is an interim handoff file. It organizes current cutouts for Cubism preparation but still requires manual part separation before real ArtMesh authoring.
- The current integrated MVP is a RIN runtime-ready asset-layered PNG rig that follows the Live2D parameter and expression plan.
- A true Cubism `.moc3` export still requires Live2D Cubism Editor and final cleaned layered PSD/source art.

## Phase 5 - QA

- [x] Desktop viewport visual check.
- [x] Mobile/narrow viewport visual check if needed.
- [x] Confirm no text/UI overlap around the body shell.
- [x] Confirm drag behavior still works.
- [x] Confirm idle animation is not visually noisy.
- [x] Confirm expressions preserve RIN personality.
- [x] Record screenshots or videos under `06_tests/`.
