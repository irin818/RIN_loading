import type { ModelAdapter, ModelRequest, ModelResponse } from "./types";

export const MOCK_MODEL_ADAPTER_ID = "rin-mock-local";

export const mockModelAdapter: ModelAdapter = {
  id: MOCK_MODEL_ADAPTER_ID,
  displayName: "RIN Mock Local Adapter",
  provider: "mock",
  async generate(request: ModelRequest): Promise<ModelResponse> {
    const latestOwnerMessage = [...request.messages]
      .reverse()
      .find((message) => message.role === "owner");
    const content = latestOwnerMessage?.content.trim() ?? "";

    return {
      adapterId: MOCK_MODEL_ADAPTER_ID,
      content:
        content.length > 0
          ? [
              "RIN local mock response / RIN 本地 mock 回复：",
              `I received your message without calling an external model: "${content}"`,
              `我已在不调用外部模型的情况下收到你的消息：“${content}”`,
            ].join("\n")
          : "RIN local mock response / RIN 本地 mock 回复：empty input / 空输入。",
      metadata: {
        externalProvider: false,
        memoryWriteRequested: false,
        toolCallRequested: false,
      },
    };
  },
};
