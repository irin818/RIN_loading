import { describe, expect, it } from "vitest";
import { rinChibiBodyAdapter } from "./rinChibiAdapter";

describe("rinChibiBodyAdapter", () => {
  it("maps local AI state into the chibi SVG rig state", () => {
    const body = rinChibiBodyAdapter.mapState({
      mood: "neutral",
      attention: "active",
      expression: "attentive",
      voiceStyle: "soft",
    });

    expect(body.emotion).toBe("neutral");
    expect(body.expression).toBe("attentive");
    expect(body.motion).toBe("soft-sway");
    expect(body.idleBehavior).toBe("blink-breathe-hair-sway");
    expect(body.mouthSync).toBe("idle");
  });
});
