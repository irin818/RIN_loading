import { describe, expect, it } from "vitest";
import { isModelError, ModelError, type ModelErrorCode } from "./errors";
import { createOllamaAdapter } from "./ollamaAdapter";

const generationOptions = {
  numPredict: 256,
  temperature: 0.5,
  topP: 0.85,
};

async function captureModelError(promise: Promise<unknown>): Promise<ModelError> {
  try {
    await promise;
  } catch (error) {
    if (isModelError(error)) {
      return error;
    }

    throw error;
  }

  throw new Error("Expected the adapter to throw a ModelError.");
}

describe("createOllamaAdapter", () => {
  it("maps RIN messages to Ollama chat messages without external metadata", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const adapter = createOllamaAdapter({
      id: "rin-ollama-local",
      displayName: "Test Ollama adapter",
      baseUrl: "http://127.0.0.1:11434/",
      model: "qwen3:4b",
      timeoutMs: 1_000,
      generationOptions,
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
      think: boolean;
      options: {
        num_predict: number;
        temperature: number;
        top_p: number;
      };
    };

    expect(requests[0]?.url).toBe("http://127.0.0.1:11434/api/chat");
    expect(body).toEqual({
      model: "qwen3:4b",
      stream: false,
      think: false,
      options: {
        num_predict: 256,
        temperature: 0.5,
        top_p: 0.85,
      },
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
      generationOptions,
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
      generationOptions,
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
      generationOptions,
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

  it("classifies empty assistant content without treating thinking as a reply", async () => {
    const adapter = createOllamaAdapter({
      id: "rin-ollama-local",
      displayName: "Test Ollama adapter",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
      timeoutMs: 1_000,
      generationOptions,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            message: {
              role: "assistant",
              content: "",
              thinking: "private reasoning that must not become a reply",
            },
            done: true,
          }),
          { status: 200 },
        ),
    });
    const error = await captureModelError(
      adapter.generate({
        ownerId: "owner-a",
        conversationId: "conversation-a",
        messages: [{ role: "owner", content: "请解释 RIN 的本地优先原则。" }],
      }),
    );

    expect(error.code).toBe("MODEL_RESPONSE_INVALID");
    expect(error.retryable).toBe(true);
    expect(error.message).toContain("empty assistant content");
    expect(error.message).toContain("Qwen3");
    expect(error.details).toMatchObject({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
      emptyContent: true,
      possibleReasoningOnlyOutput: true,
      responseFields: [
        "done",
        "message",
        "message.content",
        "message.role",
        "message.thinking",
      ],
    });
    expect(JSON.stringify(error.details)).not.toContain("private reasoning");
  });

  it("classifies reasoning-only top-level fields without exposing reasoning text", async () => {
    const adapter = createOllamaAdapter({
      id: "rin-ollama-local",
      displayName: "Test Ollama adapter",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
      timeoutMs: 1_000,
      generationOptions,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            message: { role: "assistant", content: "   " },
            reasoning: "long reasoning content that must not be exposed",
          }),
          { status: 200 },
        ),
    });
    const error = await captureModelError(
      adapter.generate({
        ownerId: "owner-a",
        conversationId: "conversation-a",
        messages: [{ role: "owner", content: "normal prompt" }],
      }),
    );

    expect(error.code).toBe("MODEL_RESPONSE_INVALID");
    expect(error.details.possibleReasoningOnlyOutput).toBe(true);
    expect(error.details.responseFields).toEqual([
      "message",
      "reasoning",
      "message.content",
      "message.role",
    ]);
    expect(JSON.stringify(error.details)).not.toContain("long reasoning");
  });

  it("strips paired thinking tags before returning assistant content", async () => {
    const adapter = createOllamaAdapter({
      id: "rin-ollama-local",
      displayName: "Test Ollama adapter",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
      timeoutMs: 1_000,
      generationOptions,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            message: {
              role: "assistant",
              content:
                "<think>private reasoning must not be stored</think>\n\n今晚可以吃番茄鸡蛋面。",
            },
          }),
          { status: 200 },
        ),
    });
    const response = await adapter.generate({
      ownerId: "owner-a",
      conversationId: "conversation-a",
      messages: [{ role: "owner", content: "今天晚上吃什么好" }],
    });

    expect(response.content).toBe("今晚可以吃番茄鸡蛋面。");
    expect(response.content).not.toContain("private reasoning");
    expect(response.content).not.toContain("<think>");
  });

  it("keeps only final content after an unpaired closing thinking tag", async () => {
    const adapter = createOllamaAdapter({
      id: "rin-ollama-local",
      displayName: "Test Ollama adapter",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
      timeoutMs: 1_000,
      generationOptions,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            message: {
              role: "assistant",
              content:
                "首先，用户问晚饭建议，我需要分析偏好。\n</think>\n\n今晚可以吃番茄鸡蛋面。",
            },
          }),
          { status: 200 },
        ),
    });
    const response = await adapter.generate({
      ownerId: "owner-a",
      conversationId: "conversation-a",
      messages: [{ role: "owner", content: "今天晚上吃什么好" }],
    });

    expect(response.content).toBe("今晚可以吃番茄鸡蛋面。");
    expect(response.content).not.toContain("首先");
    expect(response.content).not.toContain("</think>");
  });

  it("rejects thinking-only content after removing thinking artifacts", async () => {
    const adapter = createOllamaAdapter({
      id: "rin-ollama-local",
      displayName: "Test Ollama adapter",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
      timeoutMs: 1_000,
      generationOptions,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            message: {
              role: "assistant",
              content: "<think>private reasoning must not be stored</think>",
            },
          }),
          { status: 200 },
        ),
    });
    const error = await captureModelError(
      adapter.generate({
        ownerId: "owner-a",
        conversationId: "conversation-a",
        messages: [{ role: "owner", content: "今天晚上吃什么好" }],
      }),
    );

    expect(error.code).toBe("MODEL_RESPONSE_INVALID");
    expect(error.details.emptyAfterThinkingRemoval).toBe(true);
    expect(error.details.thinkingArtifactRemoved).toBe(true);
    expect(JSON.stringify(error.details)).not.toContain("private reasoning");
  });

  it("rejects untagged internal analysis instead of storing it", async () => {
    const adapter = createOllamaAdapter({
      id: "rin-ollama-local",
      displayName: "Test Ollama adapter",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
      timeoutMs: 1_000,
      generationOptions,
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            message: {
              role: "assistant",
              content:
                "首先，用户问今天晚上吃什么好。我需要考虑偏好后再回答。",
            },
          }),
          { status: 200 },
        ),
    });
    const error = await captureModelError(
      adapter.generate({
        ownerId: "owner-a",
        conversationId: "conversation-a",
        messages: [{ role: "owner", content: "今天晚上吃什么好" }],
      }),
    );

    expect(error.code).toBe("MODEL_RESPONSE_INVALID");
    expect(error.details.unsafeContentIssue).toBe("internal_analysis");
    expect(JSON.stringify(error.details)).not.toContain("今天晚上吃什么好");
  });

  it("throws a clear error when local model configuration is missing", () => {
    expect(() =>
      createOllamaAdapter({
        id: "rin-ollama-local",
        displayName: "Test Ollama adapter",
        baseUrl: "http://127.0.0.1:11434",
        model: "",
        timeoutMs: 1_000,
        generationOptions,
      }),
    ).toThrow("RIN_OLLAMA_MODEL");
  });

  it("throws actionable timeout guidance when the local model call aborts", async () => {
    const adapter = createOllamaAdapter({
      id: "rin-ollama-local",
      displayName: "Test Ollama adapter",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
      timeoutMs: 1,
      generationOptions,
      fetchFn: async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    });

    await expect(
      adapter.generate({
        ownerId: "owner-a",
        conversationId: "conversation-a",
        messages: [{ role: "owner", content: "hello" }],
      }),
    ).rejects.toThrow("Reduce prompt length");
  });

  it("classifies network failures as Ollama not reachable", async () => {
    const adapter = createOllamaAdapter({
      id: "rin-ollama-local",
      displayName: "Test Ollama adapter",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
      timeoutMs: 1_000,
      generationOptions,
      fetchFn: async () => {
        throw new TypeError("fetch failed");
      },
    });

    await expect(
      adapter.generate({
        ownerId: "owner-a",
        conversationId: "conversation-a",
        messages: [{ role: "owner", content: "hello" }],
      }),
    ).rejects.toThrow("Ollama local API is not reachable");
  });
});

