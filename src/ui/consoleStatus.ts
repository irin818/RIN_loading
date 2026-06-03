import type { ConversationErrorPayload } from "../conversation";

/**
 * Parse a structured conversation error body returned by the local runtime
 * (Phase 25). Returns a normalized payload, or null when the value does not
 * match the expected `{ error: { code, message, ... } }` shape. This keeps the
 * Console UI defensive: unknown failures fall back to a generic message instead
 * of rendering raw JSON.
 */
export function parseConversationError(
  value: unknown,
): ConversationErrorPayload | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = (value as { error?: unknown }).error;

  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }

  const error = candidate as Record<string, unknown>;

  if (typeof error.code !== "string" || typeof error.message !== "string") {
    return null;
  }

  const recovery = Array.isArray(error.recovery)
    ? error.recovery.filter((item): item is string => typeof item === "string")
    : [];

  const details =
    typeof error.details === "object" && error.details !== null
      ? (error.details as Record<string, unknown>)
      : {};

  return {
    code: error.code as ConversationErrorPayload["code"],
    message: error.message,
    recovery,
    modelAdapter:
      typeof error.modelAdapter === "string" ? error.modelAdapter : null,
    provider: typeof error.provider === "string" ? error.provider : "unknown",
    retryable: error.retryable === true,
    details: {
      baseUrl: typeof details.baseUrl === "string" ? details.baseUrl : undefined,
      model: typeof details.model === "string" ? details.model : undefined,
    },
  };
}

/**
 * Only localhost-style base URLs are safe to surface in the Console UI. Anything
 * else is hidden so a non-local provider address is never displayed.
 */
export function isLocalhostBaseUrl(baseUrl: string | null | undefined): boolean {
  if (!baseUrl) {
    return false;
  }

  try {
    const hostname = new URL(baseUrl).hostname.replace(/^\[|\]$/g, "");

    return (
      hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1"
    );
  } catch {
    return false;
  }
}

export function safeLocalBaseUrl(
  baseUrl: string | null | undefined,
): string | null {
  return isLocalhostBaseUrl(baseUrl) ? (baseUrl as string) : null;
}
