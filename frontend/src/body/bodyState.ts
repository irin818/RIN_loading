export const BODY_STATES = ["默认", "生气", "惊讶", "难受"] as const;

export type BodyState = (typeof BODY_STATES)[number];

export function normalizeBodyState(raw: string | null | undefined): BodyState {
  if (raw && (BODY_STATES as readonly string[]).includes(raw)) {
    return raw as BodyState;
  }
  return "默认";
}
