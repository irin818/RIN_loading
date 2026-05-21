import type { BodyAdapter, BodyState } from "./types";
import { resolveRinLive2dVisualState } from "../live2d/rinRuntime";

export const rinLive2dBodyAdapter: BodyAdapter = {
  id: "rin-live2d-layered-mvp-v1",
  displayName: "RIN Live2D Layered MVP V1",
  kind: "live2d",
  mapState(aiState: Record<string, unknown>): BodyState {
    const mood = readString(aiState.mood) ?? "neutral";
    const attention = readString(aiState.attention) ?? "idle";
    const visualState = resolveRinLive2dVisualState(aiState);

    return {
      emotion: mood,
      expression: visualState.expression,
      motion: visualState.motion,
      voiceStyle: readString(aiState.voiceStyle) ?? "soft",
      mouthSync: "idle",
      idleBehavior: visualState.idleBehavior,
      attention,
    };
  },
};

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
