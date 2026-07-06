import { memo } from "react";
import {
  DataTable,
  EmptyState,
  JsonInspector,
  MetricCard,
  SectionPanel,
  StatusBadge,
} from "../visualization";
import { safeDisplayJson } from "../utils";
import { CoreStatus } from "./CoreStatus";
import { ProviderWindow } from "./ProviderWindow";
import { CostWindow } from "./CostWindow";
import { TraceWindow } from "./TraceWindow";
import { ContextWindow } from "./ContextWindow";
import { CognitionFlowWindow } from "./CognitionFlowWindow";
import { MindWindow } from "./MindWindow";
import type {
  GlitchSnapshot,
  MindCandidateSafePatch,
  WindowPayload,
  WindowType,
} from "../types";
import type { DisplayMode } from "../visualization";

export const DeveloperWindow = memo(function DeveloperWindow({
  snapshot,
  displayMode,
  openWindow,
  reviewMindCandidate,
  editMindCandidate,
}: {
  snapshot: GlitchSnapshot | null;
  displayMode: DisplayMode;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
  reviewMindCandidate: (candidateId: string, action: "approve" | "reject" | "deactivate" | "reactivate") => Promise<void>;
  editMindCandidate: (candidateId: string, patch: MindCandidateSafePatch) => Promise<void>;
}) {
  if (!snapshot) return <EmptyState message="Developer diagnostics loading." />;
  const mode = snapshot.mind.latest?.messageUnderstanding.mode ?? "not available";
  const intent = snapshot.mind.latest?.messageUnderstanding.intentSummary ?? "No mind summary captured yet.";

  return (
    <div className="developer-module">
      <div className="module-strip">DEVELOPER DIAGNOSTICS · SAFE METADATA ONLY</div>
      <p className="readable-note">Diagnostic details are grouped here so normal use stays focused on Chat, Memory, Tasks, Body, and Settings.</p>
      <div className="developer-summary">
        <MetricCard label="current inferred mode" value={mode} />
        <MetricCard label="provider" value={snapshot.provider.activeProvider} />
        <MetricCard label="model" value={snapshot.provider.activeModel} />
        <MetricCard label="trace" value={<StatusBadge value={snapshot.trace.latest?.status ?? "missing"} />} />
        <MetricCard label="raw prompt" value={<StatusBadge value={snapshot.rawPromptIncluded} />} tone={snapshot.rawPromptIncluded ? "danger" : "ok"} />
        <MetricCard label="hidden reasoning" value={<StatusBadge value={snapshot.hiddenReasoningIncluded} />} tone={snapshot.hiddenReasoningIncluded ? "danger" : "ok"} />
      </div>
      <p className="readable-note">{intent}</p>

      <SectionPanel title="Data Boundary / Context Export" defaultOpen>
        <DataBoundary snapshot={snapshot} />
      </SectionPanel>
      <SectionPanel title="Runtime Status" defaultOpen>
        <CoreStatus snapshot={snapshot} />
      </SectionPanel>
      <SectionPanel title="Provider Runtime And Cost" defaultOpen>
        <ProviderWindow snapshot={snapshot} openWindow={openWindow} displayMode={displayMode} />
        <CostWindow snapshot={snapshot} displayMode={displayMode} />
      </SectionPanel>
      <SectionPanel title="Runtime Trace" defaultOpen={displayMode !== "basic"}>
        <TraceWindow trace={snapshot.trace.latest} analytics={snapshot.mind.analytics?.trace} displayMode={displayMode} />
      </SectionPanel>
      <SectionPanel title="Context Metadata" defaultOpen={displayMode !== "basic"}>
        <ContextWindow snapshot={snapshot} displayMode={displayMode} />
      </SectionPanel>
      <SectionPanel title="Cognition Flow" defaultOpen={displayMode === "developer"}>
        <CognitionFlowWindow flow={snapshot.cognitionFlow} displayMode={displayMode} openWindow={openWindow} />
      </SectionPanel>
      <SectionPanel title="Mind Internals" defaultOpen={displayMode === "developer"}>
        <MindWindow
          snapshot={snapshot}
          reviewMindCandidate={reviewMindCandidate}
          editMindCandidate={editMindCandidate}
          displayMode={displayMode}
        />
      </SectionPanel>
      <SectionPanel title="Console Data Map" defaultOpen={displayMode === "developer"}>
        <DataTable
          columns={[
            { key: "label", label: "block" },
            { key: "domain", label: "domain" },
            { key: "panel", label: "surface" },
            { key: "writable", label: "write" },
            { key: "safety", label: "safety" },
          ]}
          rows={snapshot.dataMap.dataBlocks.map((block) => ({
            label: block.label,
            domain: block.domain,
            panel: block.recommendedPanel,
            writable: block.writable ? "yes" : "no",
            safety: `${block.safetyLevel} / raw=${String(block.rawTextIncluded)}`,
          }))}
          empty="No data blocks registered."
        />
        <JsonInspector value={snapshot.dataMap} visible={displayMode === "developer"} stringify={safeDisplayJson} />
      </SectionPanel>
    </div>
  );
});

const DataBoundary = memo(function DataBoundary({ snapshot }: { snapshot: GlitchSnapshot }) {
  const context = snapshot.mind.analytics?.context;
  const plan = snapshot.mind.latest?.contextPlan;
  const flow = snapshot.cognitionFlow;
  const segmentTypes = context?.budget.segments.map((segment) => segment.type).join(", ") || "n/a";
  const providerCall = flow.steps.some((step) => step.sentToProvider) || snapshot.externalProviderCallCount > 0;
  return (
    <div className="developer-boundary">
      <div className="developer-summary">
        <MetricCard label="external API call" value={providerCall ? "yes" : "no"} />
        <MetricCard label="provider" value={snapshot.provider.activeProvider} />
        <MetricCard label="model" value={snapshot.provider.activeModel} />
        <MetricCard label="context segments" value={context?.sources.length ?? flow.contextSegments.length ?? 0} />
        <MetricCard label="segment types" value={segmentTypes} />
        <MetricCard label="recent history" value={plan?.selectedRecentMessageIds.length ?? "n/a"} />
        <MetricCard label="memory summary" value={(plan?.selectedMemorySourceIds.length ?? 0) > 0 ? "included" : "not included"} />
        <MetricCard label="profile summary" value={(plan?.selectedProfileSections.length ?? 0) > 0 ? "included" : "not included"} />
      </div>
      <div className="tag-row">
        <span>rawMemoryIncluded={String(snapshot.mind.rawMemoryIncluded)}</span>
        <span>rawProfileIncluded=false</span>
        <span>rawPromptExposed={String(snapshot.rawPromptIncluded || snapshot.trace.rawPromptIncluded)}</span>
        <span>hiddenReasoningExposed={String(snapshot.hiddenReasoningIncluded || snapshot.trace.hiddenReasoningIncluded)}</span>
        <span>secretValuesIncluded={String(snapshot.secretValuesIncluded)}</span>
      </div>
    </div>
  );
});
