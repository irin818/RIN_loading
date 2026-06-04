import type { ModelAdapter } from "./types";

export type ModelErrorCode =
  | "LOCAL_MODEL_TIMEOUT"
  | "LOCAL_MODEL_UNAVAILABLE"
  | "LOCAL_MODEL_MISSING"
  | "MODEL_PROVIDER_ERROR"
  | "MODEL_RESPONSE_INVALID";

export type ModelErrorDetails = {
  baseUrl?: string;
  model?: string;
  emptyContent?: boolean;
  possibleReasoningOnlyOutput?: boolean;
  responseFields?: string[];
};

export type ModelErrorInit = {
  code: ModelErrorCode;
  message: string;
  adapterId: string;
  provider: ModelAdapter["provider"];
  retryable?: boolean;
  details?: ModelErrorDetails;
  cause?: unknown;
};

const DEFAULT_RETRYABLE: Record<ModelErrorCode, boolean> = {
  LOCAL_MODEL_TIMEOUT: true,
  LOCAL_MODEL_UNAVAILABLE: true,
  LOCAL_MODEL_MISSING: false,
  MODEL_PROVIDER_ERROR: true,
  MODEL_RESPONSE_INVALID: true,
};

/**
 * Typed model-layer error. Adapters throw this so the conversation runtime can
 * classify local model failures without inspecting provider internals. The
 * message stays adapter-friendly for local logs; user-facing wording is built
 * by the conversation error layer.
 */
export class ModelError extends Error {
  readonly code: ModelErrorCode;
  readonly adapterId: string;
  readonly provider: ModelAdapter["provider"];
  readonly retryable: boolean;
  readonly details: ModelErrorDetails;

  constructor(init: ModelErrorInit) {
    super(init.message);
    this.name = "ModelError";
    this.code = init.code;
    this.adapterId = init.adapterId;
    this.provider = init.provider;
    this.retryable = init.retryable ?? DEFAULT_RETRYABLE[init.code];
    this.details = { ...init.details };

    if (init.cause !== undefined) {
      this.cause = init.cause;
    }
  }
}

export function isModelError(value: unknown): value is ModelError {
  return value instanceof ModelError;
}
