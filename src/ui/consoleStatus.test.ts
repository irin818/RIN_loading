import { describe, expect, it } from "vitest";
import {
  isLocalhostBaseUrl,
  parseConversationError,
  safeLocalBaseUrl,
} from "./consoleStatus";

describe("parseConversationError", () => {
  it("normalizes a structured Phase 25 error body including the recovery list", () => {
    const payload = parseConversationError({
      ok: false,
      error: {
        code: "LOCAL_MODEL_TIMEOUT",
        message: "Local model generation timed out.",
        recovery: ["Try a shorter prompt.", "Reduce RIN_OLLAMA_NUM_PREDICT."],
        modelAdapter: "rin-ollama-local",
        provider: "local",
        retryable: true,
        details: { baseUrl: "http://127.0.0.1:11434", model: "qwen3:4b" },
      },
    });

    expect(payload).not.toBeNull();
    expect(payload?.code).toBe("LOCAL_MODEL_TIMEOUT");
    expect(payload?.message).toBe("Local model generation timed out.");
    expect(payload?.recovery).toEqual([
      "Try a shorter prompt.",
      "Reduce RIN_OLLAMA_NUM_PREDICT.",
    ]);
    expect(payload?.modelAdapter).toBe("rin-ollama-local");
    expect(payload?.provider).toBe("local");
    expect(payload?.retryable).toBe(true);
    expect(payload?.details).toEqual({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
    });
  });

  it("handles missing optional fields gracefully", () => {
    const payload = parseConversationError({
      error: { code: "CONVERSATION_RUNTIME_ERROR", message: "Something failed." },
    });

    expect(payload).not.toBeNull();
    expect(payload?.recovery).toEqual([]);
    expect(payload?.modelAdapter).toBeNull();
    expect(payload?.provider).toBe("unknown");
    expect(payload?.retryable).toBe(false);
    expect(payload?.details).toEqual({ baseUrl: undefined, model: undefined });
  });

  it("returns null for non-structured or malformed bodies", () => {
    expect(parseConversationError(null)).toBeNull();
    expect(parseConversationError("offline")).toBeNull();
    expect(parseConversationError({ ok: false })).toBeNull();
    expect(parseConversationError({ error: { message: "no code" } })).toBeNull();
    expect(parseConversationError({ error: { code: "X" } })).toBeNull();
  });

  it("drops non-string recovery entries defensively", () => {
    const payload = parseConversationError({
      error: {
        code: "MODEL_PROVIDER_ERROR",
        message: "Provider error.",
        recovery: ["Retry the request.", 42, null, "Check configuration."],
      },
    });

    expect(payload?.recovery).toEqual([
      "Retry the request.",
      "Check configuration.",
    ]);
  });
});

describe("isLocalhostBaseUrl / safeLocalBaseUrl", () => {
  it("accepts localhost-style base URLs", () => {
    expect(isLocalhostBaseUrl("http://127.0.0.1:11434")).toBe(true);
    expect(isLocalhostBaseUrl("http://localhost:11434")).toBe(true);
    expect(isLocalhostBaseUrl("http://[::1]:11434")).toBe(true);
    expect(safeLocalBaseUrl("http://127.0.0.1:11434")).toBe(
      "http://127.0.0.1:11434",
    );
  });

  it("rejects and hides non-local or invalid base URLs", () => {
    expect(isLocalhostBaseUrl("https://api.example.com")).toBe(false);
    expect(isLocalhostBaseUrl("http://10.0.0.5:11434")).toBe(false);
    expect(isLocalhostBaseUrl(null)).toBe(false);
    expect(isLocalhostBaseUrl(undefined)).toBe(false);
    expect(isLocalhostBaseUrl("not a url")).toBe(false);
    expect(safeLocalBaseUrl("https://api.example.com")).toBeNull();
  });
});
