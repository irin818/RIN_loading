import { describe, expect, it } from "vitest";
import { ModelError, type ModelErrorCode } from "../model";
import {
  ConversationError,
  conversationErrorResponse,
  isConversationError,
  toConversationError,
} from "./errors";

function localModelError(code: ModelErrorCode): ModelError {
  return new ModelError({
    code,
    message: `local failure: ${code}`,
    adapterId: "rin-ollama-local",
    provider: "local",
    details: { baseUrl: "http://127.0.0.1:11434", model: "qwen3:4b" },
  });
}

describe("toConversationError", () => {
  it("maps a local timeout to a 504 structured error with recovery guidance", () => {
    const error = toConversationError(localModelError("LOCAL_MODEL_TIMEOUT"));

    expect(isConversationError(error)).toBe(true);
    expect(error.httpStatus).toBe(504);
    expect(error.payload.code).toBe("LOCAL_MODEL_TIMEOUT");
    expect(error.payload.message).toBe("Local model generation timed out.");
    expect(error.payload.modelAdapter).toBe("rin-ollama-local");
    expect(error.payload.provider).toBe("local");
    expect(error.payload.retryable).toBe(true);
    expect(error.payload.details).toEqual({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
    });
    expect(error.payload.recovery).toContain("Reduce RIN_OLLAMA_NUM_PREDICT.");
  });

  it("maps an unavailable local runtime to a 503 structured error", () => {
    const error = toConversationError(localModelError("LOCAL_MODEL_UNAVAILABLE"));

    expect(error.httpStatus).toBe(503);
    expect(error.payload.code).toBe("LOCAL_MODEL_UNAVAILABLE");
    expect(error.payload.retryable).toBe(true);
    expect(error.payload.recovery.join(" ")).toContain("/api/tags");
  });

  it("maps a missing model to a 503 structured error with pull guidance", () => {
    const error = toConversationError(localModelError("LOCAL_MODEL_MISSING"));

    expect(error.httpStatus).toBe(503);
    expect(error.payload.code).toBe("LOCAL_MODEL_MISSING");
    expect(error.payload.retryable).toBe(false);
    expect(error.payload.recovery).toContain("Run ollama pull qwen3:4b.");
  });

  it("maps an invalid model response to a 502 structured error", () => {
    const error = toConversationError(localModelError("MODEL_RESPONSE_INVALID"));

    expect(error.httpStatus).toBe(502);
    expect(error.payload.code).toBe("MODEL_RESPONSE_INVALID");
  });

  it("maps a provider error to a 502 structured error", () => {
    const error = toConversationError(localModelError("MODEL_PROVIDER_ERROR"));

    expect(error.httpStatus).toBe(502);
    expect(error.payload.code).toBe("MODEL_PROVIDER_ERROR");
  });

  it("maps unknown failures to a generic 500 runtime error", () => {
    const error = toConversationError(new Error("unexpected failure"));

    expect(error.httpStatus).toBe(500);
    expect(error.payload.code).toBe("CONVERSATION_RUNTIME_ERROR");
    expect(error.payload.modelAdapter).toBeNull();
    expect(error.payload.retryable).toBe(false);
    expect(error.payload.message).toBe(
      "RIN could not complete this conversation turn.",
    );
  });

  it("passes through an existing conversation error unchanged", () => {
    const original = toConversationError(localModelError("LOCAL_MODEL_TIMEOUT"));

    expect(toConversationError(original)).toBe(original);
  });

  it("never leaks the raw provider message or stack in the payload", () => {
    const error = toConversationError(localModelError("MODEL_PROVIDER_ERROR"));
    const serialized = JSON.stringify(error.payload);

    expect(serialized).not.toContain("local failure:");
    expect(serialized).not.toContain("stack");
  });
});

describe("conversationErrorResponse", () => {
  it("returns a structured JSON body and HTTP status for typed model errors", () => {
    const { status, body } = conversationErrorResponse(
      localModelError("LOCAL_MODEL_TIMEOUT"),
    );

    expect(status).toBe(504);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("LOCAL_MODEL_TIMEOUT");
    expect(Array.isArray(body.error.recovery)).toBe(true);
  });

  it("returns a generic 500 body for unknown failures instead of throwing", () => {
    const { status, body } = conversationErrorResponse("string failure");

    expect(status).toBe(500);
    expect(body.error.code).toBe("CONVERSATION_RUNTIME_ERROR");
  });
});

describe("ConversationError", () => {
  it("is an Error subclass with a public payload and http status", () => {
    const error = new ConversationError(
      {
        code: "LOCAL_MODEL_TIMEOUT",
        message: "Local model generation timed out.",
        recovery: ["Try a shorter prompt."],
        modelAdapter: "rin-ollama-local",
        provider: "local",
        retryable: true,
        details: {},
      },
      504,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Local model generation timed out.");
    expect(error.httpStatus).toBe(504);
  });
});
