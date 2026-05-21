# RIN Live2D Design Analysis

Date: 2026-05-20

## Visual Identity

RIN is a black and emerald-green fox / AI themed personal agent. The design reads as quiet, observant, loyal, and slightly mysterious rather than mascot-like.

Primary signals:

- Black hair with emerald-green inner accents.
- Large fox ears with white inner fur.
- Green AI mark on the forehead.
- Green eyes with sharp but calm expression.
- Black hoodie / haori silhouette with emerald trim.
- Choker and pendant at the neck.
- Gold chains, talismans, and small geometric charms.
- White fox mask accessory.
- Large black tail with emerald gradient tip.
- Back emblem: stylized fox head with geometric AI motif.

The model should feel like a personal AI companion, not a generic VTuber avatar. Motions should be restrained, attentive, and precise.

## Palette

Reference colors from the boards:

- Bright emerald: `#00FFA3`
- Deep green: `#0C8366`
- Near black: `#111820`
- Dark charcoal: `#1E241E`
- Light off-white: `#E6F1EC`
- Accent gold: warm metallic ochre
- Accent silver/teal-gray: desaturated blue-green gray

Implementation note:

- Keep black and green as the dominant identity colors.
- Use gold only for small hardware and charm highlights.
- Avoid over-bright neon on large clothing areas; reserve it for AI marks, eye highlights, and back emblem accents.

## Production Baseline

Use the clean reference board as the shape baseline because its large portrait and turnaround are easiest to read.

Use the full reference board as the technical baseline because it includes:

- Live2D layer breakdown reference.
- Development priority list.
- Full expression set.
- More explicit tail, accessory, and clothing closeups.

## Live2D MVP Scope

Recommended first rig:

- Bust / upper-body model, suitable for RIN desktop companion UI.
- Head, ears, face, neck, shoulders, upper hoodie, choker, front hair, side hair, and upper ponytail.
- Minimal visible tail if composition allows, but full tail physics can wait until the second pass.

MVP reason:

- RIN's current app has a draggable desktop body shell and an SVG chibi body. A bust/upper-body Live2D model will validate runtime integration, facial state mapping, and companion presence faster than a full-body rig.

Second pass:

- Full-body turnarounds.
- Larger tail swing.
- Sleeve and ornament physics.
- Back-view detail is not needed for RIN's initial desktop UI, but should be preserved for future assets.

## Expression Set

The reference boards define these expressions:

- Neutral
- Slight smile
- Thinking
- Focused
- Listening
- Confused
- Happy
- Warning
- Sleepy
- Dissatisfied / unimpressed

Initial expression priority:

1. Neutral
2. Listening
3. Focused
4. Slight smile
5. Thinking
6. Happy
7. Warning
8. Sleepy
9. Confused
10. Dissatisfied

## Motion Personality

Default idle:

- Slow breathing.
- Occasional blink.
- Small eye follow.
- Tiny ear twitch.
- Light hair sway.
- Pendant/charm delayed sway.

Listening state:

- Slight head tilt.
- Ears lift or angle forward.
- Eye focus increases.
- Mouth mostly closed unless speaking.

Thinking state:

- Eyes look slightly aside/down.
- One eyebrow moves subtly.
- Optional hand-to-chin motion in later full rig.

Warning state:

- Eyes sharpen.
- Ears tense.
- Head and shoulders become still.
- Forehead AI mark and eye highlights can slightly intensify if runtime tinting is feasible.

Sleepy state:

- Eyelids lower.
- Blinks become slower.
- Ears relax downward.
- Mouth can soften.

## Risks And Constraints

- The current images are flattened design boards, not production PSDs. They are good for analysis but not sufficient for a high-quality Cubism model by themselves.
- Some details differ between boards, such as age note, height, expression count, and small accessory positions. Treat them as concept variation, not separate canon.
- The model has many small dangling accessories. These are visually important but expensive to rig; keep only the most visible front ornaments in MVP.
- Cubism Editor is now installed and can import/export the baseline PSD. A production-quality model still requires final PSD cleanup or purpose-made layered source art.
