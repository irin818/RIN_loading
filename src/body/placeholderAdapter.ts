import type { BodyAdapter, BodyState } from "./types";

export const placeholderBodyAdapter: BodyAdapter = {
  id: "rin-placeholder-body",
  displayName: "RIN Placeholder Body",
  kind: "placeholder",
  mapState(aiState: Record<string, unknown>): BodyState {
    const expression = readString(aiState.expression) ?? "neutral";

    return {
      emotion: readString(aiState.mood) ?? "neutral",
      expression,
      motion: expression === "attentive" ? "soft-attention" : "idle-breathing",
      voiceStyle: readString(aiState.voiceStyle) ?? "unset",
      mouthSync: "idle",
      idleBehavior: readString(aiState.idle_state) ?? "calm-idle",
      attention: readString(aiState.attention) ?? "idle",
    };
  },
};

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
