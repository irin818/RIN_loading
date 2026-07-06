import { memo } from "react";
import { ChartCard, DataTable, EmptyState, JsonInspector, MetricCard, SectionPanel, StackedBar } from "../visualization";
import type { DisplayMode } from "../visualization";
import { safeDisplayJson } from "../utils";
import type { GlitchSnapshot, MindContextAnalytics, MindContextPlan } from "../types";

export const ContextWindow = memo(function ContextWindow({
  snapshot, displayMode,
}: { snapshot: GlitchSnapshot | null; displayMode: DisplayMode }) {
  const latest = snapshot?.mind.latest;
  const analytics = snapshot?.mind.analytics?.context;
  if (!latest) return <p className="empty-state">No context plan captured yet.</p>;
  const outline = analytics?.providerRequestOutline;
  return (
    <div className="context-module">
      <div className="module-strip">CONTEXT · PROVIDER REQUEST SHAPE</div>
      <div className="mind-plan-grid">
        <MetricCard label="messages" value={outline?.messageCount ?? "n/a"} />
        <MetricCard label="memory selected" value={outline?.selectedMemoryCount ?? latest.memoryRetrieval.selected.length} />
        <MetricCard label="memory excluded" value={outline?.excludedMemoryCount ?? latest.memoryRetrieval.excluded.length} />
        <MetricCard label="owner input last" value={outline?.currentOwnerInputLast ? "yes" : "n/a"} tone={outline?.currentOwnerInputLast ? "ok" : "warn"} />
      </div>
      <SectionPanel title="Context Budget" defaultOpen>
        <ContextPlanView analytics={analytics} fallbackPlan={latest.contextPlan} displayMode={displayMode} />
      </SectionPanel>
      <SectionPanel title="Safe Retrieval Inputs" defaultOpen={displayMode !== "basic"}>
        <div className="mind-list">
          {latest.memoryRetrieval.selected.length ? latest.memoryRetrieval.selected.map((item) => (
            <article key={`${item.sourceKind}:${item.sourceId}`} className="mind-row">
              <strong>{item.sourceKind}</strong><p>{item.safeSummary}</p>
              {item.normalizedValue ? <small>{item.normalizedValue}</small> : null}
              <small>score={item.score} · rawTextIncluded=false</small>
            </article>
          )) : <EmptyState message="No memory selected for current provider context." />}
        </div>
      </SectionPanel>
      <SectionPanel title="Safety Flags" defaultOpen={displayMode !== "basic"}>
        <div className="tag-row">
          <span>rawPromptIncluded=false</span><span>rawMemoryIncluded=false</span>
          <span>hiddenReasoningIncluded=false</span>
          <span>latestOwnerInputLast={String(outline?.currentOwnerInputLast ?? false)}</span>
        </div>
      </SectionPanel>
    </div>
  );
});

const ContextPlanView = memo(function ContextPlanView({
  analytics, fallbackPlan, displayMode,
}: { analytics?: MindContextAnalytics; fallbackPlan: MindContextPlan; displayMode: DisplayMode }) {
  if (!analytics) return <EmptyState message="Context analytics not available yet." />;
  return (
    <div className="context-plan-view">
      <div className="context-flow">{analytics.flow.map((step) => <span key={step}>{step}</span>)}</div>
      <ChartCard title="Context Budget"><StackedBar segments={analytics.budget.segments.map((s) => ({ label: s.type, value: s.estimatedTokens, tone: s.type }))} /><p className="readable-note">{analytics.explanation}</p></ChartCard>
      <DataTable columns={[{ key: "source", label: "source" }, { key: "included", label: "included" }, { key: "reason", label: "reason" }, { key: "risk", label: "risk" }, { key: "tokens", label: "tokens" }, { key: "preview", label: "safe preview" }]} rows={analytics.sources.slice(0, 16).map((s) => ({ source: `${s.sourceKind}:${s.sourceId}`, included: s.included ? "yes" : "no", reason: s.reason, risk: s.riskLevel, tokens: String(s.estimatedTokens), preview: s.safePreview || "n/a" }))} />
      <div className="mind-plan-grid"><MetricCard label="messages" value={analytics.providerRequestOutline.messageCount} /><MetricCard label="memory selected" value={analytics.providerRequestOutline.selectedMemoryCount} /><MetricCard label="excluded" value={analytics.providerRequestOutline.excludedMemoryCount} /><MetricCard label="owner input last" value={analytics.providerRequestOutline.currentOwnerInputLast ? "yes" : "no"} tone={analytics.providerRequestOutline.currentOwnerInputLast ? "ok" : "danger"} /></div>
      <JsonInspector value={{ analytics, fallbackPlan }} visible={displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
});
