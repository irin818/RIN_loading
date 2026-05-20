export type RuntimeBoundary = {
  name: string;
  phase: "reserved";
  english: string;
  chinese: string;
};

export const runtimeBoundaries: RuntimeBoundary[] = [
  {
    name: "model-layer",
    phase: "reserved",
    english: "Future adapter boundary for external or local models.",
    chinese: "未来用于外部模型或本地模型的适配器边界。",
  },
  {
    name: "memory-layer",
    phase: "reserved",
    english: "Future controlled path for memory proposals and writes.",
    chinese: "未来用于记忆建议和写入的受控路径。",
  },
  {
    name: "storage-layer",
    phase: "reserved",
    english: "Current Phase 2 focus: local data layout and manifest.",
    chinese: "当前 Phase 2 重点：本地数据布局和 manifest。",
  },
  {
    name: "policy-runtime",
    phase: "reserved",
    english: "Future slow-variable policy runtime.",
    chinese: "未来的慢变量策略运行时。",
  },
  {
    name: "state-engine",
    phase: "reserved",
    english: "Future local state control for embodied behavior.",
    chinese: "未来用于具身行为的本地状态控制。",
  },
  {
    name: "tool-permission-gateway",
    phase: "reserved",
    english: "Future permission gate before any tool execution.",
    chinese: "未来所有工具执行前必须经过的权限网关。",
  },
];
