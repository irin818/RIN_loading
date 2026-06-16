export const BODY_STATES = [
  "idle",
  "thinking",
  "speaking",
  "memory",
  "warning",
  "error",
  "sleeping",
  "listening",
  "reviewing",
] as const;

export type BodyState = (typeof BODY_STATES)[number];

export function normalizeBodyState(raw: string | null | undefined): BodyState {
  if (raw && (BODY_STATES as readonly string[]).includes(raw)) {
    return raw as BodyState;
  }
  return "idle";
}
