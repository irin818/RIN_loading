import { memo } from "react";
import { ChartCard, DataTable, EmptyState, ExplanationList, MetricCard, StackedBar, StatusBadge } from "../visualization";
import { distribution, formatCost, safeDisplayJson, shortLabel } from "../utils";
import { JsonInspector } from "../visualization";
import type { DisplayMode } from "../visualization";
import type { GlitchSnapshot } from "../types";

export const CostWindow = memo(function CostWindow({
  snapshot,
  displayMode,
}: {
  snapshot: GlitchSnapshot | null;
  displayMode: DisplayMode;
}) {
  const cost = snapshot?.cost;
  if (!cost) return <p className="empty-state">Cost and token usage loading.</p>;
  const latest = cost.latest;
  const maxRecentTokens = Math.max(1, ...cost.recent.map((item) => item.totalTokens));
  const avgTokens = cost.eventCount ? Math.round(cost.totalTokens / cost.eventCount) : 0;
  const displayCurrency = cost.displayCurrency ?? cost.currency;
  const displayTotal = cost.configuredEstimatedCostCny ?? cost.configuredEstimatedCostUsd ?? cost.totalEstimatedCost;
  const avgCost = cost.eventCount ? displayTotal / cost.eventCount : 0;
  const providerDistribution = distribution(cost.recent.map((item) => item.providerId));
  const modelDistribution = distribution(cost.recent.map((item) => item.model));
  const rangeAvailable = cost.minEstimatedCostUsd !== null && cost.maxEstimatedCostUsd !== null && cost.configuredEstimatedCostUsd !== null;

  return (
    <div className="cost-module">
      <div className="module-strip">COST / TOKEN · SAFE LEDGER</div>
      <div className="cost-grid">
        <MetricCard label="provider" value={cost.provider} />
        <MetricCard label="model" value={cost.model} />
        <MetricCard label="config" value={<StatusBadge value={cost.configurationStatus} />} />
        <MetricCard label="pricing" value={cost.pricingProfile} />
        <MetricCard label="unit" value={cost.pricingUnit} />
        <MetricCard label="billing match" value={<StatusBadge value={cost.officialBillingMatch} />} />
        <MetricCard label="records" value={cost.eventCount} />
        <MetricCard label="total tokens" value={cost.totalTokens} />
        <MetricCard label="total cost" value={`${formatCost(displayTotal)} ${displayCurrency}`} />
        <MetricCard label="avg tokens" value={avgTokens} />
        <MetricCard label="avg cost" value={`${formatCost(avgCost)} ${displayCurrency}`} />
        <MetricCard label="cache split" value={cost.cacheBreakdownAvailable ? "provider" : "estimated"} />
      </div>
      <div className="cost-latest">
        <span>latest turn</span>
        {latest ? (
          <strong>
            {latest.inputTokens} in / {latest.outputTokens} out / {latest.totalTokens} total · {formatCost(latest.configuredEstimatedCostCny ?? latest.configuredEstimatedCostUsd ?? latest.estimatedCost)} {latest.displayCurrency ?? latest.currency}
          </strong>
        ) : <strong>no usage records yet</strong>}
      </div>
      <ChartCard title="DeepSeek Cost Range" note={cost.cacheBreakdownAvailable ? "provider cache tokens available" : "cache breakdown unavailable"}>
        <div className="cost-range-grid">
          <MetricCard label="min usd" value={cost.minEstimatedCostUsd === null ? "n/a" : formatCost(cost.minEstimatedCostUsd)} />
          <MetricCard label="configured usd" value={cost.configuredEstimatedCostUsd === null ? "n/a" : formatCost(cost.configuredEstimatedCostUsd)} />
          <MetricCard label="max usd" value={cost.maxEstimatedCostUsd === null ? "n/a" : formatCost(cost.maxEstimatedCostUsd)} />
          <MetricCard label="configured cny" value={cost.configuredEstimatedCostCny === null ? "n/a" : formatCost(cost.configuredEstimatedCostCny)} />
        </div>
        {rangeAvailable ? <StackedBar segments={[{ label: "min", value: cost.minEstimatedCostUsd ?? 0, tone: "input" }, { label: "configured", value: cost.configuredEstimatedCostUsd ?? 0, tone: "candidate" }, { label: "max", value: cost.maxEstimatedCostUsd ?? 0, tone: "output" }]} /> : null}
        <p className="readable-note">{cost.explanation}</p>
      </ChartCard>
      {latest ? (
        <ChartCard title="Latest Input / Output Split">
          <StackedBar segments={[{ label: "input", value: latest.inputTokens, tone: "input" }, { label: "output", value: latest.outputTokens, tone: "output" }]} />
          <p className="readable-note">Context characters: {latest.contextCharacterCount}. Raw prompt text is not exposed.</p>
        </ChartCard>
      ) : null}
      <div className="cost-record-list">
        {cost.recent.length ? cost.recent.slice(0, 20).map((item) => (
          <article key={item.id} className="cost-record">
            <div><span>{shortLabel(item.createdAt)}</span><b>{item.totalTokens} tok</b></div>
            <div className="cost-bar" aria-hidden="true"><span style={{ width: `${Math.max(4, (item.totalTokens / maxRecentTokens) * 100)}%` }} /></div>
            <small>{formatCost(item.configuredEstimatedCostCny ?? item.configuredEstimatedCostUsd ?? item.estimatedCost)} {item.displayCurrency ?? item.currency} · {item.estimateMethod} · {item.officialBillingMatch ?? "estimate"}</small>
          </article>
        )) : <p className="empty-state">Configure API chat and complete a turn to record usage.</p>}
      </div>
      {displayMode !== "basic" ? (
        <>
          <ChartCard title="Provider Distribution">
            <DataTable columns={[{ key: "label", label: "provider/model" }, { key: "value", label: "turns" }]} rows={[...providerDistribution, ...modelDistribution]} empty="No provider usage records." />
          </ChartCard>
          <ExplanationList items={["Token records are stored as safe usage metadata only.", "Context size is shown next to token use so high-cost turns can be diagnosed without exposing prompt text.", "DeepSeek official cache-hit billing can only be exact when provider usage includes cache hit and miss token counts.", "Daily trend needs more dated records; v1 keeps per-turn bars when history is short."]} />
        </>
      ) : null}
      <JsonInspector value={cost} visible={displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
});
