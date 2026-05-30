import { describe, expect, it } from "vitest";
import { createOpenAiCompatibleAdapter } from "./openAiCompatibleAdapter";

describe("createOpenAiCompatibleAdapter", () => {
  it("maps RIN messages to chat completions without exposing side effects", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const adapter = createOpenAiCompatibleAdapter({
      id: "rin-openai-compatible",
      displayName: "Test compatible adapter",
      baseUrl: "https://provider.example/v1/",
      model: "provider-model",
      apiKey: "test-key",
      timeoutMs: 1_000,
      fetchFn: async (url, init) => {
        requests.push({ url: String(url), init });

        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "external response" } }],
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

    expect(requests[0]?.url).toBe("https://provider.example/v1/chat/completions");
    expect(body).toEqual({
      model: "provider-model",
      stream: false,
      messages: [
        { role: "system", content: "system boundary" },
        { role: "user", content: "hello" },
        { role: "assistant", content: "local acknowledgement" },
      ],
    });
    expect(response.content).toBe("external response");
    expect(response.metadata.externalProvider).toBe(true);
    expect(response.metadata.memoryWriteRequested).toBe(false);
    expect(response.metadata.toolCallRequested).toBe(false);
  });

  it("marks provider tool calls so local policy can block side effects", async () => {
    const adapter = createOpenAiCompatibleAdapter({
      id: "rin-openai-compatible",
      displayName: "Test compatible adapter",
      baseUrl: "https://provider.example/v1",
      model: "provider-model",
      apiKey: "test-key",
      timeoutMs: 1_000,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "I want to call a tool.",
                  tool_calls: [{ id: "call-a" }],
                },
              },
            ],
          }),
          { status: 200 },
        ),
    });
    const response = await adapter.generate({
      ownerId: "owner-a",
      conversationId: "conversation-a",
      messages: [{ role: "owner", content: "hello" }],
    });

    expect(response.metadata.toolCallRequested).toBe(true);
  });
});
