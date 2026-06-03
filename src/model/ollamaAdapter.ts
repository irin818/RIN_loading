import type { OllamaGenerationOptions } from "./config";
import { ModelError, type ModelErrorCode } from "./errors";
import type { ModelAdapter, ModelMessage, ModelRequest, ModelResponse } from "./types";

export type OllamaAdapterOptions = {
  id: string;
  displayName: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  generationOptions: OllamaGenerationOptions;
  fetchFn?: typeof fetch;
};

type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OllamaChatRequestBody = {
  model: string;
  messages: OllamaChatMessage[];
  stream: false;
  options: {
    num_predict: number;
    temperature: number;
    top_p: number;
  };
};

export function createOllamaAdapter(options: OllamaAdapterOptions): ModelAdapter {
  const baseUrl = readRequiredOption(options, options.baseUrl, "RIN_OLLAMA_BASE_URL");
  const model = readRequiredOption(options, options.model, "RIN_OLLAMA_MODEL");

  return {
    id: options.id,
    displayName: options.displayName,
    provider: "local",
    async generate(request: ModelRequest): Promise<ModelResponse> {
      const content = await requestOllamaChat({ ...options, baseUrl, model }, request);

      return {
        adapterId: options.id,
        content,
        metadata: {
          externalProvider: false,
          memoryWriteRequested: false,
          toolCallRequested: false,
        },
      };
    },
  };
}

export function toOllamaChatMessage(message: ModelMessage): OllamaChatMessage {
  switch (message.role) {
    case "system":
      return { role: "system", content: message.content };
    case "owner":
      return { role: "user", content: message.content };
    case "rin":
      return { role: "assistant", content: message.content };
  }
}

async function requestOllamaChat(
  options: Required<Omit<OllamaAdapterOptions, "fetchFn">> & {
    fetchFn?: typeof fetch;
  },
  request: ModelRequest,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
  const endpoint = `${trimTrailingSlash(options.baseUrl)}/api/chat`;
  const fetchFn = options.fetchFn ?? fetch;

  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        messages: request.messages.map(toOllamaChatMessage),
        stream: false,
        options: {
          num_predict: options.generationOptions.numPredict,
          temperature: options.generationOptions.temperature,
          top_p: options.generationOptions.topP,
        },
      } satisfies OllamaChatRequestBody),
      signal: controller.signal,
    });
    const body = await readJsonResponse(options, response);

    if (!response.ok) {
      const classified = readOllamaError(body, response.status, options.model);

      throw modelError(options, classified.code, classified.message);
    }

    return readOllamaAssistantContent(options, body);
  } catch (error) {
    if (isAbortError(error)) {
      throw modelError(
        options,
        "LOCAL_MODEL_TIMEOUT",
        [
          `Ollama local model timed out at ${endpoint}.`,
          `Timeout: ${options.timeoutMs}ms.`,
          "Reduce prompt length, lower RIN_OLLAMA_NUM_PREDICT, ensure Ollama is running, or try a smaller model/restart Ollama.",
        ].join(" "),
      );
    }

    if (error instanceof ModelError) {
      throw error;
    }

    throw modelError(
      options,
      "LOCAL_MODEL_UNAVAILABLE",
      [
        `Ollama local API is not reachable at ${endpoint}.`,
        `Start Ollama with \`open -ga Ollama\`, confirm \`curl http://127.0.0.1:11434/api/tags\`, and pull the model with \`ollama pull ${options.model}\`.`,
      ].join(" "),
      error,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

type OllamaErrorContext = {
  id: string;
  baseUrl: string;
  model: string;
};

function modelError(
  context: OllamaErrorContext,
  code: ModelErrorCode,
  message: string,
  cause?: unknown,
): ModelError {
  return new ModelError({
    code,
    message,
    adapterId: context.id,
    provider: "local",
    details: { baseUrl: context.baseUrl, model: context.model },
    cause,
  });
}

async function readJsonResponse(
  context: OllamaErrorContext,
  response: Response,
): Promise<unknown> {
  const text = await response.text();

  if (text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw modelError(
      context,
      "MODEL_RESPONSE_INVALID",
      "Ollama response was not valid JSON.",
      error,
    );
  }
}

function readOllamaAssistantContent(
  context: OllamaErrorContext,
  value: unknown,
): string {
  if (!isRecord(value) || !isRecord(value.message)) {
    throw modelError(
      context,
      "MODEL_RESPONSE_INVALID",
      "Ollama response did not include message.content.",
    );
  }

  const content = value.message.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw modelError(
      context,
      "MODEL_RESPONSE_INVALID",
      "Ollama response did not include message.content.",
    );
  }

  return content;
}

type ClassifiedOllamaError = {
  code: ModelErrorCode;
  message: string;
};

function readOllamaError(
  value: unknown,
  status: number,
  model: string,
): ClassifiedOllamaError {
  if (!isRecord(value) || typeof value.error !== "string" || value.error.trim().length === 0) {
    return readStatusError(status, model);
  }

  const errorText = value.error.trim();
  const missingModel = indicatesMissingModel(errorText);
  const guidance = missingModel
    ? ` Confirm the selected model is available with \`ollama pull ${model}\`.`
    : " Confirm Ollama is running and reduce RIN_OLLAMA_NUM_PREDICT if local generation is slow.";

  return {
    code: missingModel || status === 404 ? "LOCAL_MODEL_MISSING" : "MODEL_PROVIDER_ERROR",
    message: `Ollama returned an error: ${errorText}${guidance}`,
  };
}

function readRequiredOption(
  options: OllamaAdapterOptions,
  value: string,
  envName: string,
): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new ModelError({
      code: "LOCAL_MODEL_MISSING",
      message: `Ollama adapter is missing model configuration: ${envName}.`,
      adapterId: options.id,
      provider: "local",
      retryable: false,
      details: {
        baseUrl: options.baseUrl.trim().length > 0 ? options.baseUrl.trim() : undefined,
        model: options.model.trim().length > 0 ? options.model.trim() : undefined,
      },
    });
  }

  return trimmed;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function readStatusError(status: number, model: string): ClassifiedOllamaError {
  if (status === 404) {
    return {
      code: "LOCAL_MODEL_MISSING",
      message: `Ollama returned 404 for local chat request. Confirm the model is pulled with \`ollama pull ${model}\`.`,
    };
  }

  return {
    code: "MODEL_PROVIDER_ERROR",
    message: `Ollama returned ${status} for local chat request. Confirm Ollama is running and check \`curl http://127.0.0.1:11434/api/tags\`.`,
  };
}

function indicatesMissingModel(errorText: string): boolean {
  const normalized = errorText.toLowerCase();

  return (
    normalized.includes("not found") ||
    normalized.includes("not pulled") ||
    normalized.includes("model") ||
    normalized.includes("pull")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