describe("createOllamaAdapter typed model errors", () => {
  function adapterWith(fetchFn: typeof fetch, timeoutMs = 1_000) {
    return createOllamaAdapter({
      id: "rin-ollama-local",
      displayName: "Test Ollama adapter",
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3:4b",
      timeoutMs,
      generationOptions,
      fetchFn,
    });
  }

  const cases: Array<{
    name: string;
    code: ModelErrorCode;
    retryable: boolean;
    adapter: () => ReturnType<typeof createOllamaAdapter>;
  }> = [
    {
      name: "timeout",
      code: "LOCAL_MODEL_TIMEOUT",
      retryable: true,
      adapter: () =>
        adapterWith(
          async (_url, init) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => {
                reject(new DOMException("aborted", "AbortError"));
              });
            }),
          1,
        ),
    },
    {
      name: "network unavailable",
      code: "LOCAL_MODEL_UNAVAILABLE",
      retryable: true,
      adapter: () =>
        adapterWith(async () => {
          throw new TypeError("fetch failed");
        }),
    },
    {
      name: "missing model",
      code: "LOCAL_MODEL_MISSING",
      retryable: false,
      adapter: () =>
        adapterWith(
          async () =>
            new Response(JSON.stringify({ error: "model 'qwen3:4b' not found" }), {
              status: 404,
            }),
        ),
    },
    {
      name: "invalid response",
      code: "MODEL_RESPONSE_INVALID",
      retryable: true,
      adapter: () =>
        adapterWith(async () => new Response("{", { status: 200 })),
    },
  ];

  for (const testCase of cases) {
    it(`classifies ${testCase.name} as ${testCase.code}`, async () => {
      const error = await captureModelError(
        testCase.adapter().generate({
          ownerId: "owner-a",
          conversationId: "conversation-a",
          messages: [{ role: "owner", content: "hello" }],
        }),
      );

      expect(error.code).toBe(testCase.code);
      expect(error.provider).toBe("local");
      expect(error.adapterId).toBe("rin-ollama-local");
      expect(error.retryable).toBe(testCase.retryable);
      expect(error.details).toEqual({
        baseUrl: "http://127.0.0.1:11434",
        model: "qwen3:4b",
      });
    });
  }

  it("throws a typed missing-model error when configuration is missing", () => {
    try {
      createOllamaAdapter({
        id: "rin-ollama-local",
        displayName: "Test Ollama adapter",
        baseUrl: "http://127.0.0.1:11434",
        model: "",
        timeoutMs: 1_000,
        generationOptions,
      });
      throw new Error("Expected a ModelError to be thrown.");
    } catch (error) {
      expect(isModelError(error)).toBe(true);
      expect((error as ModelError).code).toBe("LOCAL_MODEL_MISSING");
    }
  });
});
