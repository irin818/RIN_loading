# RIN Live2D Layer Breakdown Plan

Date: 2026-05-20

This is the first material separation plan based on the provided design boards. It assumes a Cubism import PSD with separate, uniquely named layers.

## Naming Rules

- Use stable English layer IDs for tooling.
- Use side suffixes from the character's perspective: `_L` and `_R`.
- Use `Guide_` prefix for non-export guide layers.
- Do not reuse layer names.
- Keep line/fill/clipping already merged for each import layer unless a separate mesh is required.

Example:

- `Face_Base`
- `Eye_Iris_L`
- `Hair_Front_Bang_Center`
- `Ear_Fur_Inner_R`
- `Accessory_FoxMask`

## Head And Face

Required MVP layers:

- `Head_Base`
- `Face_Skin_Shadow`
- `Face_Blush_L`
- `Face_Blush_R`
- `Face_Nose`
- `Face_Forehead_AIMark`
- `Face_Forehead_AIMark_Glow`
- `Neck_Base`
- `Neck_Shadow`

Notes:

- The forehead AI mark is a major identity signal and should be independent for glow/tint/expression control.
- Keep cheek shadows separate enough to support sleepy/happy softness.

## Eyes

Required MVP layers:

- `Eye_White_L`
- `Eye_White_R`
- `Eye_Iris_L`
- `Eye_Iris_R`
- `Eye_Pupil_L`
- `Eye_Pupil_R`
- `Eye_Highlight_Main_L`
- `Eye_Highlight_Main_R`
- `Eye_Highlight_Sub_L`
- `Eye_Highlight_Sub_R`
- `Eye_UpperLash_L`
- `Eye_UpperLash_R`
- `Eye_LowerLash_L`
- `Eye_LowerLash_R`
- `Eye_Lid_Shadow_L`
- `Eye_Lid_Shadow_R`
- `Eye_SmileShape_L`
- `Eye_SmileShape_R`

Notes:

- Keep iris/pupil/highlight separate so RIN can track cursor or owner attention.
- The green irises should support subtle brightness change for alert/focused states.

## Eyebrows

Required MVP layers:

- `Brow_L`
- `Brow_R`
- `Brow_Shadow_L`
- `Brow_Shadow_R`

Needed forms:

- Neutral
- Soft smile
- Focused
- Thinking
- Warning
- Sleepy
- Confused

## Mouth

Required MVP layers:

- `Mouth_Line`
- `Mouth_Inner`
- `Mouth_Teeth`
- `Mouth_Tongue`
- `Mouth_Shadow`

Needed forms:

- Closed neutral
- Small smile
- Open small
- Open medium
- Open wide
- Thinking / small tense
- Sleepy soft

## Hair

Required MVP layers:

- `Hair_Back_Base`
- `Hair_Back_Shadow`
- `Hair_Front_Bang_Center`
- `Hair_Front_Bang_L`
- `Hair_Front_Bang_R`
- `Hair_Side_L`
- `Hair_Side_R`
- `Hair_Side_TipGreen_L`
- `Hair_Side_TipGreen_R`
- `Hair_Ahoge`
- `Hair_Ponytail_Base`
- `Hair_Ponytail_TipGreen`
- `Hair_Ponytail_Tie`

Second pass layers:

- Additional individual hair strands around both ears.
- Back hair chunks for stronger head turn.
- Ponytail physics segments.

Notes:

- Front bangs must not be flattened into the face layer.
- Ponytail should be a separate deformer chain because it is visible in side and back views.

## Fox Ears

Required MVP layers:

- `Ear_Outer_L`
- `Ear_Outer_R`
- `Ear_Inner_L`
- `Ear_Inner_R`
- `Ear_InnerFur_White_L`
- `Ear_InnerFur_White_R`
- `Ear_TipDark_L`
- `Ear_TipDark_R`
- `Ear_GreenAccent_L`
- `Ear_GreenAccent_R`

Notes:

- Ears should support forward/backward rotation, relaxed state, and small twitch.
- Inner white fur should move with the ear but can have a small secondary deformation.

## Body And Clothes

Required MVP layers:

- `Body_UpperBase`
- `Chest_InnerLayer`
- `Hoodie_Outer`
- `Hoodie_InnerGreen_L`
- `Hoodie_InnerGreen_R`
- `Collar_L`
- `Collar_R`
- `Shoulder_L`
- `Shoulder_R`
- `Sleeve_Upper_L`
- `Sleeve_Upper_R`
- `Sleeve_Cuff_L`
- `Sleeve_Cuff_R`
- `Waist_Belt`

Second pass layers:

- Full skirt/shorts layers.
- Legs and socks.
- Full sleeves with stronger cloth sway.
- Back hood emblem if back-view animation is needed.

Notes:

- Keep green hood lining separate; it is a strong silhouette accent.
- Cuffs can be separate for subtle hand/arm motion later.

## Accessories

Required MVP layers:

- `Choker_Base`
- `Choker_Ring`
- `Necklace_Gem`
- `Necklace_GoldFrame`
- `Necklace_Chain`
- `Accessory_FoxMask`
- `Accessory_FoxMask_GreenMark`
- `Accessory_FoxMask_Tassel`
- `Charm_FrontTag_L`
- `Charm_FrontTag_R`
- `Charm_GoldChain_L`
- `Charm_GoldChain_R`

Second pass layers:

- Hair clips.
- Ear chains.
- Additional talismans.
- Sleeve hanging ornaments.
- Back tassels.

Notes:

- Accessories should be grouped by physics behavior, not only by visual category.
- MVP should include only front-facing ornaments that are visible in the desktop shell.

## Tail

Recommended second pass layers:

- `Tail_Base`
- `Tail_Shadow`
- `Tail_TipGreen`
- `Tail_Highlight`
- `Tail_FurEdge_L`
- `Tail_FurEdge_R`

Notes:

- The tail is iconic but large. For MVP it may be represented as a partial background silhouette, then upgraded to full physics once the face/body rig works.

## Guide Layers

Keep these as non-runtime PSD guide layers:

- `Guide_FrontView`
- `Guide_SideView`
- `Guide_BackView`
- `Guide_ExpressionGrid`
- `Guide_ColorPalette`

## Minimum Deliverable PSD

For a first Cubism import test, the PSD should include at least:

- Face/head base.
- Separate eyes, brows, and mouth.
- Front/side hair chunks.
- Separate ears.
- Neck and upper clothes.
- Choker and pendant.
- Forehead AI mark.

This is enough to validate import, face angles, blinking, mouth open, idle breathing, and RIN state mapping.
