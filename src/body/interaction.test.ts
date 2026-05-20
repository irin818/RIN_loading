import { describe, expect, it } from "vitest";
import {
  beginBodyShellDrag,
  defaultBodyShellState,
  endBodyShellDrag,
  moveBodyShell,
  registerBodyShellClick,
  settleBodyShell,
} from "./interaction";

describe("body shell interaction state", () => {
  it("tracks click reactions as temporary body UI state", () => {
    const clicked = registerBodyShellClick(defaultBodyShellState);

    expect(clicked.reaction).toBe("noticed");
    expect(clicked.bubble?.english).toBe("I'm here.");
    expect(clicked.bubble?.chinese).toBe("我在这里。");

    expect(settleBodyShell(clicked)).toEqual(defaultBodyShellState);
  });

  it("tracks drag state without writing slow variables", () => {
    const dragging = beginBodyShellDrag(defaultBodyShellState);
    const moved = moveBodyShell(dragging, { x: 48, y: -24 });
    const settled = endBodyShellDrag(moved);

    expect(dragging.isDragging).toBe(true);
    expect(moved.position).toEqual({ x: 48, y: -24 });
    expect(settled.isDragging).toBe(false);
    expect(settled.reaction).toBe("settled");
  });

  it("keeps the draggable body within local shell bounds", () => {
    const moved = moveBodyShell(defaultBodyShellState, { x: 999, y: -999 });

    expect(moved.position).toEqual({ x: 220, y: -180 });
  });
});
