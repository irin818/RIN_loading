import type { ModelResponse } from "../model";

export type PolicyDecision = {
  allowed: boolean;
  reasonEnglish: string;
  reasonChinese: string;
};

export function evaluateModelResponse(response: ModelResponse): PolicyDecision {
  if (response.metadata.memoryWriteRequested) {
    return {
      allowed: false,
      reasonEnglish: "Model output requested a direct memory write.",
      reasonChinese: "模型输出请求直接写入记忆。",
    };
  }

  if (response.metadata.toolCallRequested) {
    return {
      allowed: false,
      reasonEnglish: "Model output requested a direct external side effect.",
      reasonChinese: "模型输出请求直接触发外部副作用。",
    };
  }

  return {
    allowed: true,
    reasonEnglish: "Model response is advisory and contains no direct side effects.",
    reasonChinese: "模型回复仅作为建议，未包含直接副作用。",
  };
}
