import { ModelError, type ModelErrorCode } from "./errors";
import type { ModelAdapter, ModelMessage, ModelRequest, ModelResponse } from "./types";

export type OpenAiCompatibleAdapterOptions = {
  id: string;
  displayName: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  fetchFn?: typeof fetch;
};

type ChatCompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function createOpenAiCompatibleAdapter(
  options: OpenAiCompatibleAdapterOptions,
): ModelAdapter {
  return {
    id: options.id,
    displayName: options.displayName,
    provider: "openai-compatible",
    async generate(request: ModelRequest): Promise<ModelResponse> {
      const response = await requestChatCompletion(options, request);

      return {
        adapterId: options.id,
        content: response.content,
        metadata: {
          externalProvider: true,
          memoryWriteRequested: false,
          toolCallRequested: response.toolCallRequested,
        },
      };
    },
  };
}

async function requestChatCompletion(
  options: OpenAiCompatibleAdapterOptions,
  request: ModelRequest,
): Promise<{ content: string; toolCallRequested: boolean }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
  const fetchFn = options.fetchFn ?? fetch;

  try {
    const response = await fetchFn(`${trimTrailingSlash(options.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        messages: request.messages.map(toChatCompletionMessage),
        stream: false,
      }),
      signal: controller.signal,
    });
    const body = await readJsonResponse(response, options);

    if (!response.ok) {
      throw providerError(
        options,
        "MODEL_PROVIDER_ERROR",
        readProviderError(body) ?? `Provider returned ${response.status}.`,
      );
    }

    const message = readFirstAssistantMessage(body);
    const content = message.content;

    if (!content) {
      throw providerError(
        options,
        "MODEL_RESPONSE_INVALID",
        "Provider response did not include assistant content.",
      );
    }

    return {
      content,
      toolCallRequested: message.toolCallRequested,
    };
  } catch (error) {
    if (error instanceof ModelError) {
      throw error;
    }

    if (isAbortError(error)) {
      throw providerError(
        options,
        "MODEL_PROVIDER_ERROR",
        `Provider request timed out after ${options.timeoutMs}ms.`,
        error,
      );
    }

    throw providerError(
      options,
      "MODEL_PROVIDER_ERROR",
      "Provider request failed before returning a response.",
      error,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function providerError(
  options: OpenAiCompatibleAdapterOptions,
  code: ModelErrorCode,
  message: string,
  cause?: unknown,
): ModelError {
  return new ModelError({
    code,
    message,
    adapterId: options.id,
    provider: "openai-compatible",
    details: { baseUrl: options.baseUrl, model: options.model },
    cause,
  });
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function toChatCompletionMessage(message: ModelMessage): ChatCompletionMessage {
  switch (message.role) {
    case "system":
      return { role: "system", content: message.content };
    case "owner":
      return { role: "user", content: message.content };
    case "rin":
      return { role: "assistant", content: message.content };
  }
}

async function readJsonResponse(
  response: Response,
  options: OpenAiCompatibleAdapterOptions,
): Promise<unknown> {
  const text = await response.text();

  if (text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw providerError(
      options,
      "MODEL_RESPONSE_INVALID",
      "Provider response was not valid JSON.",
      error,
    );
  }
}

function readFirstAssistantMessage(
  value: unknown,
): { content: string | null; toolCallRequested: boolean } {
  if (!isRecord(value) || !Array.isArray(value.choices)) {
    return { content: null, toolCallRequested: false };
  }

  const firstChoice = value.choices[0];

  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return { content: null, toolCallRequested: false };
  }

  return {
    content:
      typeof firstChoice.message.content === "string"
        ? firstChoice.message.content
        : null,
    toolCallRequested: Array.isArray(firstChoice.message.tool_calls),
  };
}

function readProviderError(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.error)) {
    return null;
  }

  return typeof value.error.message === "string" ? value.error.message : null;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
