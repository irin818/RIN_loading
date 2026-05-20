import type { CoreStateFileStatus } from "../storage";

export function formatStatusLine(status: CoreStateFileStatus): string {
  const marker = status.exists ? "ok" : "missing";
  const action = status.created ? "created" : "checked";

  return `- [${marker}] ${status.relativePath} (${action})\n  ${status.english}\n  ${status.chinese}`;
}
