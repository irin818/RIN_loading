import type { BodyAdapter, BodyState } from "./types";

export const rinChibiBodyAdapter: BodyAdapter = {
  id: "rin-chibi-svg-rig-v1",
  displayName: "RIN Chibi SVG Rig V1",
  kind: "svg-rig",
  mapState(aiState: Record<string, unknown>): BodyState {
    const expression = readString(aiState.expression) ?? "neutral";
    const attention = readString(aiState.attention) ?? "idle";
    const mood = readString(aiState.mood) ?? "neutral";

    return {
      emotion: mood,
      expression,
      motion: attention === "active" ? "soft-sway" : "idle-breathing",
      voiceStyle: readString(aiState.voiceStyle) ?? "soft",
      mouthSync: "idle",
      idleBehavior: "blink-breathe-hair-sway",
      attention,
    };
  },
};

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
