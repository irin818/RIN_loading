import { describe, expect, it } from "vitest";
import { placeholderBodyAdapter } from "./placeholderAdapter";

describe("placeholderBodyAdapter", () => {
  it("maps local AI state into future Live2D-compatible body fields", () => {
    const body = placeholderBodyAdapter.mapState({
      mood: "neutral",
      attention: "active",
      expression: "attentive",
      voiceStyle: "soft",
    });

    expect(body.emotion).toBe("neutral");
    expect(body.expression).toBe("attentive");
    expect(body.motion).toBe("soft-attention");
    expect(body.voiceStyle).toBe("soft");
    expect(body.mouthSync).toBe("idle");
  });
});
