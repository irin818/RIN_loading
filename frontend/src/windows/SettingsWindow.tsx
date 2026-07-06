import { memo } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  MetricCard,
  SectionPanel,
  SegmentedControl,
  StatusBadge,
} from "../visualization";
import { displaySafeValue, formatCost } from "../utils";
import type { GlitchSnapshot, WindowPayload, WindowType } from "../types";
import type { Density, DisplayMode, DisplaySize } from "../visualization";

export const SettingsWindow = memo(function SettingsWindow({
  snapshot,
  uiSettings,
  setUiSettings,
  openWindow,
}: {
  snapshot: GlitchSnapshot | null;
  uiSettings: { displayMode: DisplayMode; displaySize: DisplaySize; density: Density };
  setUiSettings: Dispatch<SetStateAction<{ displayMode: DisplayMode; displaySize: DisplaySize; density: Density }>>;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
}) {
  const provider = snapshot?.provider;
  const cost = snapshot?.cost;
  const safeConfig = provider?.safeConfig ?? {};
  const latest = cost?.latest;
  const displayCurrency = cost?.displayCurrency ?? cost?.currency ?? "USD";
  const latestCost = latest
    ? latest.configuredEstimatedCostCny ?? latest.configuredEstimatedCostUsd ?? latest.estimatedCost
    : null;
  const totalCost = cost?.configuredEstimatedCostCny ?? cost?.configuredEstimatedCostUsd ?? cost?.totalEstimatedCost ?? 0;

  return (
    <div className="settings-module">
      <div className="module-strip">SETTINGS · MODEL, UI, SAFE STATUS</div>
      <SectionPanel title="Model / Provider" defaultOpen>
        <div className="settings-grid">
          <MetricCard label="configured" value={<StatusBadge value={Boolean(provider?.configured)} />} />
          <MetricCard label="provider" value={provider?.activeProvider ?? "loading"} />
          <MetricCard label="model" value={provider?.activeModel ?? "loading"} />
          <MetricCard label="health" value={<StatusBadge value={provider?.health ?? "loading"} />} />
          <MetricCard label="base url" value={displaySafeValue(safeConfig.baseUrl ?? "n/a")} />
          <MetricCard label="timeout" value={displaySafeValue(safeConfig.timeoutMs ?? "n/a")} />
          <MetricCard label="max tokens" value={displaySafeValue(safeConfig.maxTokens ?? "n/a")} />
          <MetricCard label="thinking mode" value={displaySafeValue(safeConfig.thinkingMode ?? "unset")} />
        </div>
        {provider?.lastError && provider.lastError !== "n/a" ? (
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
        <p className="readable-note">API key value is never displayed or editable from Glitch Core.</p>
      </SectionPanel>

      <SectionPanel title="Token / Cost Summary" defaultOpen>
        <div className="settings-grid">
          <MetricCard label="latest tokens" value={latest?.totalTokens ?? 0} />
          <MetricCard label="latest estimate" value={latestCost === null ? "n/a" : `${formatCost(latestCost)} ${latest?.displayCurrency ?? displayCurrency}`} />
          <MetricCard label="total tokens" value={cost?.totalTokens ?? 0} />
          <MetricCard label="total estimate" value={`${formatCost(totalCost)} ${displayCurrency}`} />
          <MetricCard label="cache split" value={cost?.cacheBreakdownAvailable ? "provider" : "estimated"} />
          <MetricCard label="billing match" value={<StatusBadge value={cost?.officialBillingMatch ?? "unavailable"} />} />
        </div>
        <p className="readable-note">Usage records are safe metadata only; raw prompts, raw responses, hidden reasoning, and secrets remain hidden.</p>
      </SectionPanel>

      <SectionPanel title="Interface" defaultOpen>
        <div className="control-settings">
          <SegmentedControl label="Mode" value={uiSettings.displayMode} options={["basic", "advanced", "developer"]} onChange={(displayMode) => setUiSettings((c) => ({ ...c, displayMode }))} />
          <SegmentedControl label="Size" value={uiSettings.displaySize} options={["small", "normal", "large", "xl"]} onChange={(displaySize) => setUiSettings((c) => ({ ...c, displaySize }))} />
          <SegmentedControl label="Density" value={uiSettings.density} options={["compact", "normal", "detailed"]} onChange={(density) => setUiSettings((c) => ({ ...c, density }))} />
        </div>
        <div className="inline-actions">
          <button type="button" onClick={() => openWindow("developer")}>OPEN DEVELOPER DIAGNOSTICS</button>
        </div>
      </SectionPanel>

      <SectionPanel title="Safety" defaultOpen>
        <div className="tag-row">
          <span>secretValuesIncluded=false</span>
          <span>rawPromptIncluded=false</span>
          <span>rawMemoryIncluded=false</span>
          <span>hiddenReasoningIncluded=false</span>
          <span>frontendProviderCalls=false</span>
        </div>
      </SectionPanel>
    </div>
  );
});
