import { memo } from "react";
import { MetricCard, MiniBar, SectionPanel, StatusBadge, Timeline } from "../visualization";
import { safeDisplayJson } from "../utils";
import { JsonInspector } from "../visualization";
import type { DisplayMode } from "../visualization";
import type { MindTraceAnalytics, RuntimeTrace } from "../types";

export const TraceWindow = memo(function TraceWindow({
  trace,
  analytics,
  displayMode,
}: {
  trace: RuntimeTrace | null;
  analytics?: MindTraceAnalytics;
  displayMode: DisplayMode;
}) {
  if (!trace) return <p className="empty-state">No runtime trace captured yet.</p>;
  const stages = analytics?.stages ?? trace.stages.map((stage) => ({
    name: stage.name,
    displayName: stage.displayName,
    status: stage.status,
    durationMs: stage.durationMs,
    summary: stage.summary,
    startedAt: stage.startedAt,
    endedAt: stage.endedAt,
  }));
  const maxDuration = Math.max(1, ...stages.map((stage) => stage.durationMs));
  const hasError = trace.status === "failed" || (analytics?.latest.errorCount ?? 0) > 0;
  return (
    <div className="trace-module">
      <div className="module-strip">TRACE · {trace.status}</div>
      <div className="trace-summary-grid">
        <MetricCard label="turn" value={trace.turnShortId} />
        <MetricCard label="status" value={<StatusBadge value={trace.status} />} tone={hasError ? "danger" : "ok"} />
        <MetricCard label="elapsed" value={`${trace.totalDurationMs}ms`} />
        <MetricCard label="provider" value={`${analytics?.latest.providerDurationMs ?? "n/a"}ms`} />
        <MetricCard label="warnings" value={analytics?.latest.warningCount ?? 0} tone="warn" />
        <MetricCard label="errors" value={analytics?.latest.errorCount ?? (hasError ? 1 : 0)} tone={hasError ? "danger" : "ok"} />
        <MetricCard label="owner input last" value={analytics?.latest.currentOwnerInputLast ? "yes" : "n/a"} />
        <MetricCard label="raw prompt" value="hidden" tone="ok" />
      </div>
      <SectionPanel title="Pipeline Timeline" defaultOpen>
        <Timeline
          events={stages.map((stage) => ({
            id: `${stage.name}-${stage.startedAt}`,
            type: stage.displayName,
            label: `${stage.durationMs}ms`,
            at: stage.startedAt,
            status: stage.status,
          }))}
        />
      </SectionPanel>
      {displayMode !== "basic" ? (
        <SectionPanel title="Stage Durations" defaultOpen>
          <div className="duration-list">
            {stages.map((stage) => (
              <article key={`${stage.name}-duration`}>
                <header>
                  <strong>{stage.displayName}</strong>
                  <span>{stage.durationMs}ms</span>
                </header>
                <MiniBar value={stage.durationMs} max={maxDuration} label={stage.summary} />
                <p>{stage.summary}</p>
              </article>
            ))}
          </div>
        </SectionPanel>
      ) : null}
      <SectionPanel title="Safety Flags" defaultOpen={displayMode !== "basic"}>
        <div className="tag-row">
          <span>rawPromptIncluded=false</span>
          <span>hiddenReasoningIncluded=false</span>
          <span>rawModelOutputIncluded=false</span>
          <span>privacy={trace.privacyMode}</span>
        </div>
        {hasError ? <p className="readable-note">Latest trace reports {trace.errorCode ?? "a runtime error"}.</p> : null}
      </SectionPanel>
      <JsonInspector value={trace} visible={displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
});
