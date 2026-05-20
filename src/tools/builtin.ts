import { registerTool } from "./registry";

export function registerBuiltinTools(): void {
  registerTool({
    id: "rin.local.status",
    displayName: "RIN Local Status",
    riskLevel: "L0",
    requiresConfirmation: false,
    descriptionEnglish: "Returns a static local status marker.",
    descriptionChinese: "返回静态本地状态标记。",
    execute: () => ({
      ok: true,
      english: "RIN local runtime is available.",
      chinese: "RIN 本地 runtime 可用。",
    }),
  });

  registerTool({
    id: "rin.time.now",
    displayName: "Current Time",
    riskLevel: "L0",
    requiresConfirmation: false,
    descriptionEnglish: "Returns the current local ISO timestamp.",
    descriptionChinese: "返回当前本地 ISO 时间戳。",
    execute: () => ({ now: new Date().toISOString() }),
  });
}
