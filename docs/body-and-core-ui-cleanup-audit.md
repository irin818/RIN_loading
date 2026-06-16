# RIN Body & Core UI Cleanup Audit

Date: 2026-06-17
Branch: `claude/rin-layered-avatar-core-bg-cleanup-v1`

## Summary

Previous Codex task transitioned RIN from Cubism/Live2D to Layered Avatar, but a critical bug remained: the body character asset was being used as the main Glitch Core page background.

---

## 1. KEEP_ACTIVE

| Path | Issue | Reason | Action |
|------|-------|--------|--------|
| `frontend/public/picture/rin-core-background.png` | Core background asset | Dedicated background image, exists and is correct | KEEP — use as core background source |
| `public/body/rin-layered/` | Production body assets | Active Layered Avatar route | KEEP |
| `public/body/rin-layered/manifest.json` | Body manifest | Active, needs minor fixes | FIX — see below |
| `frontend/src/body/` | Body renderer components | Active Layered Avatar renderer | KEEP — minor fixes only |
| `python/src/rin/body/state.py` | Body state backend | Active, correct | KEEP |
| `docs/archive/rin-cubism-route-archived.md` | Archived Cubism doc | Historical reference | KEEP |
| `docs/layered-avatar-asset-inventory.md` | Asset inventory | Active doc | UPDATE |
| `docs/layered-avatar-resource-spec.md` | Resource spec | Active doc | UPDATE |
| `python/scripts/validate_body_assets.py` | Asset validator | Active | KEEP |
| `desktop/body/` | Desktop wrapper | Active | KEEP — minor stabilization |

## 2. FIX

| Path | Issue | Reason | Action |
|------|-------|--------|--------|
| `python/src/rin/server/api.py:1540` | `avatarAssetPath` = body image path | Body asset wrongly used as core background | Change to `/picture/rin-core-background.png` |
| `python/src/rin/server/api.py:1373` | `avatar_asset_path` = body image | Same issue in other endpoint | Change to `/picture/rin-core-background.png` |
| `python/src/rin/server/api.py:1422` | `avatar_asset_path` = body image | Same issue | Change to `/picture/rin-core-background.png` |
| `python/src/rin/server/api.py:4599` | `staticPresenceAsset` = body image | Body presence should use body path (this is correct for body route) | KEEP as-is — this IS a body endpoint |
| `public/body/rin-layered/manifest.json` | `assetMode: "state-images"` with single image | No true layered parts; all states → same image | Document limitation; if owner has cutout layers, upgrade |
| `frontend/src/App.tsx:1235` | Fallback path correct, but API overrides with body image | API sends wrong path | Fix API (above) to make fallback irrelevant |

## 3. DELETE

| Path | Issue | Reason | Action |
|------|-------|--------|--------|
| `live2d-development/` | Empty directory (only .DS_Store) | Old Cubism development artifacts already removed | DELETE directory |
| `live2d-development/.DS_Store` | macOS metadata | No content remains | DELETE |

## 4. ARCHIVE

| Path | Issue | Reason | Action |
|------|-------|--------|--------|
| N/A | No new items to archive | Previous cleanup already archived Cubism route | — |

## 5. REVIEW

| Path | Issue | Reason | Action |
|------|-------|--------|--------|
| `frontend/src/styles.css:993-1017` | `.core-rin-background-image` styles | These styles apply `object-fit: cover`, `mix-blend-mode: screen`, filters to the core background image — appropriate for a dedicated background, not for a body character | REVIEW after fix |
| `frontend/vite.config.ts:11` | `/body-assets` proxy | Proxies to `http://127.0.0.1:8765` — needs review in dev vs prod | REVIEW — may need conditional |

---

## Background Bug Root Cause

**File:** `python/src/rin/server/api.py`, line 1540

```python
"avatarAssetPath": "/body-assets/rin-layered/assets/body/rin_default.png",
```

This is the **body character image** (255x860 crop of the full-body character). It is sent as part of the core Glitch snapshot and rendered by `CoreBackground` (`App.tsx:1240`) as:

```html
<img src={assetPath} alt="" class="core-rin-background-image" />
```

The CSS applies:
- `width: min(92vw, 1280px)`
- `height: min(86vh, 860px)`  
- `object-fit: cover`
- `mix-blend-mode: screen`
- Multiple filter effects

This causes the body character to appear as a **huge, blurry, cropped background** behind the RIN CORE center visual.

**Fix:** Change `avatarAssetPath` to `/picture/rin-core-background.png` in all core/dashboard endpoints.

---

## Owner Resources Inventory

Source: `/Users/irin/Documents/RIN_design_/`

| File | Type | Current Use |
|------|------|-------------|
| `image.png` | Design overview (1024x1536) | Reference — copied to `public/body/rin-layered/assets/reference/rin_design_overview.png` |
| `image_design.png` | Layer/parts design board (1536x1024) | Reference — copied to `public/body/rin-layered/assets/reference/rin_layer_reference_board.png` |
| `主体部位元素图.png` | Primary element sheet (1024x1536) | Reference — copied to `public/body/rin-layered/assets/reference/rin_primary_elements_sheet.png` |
| `拆分元素图总揽.png` | Split element overview (1024x1536) | Used to crop `rin_default.png` body image; also reference |

No individual transparent layer cutouts (head, hair, eyes, mouth, ears, tail, etc.) are provided as separate files. The manifest remains in `state-images` mode with a single full-body image.

---

## Remaining Cubism/Live2D References After Cleanup

All remaining references are in:
- Governance/architecture docs (correctly state Live2D is archived/disabled)
- Body diagnostics (correctly show `cubismStatus: disabled_archived_future_route`)
- Tests (correctly verify Cubism is disabled)
- Archived documentation

**No active Cubism/Live2D runtime code or assets remain.**
