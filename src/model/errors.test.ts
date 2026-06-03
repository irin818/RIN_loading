import { describe, expect, it } from "vitest";
import { isModelError, ModelError } from "./errors";

describe("ModelError", () => {
  it("captures classification, adapter identity, and safe details", () => {
    const error = new ModelError({
      code: "LOCAL_MODEL_TIMEOUT",
      message: "Ollama local model timed out.",
      adapterId: "rin-ollama-local",
      provider: "local",
      details: { baseUrl: "http://127.0.0.1:11434", model: "qwen3:4b" },
    });

    expect(error).toBeInstanceOf(Error);
    expect(isModelError(error)).toBe(true);
    expect(error.code).toBe("LOCAL_MODEL_TIMEOUT");
    expect(error.adapterId).toBe("rin-ollama-local");
    expect(error.provider).toBe("local");
    expect(error.details).toEqual({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
    });
  });

  it("derives retryable defaults per code while allowing overrides", () => {
    expect(
      new ModelError({
        code: "LOCAL_MODEL_TIMEOUT",
        message: "timeout",
        adapterId: "rin-ollama-local",
        provider: "local",
      }).retryable,
    ).toBe(true);

    expect(
      new ModelError({
        code: "LOCAL_MODEL_MISSING",
        message: "missing",
        adapterId: "rin-ollama-local",
        provider: "local",
      }).retryable,
    ).toBe(false);

    expect(
      new ModelError({
        code: "LOCAL_MODEL_MISSING",
        message: "missing",
        adapterId: "rin-ollama-local",
        provider: "local",
        retryable: true,
      }).retryable,
    ).toBe(true);
  });

  it("does not treat plain errors as model errors", () => {
    expect(isModelError(new Error("plain"))).toBe(false);
    expect(isModelError("LOCAL_MODEL_TIMEOUT")).toBe(false);
  });
});
