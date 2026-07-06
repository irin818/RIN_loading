import { memo } from "react";
import { EmptyState, MetricCard, StatusBadge } from "../visualization";
import { safeDisplayJson } from "../utils";
import { JsonInspector } from "../visualization";
import type { DisplayMode } from "../visualization";
import type { GlitchSnapshot, WindowPayload, WindowType } from "../types";

export const ProviderWindow = memo(function ProviderWindow({
  snapshot,
  openWindow,
  displayMode,
}: {
  snapshot: GlitchSnapshot | null;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
  displayMode: DisplayMode;
}) {
  const provider = snapshot?.provider;
  if (!provider) return <p className="empty-state">Provider status loading.</p>;
  return (
    <div className="provider-module">
      <div className="module-strip">PROVIDER STATUS · SAFE CONFIG</div>
      <div className="provider-grid">
        <MetricCard label="provider" value={provider.activeProvider} />
        <MetricCard label="adapter" value={provider.activeAdapter} />
        <MetricCard label="model" value={provider.activeModel} />
        <MetricCard label="health" value={<StatusBadge value={provider.health} />} />
        <MetricCard label="latency" value={provider.lastLatencyMs} />
        <MetricCard label="streaming" value={provider.streamingSupport} />
      </div>
      <JsonInspector value={provider.safeConfig} visible={displayMode === "developer"} stringify={safeDisplayJson} />
      {provider.lastError !== "n/a" ? (
        <button
          type="button"
          className="danger-action"
          onClick={() =>
            openWindow("error", {
              contextName: provider.lastError,
              payload: {
                error: {
                  id: `provider-${provider.lastError}`,
                  code: provider.lastError,
                  severity: "error",
                  module: "provider",
                  message: "Provider reported an error in the latest trace.",
                  lastStep: "provider",
                  traceAvailable: true,
                },
              },
            })
          }
        >
          OPEN PROVIDER ERROR
        </button>
      ) : null}
    </div>
  );
});
