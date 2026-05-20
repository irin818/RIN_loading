export type ToolRiskLevel = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";

export type ToolDefinition<Input, Output> = {
  id: string;
  displayName: string;
  riskLevel: ToolRiskLevel;
  requiresConfirmation: boolean;
  descriptionEnglish: string;
  descriptionChinese: string;
  execute: (input: Input) => Promise<Output> | Output;
};

export type RegisteredTool = ToolDefinition<unknown, unknown>;

const tools = new Map<string, RegisteredTool>();

export function registerTool(tool: RegisteredTool): void {
  tools.set(tool.id, tool);
}

export function getTool(toolId: string): RegisteredTool {
  const tool = tools.get(toolId);

  if (!tool) {
    throw new Error(`Unknown tool: ${toolId}`);
  }

  return tool;
}

export function listTools(): RegisteredTool[] {
  return Array.from(tools.values());
}
