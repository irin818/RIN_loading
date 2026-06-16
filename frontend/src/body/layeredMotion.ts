import type { BodyActivity, LayeredAvatarManifest } from "./types";

const FALLBACK_MOTION_CLASS: Record<BodyActivity, string> = {
  idle: "motion-idle",
  thinking: "motion-thinking",
  speaking: "motion-speaking",
  memory: "motion-memory",
  warning: "motion-warning",
  error: "motion-error",
  sleeping: "motion-sleeping",
  listening: "motion-listening",
  reviewing: "motion-reviewing"
};

export function motionClassForState(
  manifest: LayeredAvatarManifest,
  activity: BodyActivity
): string {
  const state = manifest.states[activity] ?? manifest.states[manifest.defaultState];
  return manifest.animations[state.animationProfile]?.cssClass ?? FALLBACK_MOTION_CLASS[activity];
}

export function effectClassForState(activity: BodyActivity): string {
  return `effect-${activity}`;
}
