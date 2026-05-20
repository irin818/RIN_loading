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
      reasonEnglish: "Model output requested direct tool execution.",
      reasonChinese: "模型输出请求直接执行工具。",
    };
  }

  return {
    allowed: true,
    reasonEnglish: "Model response is advisory and contains no direct side effects.",
    reasonChinese: "模型回复仅作为建议，未包含直接副作用。",
  };
}

export function requiresOwnerConfirmation(riskLevel: string): boolean {
  return ["L3", "L4", "L5"].includes(riskLevel);
}

export function canAutoExecuteRisk(riskLevel: string): boolean {
  return riskLevel === "L0" || riskLevel === "L1";
}
