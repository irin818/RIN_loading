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
    const body = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(readProviderError(body) ?? `Provider returned ${response.status}.`);
    }

    const message = readFirstAssistantMessage(body);
    const content = message.content;

    if (!content) {
      throw new Error("Provider response did not include assistant content.");
    }

    return {
      content,
      toolCallRequested: message.toolCallRequested,
    };
  } finally {
    clearTimeout(timeoutId);
  }
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

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.trim().length === 0) {
    return {};
  }

  return JSON.parse(text) as unknown;
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
