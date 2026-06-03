import type { OllamaGenerationOptions } from "./config";
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
        options: {
          num_predict: options.generationOptions.numPredict,
          temperature: options.generationOptions.temperature,
          top_p: options.generationOptions.topP,
        },
      } satisfies OllamaChatRequestBody),
      signal: controller.signal,
    });
    const body = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(
        readOllamaError(body, response.status, options.model) ??
          `Ollama returned ${response.status} for local chat request.`,
      );
    }

    return readOllamaAssistantContent(body);
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(
        [
          `Ollama local model timed out at ${endpoint}.`,
          `Timeout: ${options.timeoutMs}ms.`,
          "Reduce prompt length, lower RIN_OLLAMA_NUM_PREDICT, ensure Ollama is running, or try a smaller model/restart Ollama.",
        ].join(" "),
      );
    }

    if (error instanceof Error && error.message.startsWith("Ollama ")) {
      throw error;
    }

    throw new Error(
      [
        `Ollama local API is not reachable at ${endpoint}.`,
        `Start Ollama with \`open -ga Ollama\`, confirm \`curl http://127.0.0.1:11434/api/tags\`, and pull the model with \`ollama pull ${options.model}\`.`,
      ].join(" "),
    );
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

function readOllamaError(
  value: unknown,
  status: number,
  model: string,
): string | null {
  if (!isRecord(value)) {
    return readStatusError(status, model);
  }

  if (typeof value.error !== "string" || value.error.trim().length === 0) {
    return readStatusError(status, model);
  }

  const errorText = value.error.trim();
  const guidance = readOllamaGuidance(errorText, model);

  return `Ollama returned an error: ${errorText}${guidance}`;
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

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function readStatusError(status: number, model: string): string {
  if (status === 404) {
    return `Ollama returned 404 for local chat request. Confirm the model is pulled with \`ollama pull ${model}\`.`;
  }

  return `Ollama returned ${status} for local chat request. Confirm Ollama is running and check \`curl http://127.0.0.1:11434/api/tags\`.`;
}

function readOllamaGuidance(errorText: string, model: string): string {
  const normalized = errorText.toLowerCase();

  if (
    normalized.includes("not found") ||
    normalized.includes("not pulled") ||
    normalized.includes("model") ||
    normalized.includes("pull")
  ) {
    return ` Confirm the selected model is available with \`ollama pull ${model}\`.`;
  }

  return " Confirm Ollama is running and reduce RIN_OLLAMA_NUM_PREDICT if local generation is slow.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
