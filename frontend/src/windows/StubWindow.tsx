import { memo, useMemo } from "react";
import { safeDisplayJson } from "../utils";
import type { GlitchSnapshot, WindowType } from "../types";

const WINDOW_META_LABELS: Record<string, string> = {
  tasks: "TASKS", tools: "TOOLS", settings: "SETTINGS", system: "SYSTEM",
};

export const StubWindow = memo(function StubWindow({
  type,
  snapshot,
}: {
  type: WindowType;
  snapshot: GlitchSnapshot | null;
}) {
  const info = useMemo(() => {
    if (type === "system") return snapshot?.dashboard ?? {};
    return { status: "stub", reason: "UI placeholder only; no tool execution implemented" };
  }, [snapshot?.dashboard, type]);
  return (
    <div className="stub-module">
      <div className="module-strip">{WINDOW_META_LABELS[type] ?? type.toUpperCase()}</div>
      <pre className="safe-json">{safeDisplayJson(info)}</pre>
    </div>
  );
});
