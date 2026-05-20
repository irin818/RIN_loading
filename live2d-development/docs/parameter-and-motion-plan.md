# RIN Live2D Parameter And Motion Plan

Date: 2026-05-20

Use official Live2D standard IDs first. Custom RIN-specific IDs should be added only after the base rig is working.

## Core Face Parameters

| Parameter ID | Min | Default | Max | Purpose |
| --- | ---: | ---: | ---: | --- |
| `ParamAngleX` | -30 | 0 | 30 | Head turn left/right |
| `ParamAngleY` | -30 | 0 | 30 | Head look up/down |
| `ParamAngleZ` | -30 | 0 | 30 | Head tilt |
| `ParamEyeLOpen` | 0 | 1 | 1.5 | Left blink/open |
| `ParamEyeROpen` | 0 | 1 | 1.5 | Right blink/open |
| `ParamEyeLSmile` | 0 | 0 | 1 | Left smiling eye |
| `ParamEyeRSmile` | 0 | 0 | 1 | Right smiling eye |
| `ParamEyeBallX` | -1 | 0 | 1 | Eye gaze left/right |
| `ParamEyeBallY` | -1 | 0 | 1 | Eye gaze up/down |
| `ParamBrowLY` | -1 | 0 | 1 | Left brow vertical |
| `ParamBrowRY` | -1 | 0 | 1 | Right brow vertical |
| `ParamBrowLAngle` | -1 | 0 | 1 | Left brow angle |
| `ParamBrowRAngle` | -1 | 0 | 1 | Right brow angle |
| `ParamMouthOpenY` | 0 | 0 | 1 | Mouth open |
| `ParamMouthForm` | -1 | 0 | 1 | Mouth smile/frown |

## Body Parameters

| Parameter ID | Min | Default | Max | Purpose |
| --- | ---: | ---: | ---: | --- |
| `ParamBodyAngleX` | -10 | 0 | 10 | Body turn left/right |
| `ParamBodyAngleY` | -10 | 0 | 10 | Body lean up/down |
| `ParamBodyAngleZ` | -10 | 0 | 10 | Body tilt |
| `ParamBreath` | 0 | 0.5 | 1 | Idle breathing |

## Hair, Ear, Tail, Accessory Parameters

Recommended custom parameters:

| Parameter ID | Min | Default | Max | Purpose |
| --- | ---: | ---: | ---: | --- |
| `ParamRinEarL` | -1 | 0 | 1 | Left ear relaxed/alert twitch |
| `ParamRinEarR` | -1 | 0 | 1 | Right ear relaxed/alert twitch |
| `ParamRinHairFrontSway` | -1 | 0 | 1 | Front hair delayed sway |
| `ParamRinHairSideSway` | -1 | 0 | 1 | Side hair delayed sway |
| `ParamRinPonytailSway` | -1 | 0 | 1 | Ponytail secondary motion |
| `ParamRinPendantSway` | -1 | 0 | 1 | Necklace/pendant swing |
| `ParamRinCharmSway` | -1 | 0 | 1 | Talismans and chains |
| `ParamRinTailSway` | -1 | 0 | 1 | Tail idle/attention sway |
| `ParamRinAIMarkGlow` | 0 | 0 | 1 | Forehead mark intensity |

Note:

- Physics can drive many sway behaviors. Keep parameter IDs for explicit control or expression overrides.

## Expression Mapping

| RIN State | Live2D Expression | Parameter Notes |
| --- | --- | --- |
| `neutral` | Neutral | Eye open 1, mouth neutral, brows neutral |
| `attentive` / `listening` | Listening | Slight head tilt, ears forward, eyes focused |
| `focused` | Focused | Brows lower slightly, eye highlights steady, less idle sway |
| `thinking` | Thinking | Eyes side/down, one brow raised, mouth small tense |
| `happy` | Happy | Smile eyes, mouth smile/open, ears lift |
| `warning` | Warning | Sharper brows, lower mouth form, AI mark glow optional |
| `sleepy` | Sleepy | Eye open lower, slow blink, ears relaxed |
| `confused` | Confused | Uneven brows, slight head tilt, small mouth |
| `slight_smile` | Slight Smile | Mouth form positive, soft eyes |
| `dissatisfied` | Dissatisfied | Half-lidded eyes, mouth form negative |

## Motion Files

Initial motion groups:

- `Idle`
  - `idle_breathing.motion3.json`
  - `idle_observe.motion3.json`
- `Tap`
  - `tap_notice.motion3.json`
  - `tap_soft_smile.motion3.json`
- `Listen`
  - `listen_start.motion3.json`
  - `listen_loop.motion3.json`
- `Think`
  - `think_short.motion3.json`
- `Alert`
  - `warning_focus.motion3.json`
- `Sleep`
  - `sleepy_idle.motion3.json`

## RIN Runtime Control Targets

The RIN app should eventually control:

- Expression file selection.
- Motion group playback.
- Mouth open from speech activity.
- Eye gaze from cursor or attention target.
- Ear and AI mark emphasis from local AI state.

Keep the boundary one-way:

- RIN local state drives Live2D.
- Live2D does not become RIN identity, memory, or reasoning.

## MVP Success Criteria

The first usable model is successful when:

- It loads from `.model3.json` in the RIN UI.
- It blinks without visual tearing.
- `ParamAngleX/Y/Z` face turn works.
- `ParamMouthOpenY` responds to speaking/idle state.
- Neutral, listening, focused, happy, warning, and sleepy expressions work.
- Idle breathing and small hair/ear motion feel stable.
- The existing draggable body shell can host the Live2D renderer.
