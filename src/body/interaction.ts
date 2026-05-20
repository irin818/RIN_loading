export type BodyShellPosition = {
  x: number;
  y: number;
};

export type BodyShellReaction = "idle" | "noticed" | "listening" | "settled";

export type BodyShellBubble = {
  english: string;
  chinese: string;
};

export type BodyShellState = {
  position: BodyShellPosition;
  isDragging: boolean;
  reaction: BodyShellReaction;
  bubble: BodyShellBubble | null;
};

export type BodyShellBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export const defaultBodyShellBounds: BodyShellBounds = {
  minX: -220,
  maxX: 220,
  minY: -180,
  maxY: 180,
};

export const defaultBodyShellState: BodyShellState = {
  position: { x: 0, y: 0 },
  isDragging: false,
  reaction: "idle",
  bubble: null,
};

export function beginBodyShellDrag(state: BodyShellState): BodyShellState {
  return {
    ...state,
    isDragging: true,
    reaction: "listening",
    bubble: {
      english: "Moving with you.",
      chinese: "我跟着你移动。",
    },
  };
}

export function placeBodyShell(
  state: BodyShellState,
  position: BodyShellPosition,
  bounds: BodyShellBounds = defaultBodyShellBounds,
): BodyShellState {
  return {
    ...state,
    position: clampBodyShellPosition(position, bounds),
  };
}

export function moveBodyShell(
  state: BodyShellState,
  delta: BodyShellPosition,
  bounds: BodyShellBounds = defaultBodyShellBounds,
): BodyShellState {
  return placeBodyShell(
    state,
    {
      x: state.position.x + delta.x,
      y: state.position.y + delta.y,
    },
    bounds,
  );
}

export function endBodyShellDrag(state: BodyShellState): BodyShellState {
  return {
    ...state,
    isDragging: false,
    reaction: "settled",
    bubble: {
      english: "I'll stay here.",
      chinese: "我先待在这里。",
    },
  };
}

export function registerBodyShellClick(state: BodyShellState): BodyShellState {
  return {
    ...state,
    isDragging: false,
    reaction: "noticed",
    bubble: {
      english: "I'm here.",
      chinese: "我在这里。",
    },
  };
}

export function settleBodyShell(state: BodyShellState): BodyShellState {
  return {
    ...state,
    isDragging: false,
    reaction: "idle",
    bubble: null,
  };
}

export function clampBodyShellPosition(
  position: BodyShellPosition,
  bounds: BodyShellBounds = defaultBodyShellBounds,
): BodyShellPosition {
  return {
    x: clamp(position.x, bounds.minX, bounds.maxX),
    y: clamp(position.y, bounds.minY, bounds.maxY),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
