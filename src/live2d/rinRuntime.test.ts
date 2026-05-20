import { describe, expect, it } from "vitest";
import {
  normalizeRinLive2dExpression,
  resolveRinLive2dVisualState,
  RIN_LIVE2D_ASSETS,
  RIN_LIVE2D_EXPRESSIONS,
  selectRinLive2dMotion,
} from "./rinRuntime";

describe("RIN Live2D runtime manifest", () => {
  it("keeps runtime assets under the public Live2D path", () => {
    expect(Object.values(RIN_LIVE2D_ASSETS)).toEqual(
      expect.arrayContaining([
        "/live2d/rin/rin-bust-front.png",
        "/live2d/rin/rin-tail-large.png",
        "/live2d/rin/rin-runtime-manifest.json",
      ]),
    );
    expect(
      Object.values(RIN_LIVE2D_ASSETS).every((path) =>
        path.startsWith("/live2d/rin/"),
      ),
    ).toBe(true);
  });

  it("normalizes RIN body state language into supported expressions", () => {
    expect(normalizeRinLive2dExpression("attentive")).toBe("listening");
    expect(normalizeRinLive2dExpression("slight_smile")).toBe("slight-smile");
    expect(normalizeRinLive2dExpression("unknown", "low")).toBe("sleepy");
    expect(RIN_LIVE2D_EXPRESSIONS).toContain("warning");
  });

  it("selects stable motion groups for runtime control", () => {
    expect(selectRinLive2dMotion("warning", "active", "normal")).toBe(
      "focused-still",
    );
    expect(selectRinLive2dMotion("sleepy", "idle", "low")).toBe(
      "sleepy-breathing",
    );
    expect(selectRinLive2dMotion("listening", "active", "normal")).toBe(
      "attentive-sway",
    );
    expect(selectRinLive2dMotion("happy", "active", "normal")).toBe(
      "soft-sway",
    );
  });

  it("resolves a complete visual state from local AI state", () => {
    expect(
      resolveRinLive2dVisualState({
        expression: "attentive",
        attention: "active",
        energy: "normal",
      }),
    ).toEqual({
      expression: "listening",
      motion: "attentive-sway",
      idleBehavior: "blink-breathe-ear-twitch-hair-pendant-tail-sway",
    });
  });
});
