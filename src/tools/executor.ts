import { randomUUID } from "node:crypto";
import { appendAuditEvent, type RinDatabase } from "../database";
import { canAutoExecuteRisk } from "../policy";
import { getTool } from "./registry";

export type ToolExecutionResult = {
  id: string;
  toolId: string;
  status: "completed" | "blocked";
  output: unknown;
};

export async function executeRegisteredTool(
  database: RinDatabase,
  toolId: string,
  input: unknown,
  now: Date = new Date(),
): Promise<ToolExecutionResult> {
  const tool = getTool(toolId);
  const id = randomUUID();

  if (tool.requiresConfirmation || !canAutoExecuteRisk(tool.riskLevel)) {
    database
      .prepare(
        `
          INSERT INTO tool_invocations (
            id,
            tool_id,
            risk_level,
            status,
            input_json,
            output_json,
            created_at
          )
          VALUES (?, ?, ?, 'blocked', ?, NULL, ?)
        `,
      )
      .run(id, tool.id, tool.riskLevel, JSON.stringify(input), now.toISOString());

    appendAuditEvent(database, {
      eventType: "tool.blocked",
      payload: { toolId, riskLevel: tool.riskLevel },
      now,
    });

    return { id, toolId, status: "blocked", output: null };
  }

  const output = await tool.execute(input);

  database
    .prepare(
      `
        INSERT INTO tool_invocations (
          id,
          tool_id,
          risk_level,
          status,
          input_json,
          output_json,
          created_at
        )
        VALUES (?, ?, ?, 'completed', ?, ?, ?)
      `,
    )
    .run(
      id,
      tool.id,
      tool.riskLevel,
      JSON.stringify(input),
      JSON.stringify(output),
      now.toISOString(),
    );

  appendAuditEvent(database, {
    eventType: "tool.completed",
    payload: { toolId, riskLevel: tool.riskLevel },
    now,
  });

  return { id, toolId, status: "completed", output };
}
