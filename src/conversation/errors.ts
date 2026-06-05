import { isModelError, type ModelError, type ModelErrorCode } from "../model";

export type ConversationErrorCode = ModelErrorCode | "CONVERSATION_RUNTIME_ERROR";

export type ConversationErrorDetails = {
  baseUrl?: string;
  model?: string;
  emptyContent?: boolean;
  emptyAfterThinkingRemoval?: boolean;
  possibleReasoningOnlyOutput?: boolean;
  thinkingArtifactRemoved?: boolean;
  unsafeContentIssue?: string;
  responseFields?: string[];
};

export type ConversationErrorPayload = {
  code: ConversationErrorCode;
  message: string;
  recovery: string[];
  modelAdapter: string | null;
  provider: string;
  retryable: boolean;
  details: ConversationErrorDetails;
};

export type ConversationErrorBody = {
  ok: false;
  error: ConversationErrorPayload;
};

const HTTP_STATUS: Record<ConversationErrorCode, number> = {
  LOCAL_MODEL_TIMEOUT: 504,
  LOCAL_MODEL_UNAVAILABLE: 503,
  LOCAL_MODEL_MISSING: 503,
  MODEL_RESPONSE_INVALID: 502,
  MODEL_PROVIDER_ERROR: 502,
  CONVERSATION_RUNTIME_ERROR: 500,
};

const USER_MESSAGE: Record<ConversationErrorCode, string> = {
  LOCAL_MODEL_TIMEOUT: "Local model generation timed out.",
  LOCAL_MODEL_UNAVAILABLE: "Local model runtime is not reachable.",
  LOCAL_MODEL_MISSING: "The selected local model is not available.",
  MODEL_RESPONSE_INVALID: "The model returned an invalid response.",
  MODEL_PROVIDER_ERROR: "The model provider returned an error.",
  CONVERSATION_RUNTIME_ERROR: "RIN could not complete this conversation turn.",
};

/**
 * Structured, user-visible conversation error. The conversation runtime builds
 * one from a typed {@link ModelError} (or from any other failure) so callers see
 * a concise reason and recovery guidance instead of a generic HTTP 500. It never
 * carries stack traces, secrets, or local filesystem paths.
 */
export class ConversationError extends Error {
  readonly payload: ConversationErrorPayload;
  readonly httpStatus: number;

  constructor(payload: ConversationErrorPayload, httpStatus: number, cause?: unknown) {
    super(payload.message);
    this.name = "ConversationError";
    this.payload = payload;
    this.httpStatus = httpStatus;

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export function isConversationError(value: unknown): value is ConversationError {
  return value instanceof ConversationError;
}

export function toConversationError(error: unknown): ConversationError {
  if (isConversationError(error)) {
    return error;
  }

  if (isModelError(error)) {
    return fromModelError(error);
  }

  return new ConversationError(
    {
      code: "CONVERSATION_RUNTIME_ERROR",
      message: USER_MESSAGE.CONVERSATION_RUNTIME_ERROR,
      recovery: buildRecovery("CONVERSATION_RUNTIME_ERROR", "local", undefined),
      modelAdapter: null,
      provider: "local",
      retryable: false,
      details: {},
    },
    HTTP_STATUS.CONVERSATION_RUNTIME_ERROR,
    error,
  );
}

export function conversationErrorResponse(error: unknown): {
  status: number;
  body: ConversationErrorBody;
} {
  const conversationError = toConversationError(error);

  return {
    status: conversationError.httpStatus,
    body: { ok: false, error: conversationError.payload },
  };
}

function fromModelError(error: ModelError): ConversationError {
  const details: ConversationErrorDetails = {};

  if (error.details.baseUrl) {
    details.baseUrl = error.details.baseUrl;
  }

  if (error.details.model) {
    details.model = error.details.model;
  }

  if (error.details.emptyContent !== undefined) {
    details.emptyContent = error.details.emptyContent;
  }

  if (error.details.emptyAfterThinkingRemoval !== undefined) {
    details.emptyAfterThinkingRemoval = error.details.emptyAfterThinkingRemoval;
  }

  if (error.details.possibleReasoningOnlyOutput !== undefined) {
    details.possibleReasoningOnlyOutput =
      error.details.possibleReasoningOnlyOutput;
  }

  if (error.details.thinkingArtifactRemoved !== undefined) {
    details.thinkingArtifactRemoved = error.details.thinkingArtifactRemoved;
  }

  if (error.details.unsafeContentIssue) {
    details.unsafeContentIssue = error.details.unsafeContentIssue;
  }

  if (error.details.responseFields) {
    details.responseFields = [...error.details.responseFields];
  }

  return new ConversationError(
    {
      code: error.code,
      message: USER_MESSAGE[error.code],
      recovery: buildRecovery(error.code, error.provider, error.details.model),
      modelAdapter: error.adapterId,
      provider: error.provider,
      retryable: error.retryable,
      details,
    },
    HTTP_STATUS[error.code],
    error,
  );
}

function buildRecovery(
  code: ConversationErrorCode,
  provider: string,
  model: string | undefined,
): string[] {
  const isLocal = provider === "local";
  const pullModel = model ?? "qwen3:4b";

  switch (code) {
    case "LOCAL_MODEL_TIMEOUT":
      return [
        "Try a shorter prompt.",
        "Keep RIN_OLLAMA_NUM_PREDICT=1024 or reduce it if local generation is too slow.",
        "Keep RIN_OLLAMA_TIMEOUT_MS=180000 or adjust it only if appropriate.",
        "Restart Ollama if it appears stuck.",
      ];
    case "LOCAL_MODEL_UNAVAILABLE":
      return [
        "Start the Ollama app or service.",
        "Check curl http://127.0.0.1:11434/api/tags.",
        "Confirm the local model runtime is running.",
      ];
    case "LOCAL_MODEL_MISSING":
      return [
        `Run ollama pull ${pullModel}.`,
        "Confirm the selected model name matches an installed local model.",
        "Check the active model adapter configuration.",
      ];
    case "MODEL_RESPONSE_INVALID":
      return [
        isLocal
          ? "Increase RIN_OLLAMA_NUM_PREDICT to give the local model room for final content."
          : "Retry the request.",
        "Retry with a shorter prompt.",
        isLocal
          ? "Check Qwen3 reasoning behavior; thinking-only output is not stored as a RIN reply."
          : "Check the selected model and adapter configuration.",
        isLocal
          ? "Try a non-reasoning local model if one is available."
          : "Confirm the configured model provider is reachable.",
      ];
    case "MODEL_PROVIDER_ERROR":
      return [
        "Retry the request.",
        "Check the selected model and adapter configuration.",
        isLocal
          ? "Confirm Ollama is running."
          : "Confirm the configured model provider is reachable.",
      ];
    case "CONVERSATION_RUNTIME_ERROR":
    default:
      return [
        "Retry the request.",
        "Run the local readiness report to check RIN runtime state.",
        "Inspect local raw and audit logs if the problem persists.",
      ];
  }
}
