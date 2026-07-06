/** Default body states shipped with the static manifest. */
export const BODY_STATES = ["默认", "生气", "惊讶", "难受"] as const;

/** Body state can be any string — defaults + custom uploaded states. */
export type BodyState = string;

/** Coerce unknown value to a known default if it's not in the default set. */
export function normalizeBodyState(raw: string | null | undefined): BodyState {
  if (raw) return raw;
  return "默认";
}
