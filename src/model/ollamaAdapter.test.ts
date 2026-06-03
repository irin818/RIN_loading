import { describe, expect, it } from "vitest";
import { createOllamaAdapter } from "./ollamaAdapter";

describe("createOllamaAdapter", () => {
  it("maps RIN messages to Ollama chat messages without external metadata", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const adapter = createOllamaAdapter({
      id: "rin-ollama-local",
      displayName: "Test Ollama adapter",
      baseUrl: "http://127.0.0.1:11434/",
      model: "qwen3:4b",
      timeoutMs: 1_000,
      fetchFn: async (url, init) => {
        requests.push({ url: String(url), init });

        return new Response(
          JSON.stringify({
            message: { role: "assistant", content: "local response" },
          }),
          { status: 200 },
        );
      },
    });
    const response = await adapter.generate({
      ownerId: "owner-a",
      conversationId: "conversation-a",
      messages: [
        { role: "system", content: "system boundary" },
        { role: "owner", content: "hello" },
        { role: "rin", content: "local acknowledgement" },
      ],
    });
    const body = JSON.parse(String(requests[0]?.init?.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
      stream: boolean;
    };

    expect(requests[0]?.url).toBe("http://127.0.0.1:11434/api/chat");
    expect(body).toEqual({
      model: "qwen3:4b",
      stream: false,
      messages: [
        { role: "system", content: "system boundary" },
        { role: "user", content: "hello" },
        { role: "assistant", content: "local acknowledgement" },
      ],
    });
    expect(response.content).toBe("local response");
    expect(response.metadata.externalProvider).toBe(false);
    expect(response.metadata.memoryWriteRequested).toBe(false);
    expect(response.metadata.toolCallRequested).toBe(false);
  });

  it("throws a clear error for non-2xx Ollama responses", async () => {
    const adapter = createOllamaAdapter({
      id: "rin-ollama-local",
      displayName: "Test Ollama adapter",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
      timeoutMs: 1_000,
      fetchFn: async () =>
        new Response(JSON.stringify({ error: "model is missing" }), {
          status: 404,
        }),
    });

    await expect(
      adapter.generate({
        ownerId: "owner-a",
        conversationId: "conversation-a",
        messages: [{ role: "owner", content: "hello" }],
      }),
    ).rejects.toThrow("Ollama returned an error: model is missing");
  });

  it("throws a clear error for invalid Ollama JSON", async () => {
    const adapter = createOllamaAdapter({
      id: "rin-ollama-local",
      displayName: "Test Ollama adapter",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
      timeoutMs: 1_000,
      fetchFn: async () => new Response("{", { status: 200 }),
    });

    await expect(
      adapter.generate({
        ownerId: "owner-a",
        conversationId: "conversation-a",
        messages: [{ role: "owner", content: "hello" }],
      }),
    ).rejects.toThrow("Ollama response was not valid JSON.");
  });

  it("throws a clear error when message.content is missing", async () => {
    const adapter = createOllamaAdapter({
      id: "rin-ollama-local",
      displayName: "Test Ollama adapter",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
      timeoutMs: 1_000,
      fetchFn: async () =>
        new Response(JSON.stringify({ message: { role: "assistant" } }), {
          status: 200,
        }),
    });

    await expect(
      adapter.generate({
        ownerId: "owner-a",
        conversationId: "conversation-a",
        messages: [{ role: "owner", content: "hello" }],
      }),
    ).rejects.toThrow("Ollama response did not include message.content.");
  });

  it("throws a clear error when local model configuration is missing", () => {
    expect(() =>
      createOllamaAdapter({
        id: "rin-ollama-local",
        displayName: "Test Ollama adapter",
        baseUrl: "http://127.0.0.1:11434",
        model: "",
        timeoutMs: 1_000,
      }),
    ).toThrow("RIN_OLLAMA_MODEL");
  });
});
