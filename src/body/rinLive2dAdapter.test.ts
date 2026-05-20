import { describe, expect, it } from "vitest";
import { rinLive2dBodyAdapter } from "./rinLive2dAdapter";

describe("rinLive2dBodyAdapter", () => {
  it("maps local AI state into the RIN Live2D MVP body state", () => {
    const body = rinLive2dBodyAdapter.mapState({
      mood: "neutral",
      attention: "active",
      expression: "attentive",
      voiceStyle: "soft",
    });

    expect(body.emotion).toBe("neutral");
    expect(body.expression).toBe("listening");
    expect(body.motion).toBe("attentive-sway");
    expect(body.idleBehavior).toBe(
      "blink-breathe-ear-twitch-hair-pendant-tail-sway",
    );
    expect(body.mouthSync).toBe("idle");
  });

  it("uses low energy as a sleepy visual fallback", () => {
    const body = rinLive2dBodyAdapter.mapState({
      mood: "neutral",
      attention: "idle",
      energy: "low",
    });

    expect(body.expression).toBe("sleepy");
    expect(body.motion).toBe("sleepy-breathing");
  });
});
