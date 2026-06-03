import type { ModelAdapter, ModelMessage, ModelRequest, ModelResponse } from "./types";

export type OllamaAdapterOptions = {
  id: string;
  displayName: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  fetchFn?: typeof fetch;
};

type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function createOllamaAdapter(options: OllamaAdapterOptions): ModelAdapter {
  const baseUrl = readRequiredOption(options.baseUrl, "RIN_OLLAMA_BASE_URL");
  const model = readRequiredOption(options.model, "RIN_OLLAMA_MODEL");

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
      }),
      signal: controller.signal,
    });
    const body = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(
        readOllamaError(body) ??
          `Ollama returned ${response.status} for local chat request.`,
      );
    }

    return readOllamaAssistantContent(body);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Ollama local API timed out at ${endpoint}.`);
    }

    if (error instanceof Error && error.message.startsWith("Ollama ")) {
      throw error;
    }

    throw new Error(`Ollama local API unavailable at ${endpoint}.`);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Ollama response was not valid JSON.");
  }
}

function readOllamaAssistantContent(value: unknown): string {
  if (!isRecord(value) || !isRecord(value.message)) {
    throw new Error("Ollama response did not include message.content.");
  }

  const content = value.message.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Ollama response did not include message.content.");
  }

  return content;
}

function readOllamaError(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  return typeof value.error === "string" && value.error.trim().length > 0
    ? `Ollama returned an error: ${value.error.trim()}`
    : null;
}

function readRequiredOption(value: string, envName: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`Ollama adapter is missing model configuration: ${envName}.`);
  }

  return trimmed;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
