import { memo } from "react";
import {
  DataTable, EmptyState, JsonInspector, MetricCard,
  SectionPanel, StatusBadge, Timeline,
} from "../visualization";
import { safeDisplayJson } from "../utils";
import type { DisplayMode } from "../visualization";
import type { CognitionFlowPayload, WindowPayload, WindowType } from "../types";

export const CognitionFlowWindow = memo(function CognitionFlowWindow({
  flow,
  displayMode,
  openWindow,
}: {
  flow?: CognitionFlowPayload;
  displayMode: DisplayMode;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
}) {
  if (!flow) return <EmptyState message="Cognition Flow loading." />;
  const requestMessages = Array.isArray(flow.providerSentContext.messages) ? flow.providerSentContext.messages as Array<Record<string, unknown>> : [];
  const contextSegments = flow.contextSegments;
  const turnImpact = flow.turnImpact;
  return (
    <div className="cognition-module">
      <div className="module-strip">COGNITION FLOW · SAFE TURN CHAIN</div>
      <div className="control-grid">
        <MetricCard label="turn" value={flow.turnShortId} />
        <MetricCard label="status" value={<StatusBadge value={flow.status} />} />
        <MetricCard label="trace" value={flow.traceAvailable ? "available" : "missing"} tone={flow.traceAvailable ? "ok" : "warn"} />
        <MetricCard label="mind snapshot" value={flow.snapshotAvailable ? "available" : "missing"} tone={flow.snapshotAvailable ? "ok" : "warn"} />
        <MetricCard label="owner input last" value={flow.ownerInput.latestOwnerInputPreservedAsFinalOwnerMessage ? "yes" : "no"} tone={flow.ownerInput.latestOwnerInputPreservedAsFinalOwnerMessage ? "ok" : "danger"} />
        <MetricCard label="raw prompt" value="hidden" tone="ok" />
      </div>
      <SectionPanel title="Causal Chain" defaultOpen>
        <Timeline events={flow.steps.map((step) => ({ id: step.id, type: step.label, label: `${step.status} · ${step.durationMs}ms`, at: flow.createdAt, status: step.status }))} />
        <div className="cognition-step-list">
          {flow.steps.map((step) => (
            <article key={step.id} className={`cognition-step ${step.status}`}>
              <header><strong>{step.label}</strong><StatusBadge value={step.status} /></header>
              <p>{step.summary}</p>
              <small>localOnly={String(step.localOnly)} · sentToProvider={String(step.sentToProvider)}</small>
              <JsonInspector value={step.details} visible={displayMode === "developer"} stringify={safeDisplayJson} />
            </article>
          ))}
        </div>
      </SectionPanel>
      <SectionPanel title="Provider Request Structure" defaultOpen={displayMode !== "basic"}>
        <div className="mind-plan-grid">
          <MetricCard label="messages" value={String(flow.providerSentContext.requestMessageCount ?? "n/a")} />
          <MetricCard label="chars" value={String(flow.providerSentContext.requestCharacterCount ?? "n/a")} />
          <MetricCard label="raw prompt" value="not included" tone="ok" />
          <MetricCard label="latest owner input" value={flow.providerSentContext.currentOwnerInputLast ? "last" : "check"} />
        </div>
        <DataTable
          columns={[{ key: "index", label: "index" }, { key: "role", label: "role" }, { key: "chars", label: "chars" }, { key: "source", label: "source" }, { key: "preview", label: "preview" }]}
          rows={requestMessages.map((message) => ({ index: String(message.index ?? "n/a"), role: String(message.role ?? "n/a"), chars: String(message.characterCount ?? "n/a"), source: String(message.sourceComponent ?? "n/a"), preview: message.previewIncluded === false ? "hidden" : "hidden" }))}
          empty="No provider request outline available."
        />
      </SectionPanel>
      <SectionPanel title="Context Segments" defaultOpen={displayMode !== "basic"}>
        <DataTable
          columns={[{ key: "source", label: "source" }, { key: "included", label: "included" }, { key: "reason", label: "reason" }, { key: "risk", label: "risk" }, { key: "tokens", label: "tokens" }, { key: "preview", label: "safe preview" }]}
          rows={contextSegments.slice(0, displayMode === "developer" ? 32 : 14).map((segment) => ({ source: `${String(segment.sourceKind ?? "n/a")}:${String(segment.sourceId ?? "n/a")}`, included: String(segment.included ?? false), reason: String(segment.reason ?? "n/a"), risk: String(segment.riskLevel ?? "n/a"), tokens: String(segment.estimatedTokens ?? "n/a"), preview: String(segment.safePreview ?? "") }))}
          empty="No context segment evidence available yet."
        />
      </SectionPanel>
      <SectionPanel title="Local-only Decisions" defaultOpen={displayMode !== "basic"}>
        <DataTable
          columns={[{ key: "label", label: "decision" }, { key: "usedFor", label: "used for" }, { key: "sent", label: "sent" }, { key: "raw", label: "raw text" }]}
          rows={flow.localOnlyDecisions.map((decision) => ({ label: String(decision.label ?? decision.id ?? "decision"), usedFor: String(decision.usedFor ?? "n/a"), sent: String(decision.sentToProvider ?? false), raw: "hidden" }))}
          empty="No local-only decisions recorded."
        />
      </SectionPanel>
      <SectionPanel title="Provider Response And Sanitizer" defaultOpen={displayMode !== "basic"}>
        <div className="mind-plan-grid">
          <MetricCard label="raw len" value={String(flow.providerResponseMetadata.rawContentLength ?? "n/a")} />
          <MetricCard label="raw hash" value={String(flow.providerResponseMetadata.rawContentHash ?? "n/a")} />
          <MetricCard label="thinking tag" value={<StatusBadge value={Boolean(flow.sanitizer.thinkingTagDetected)} />} />
          <MetricCard label="removed" value={String(flow.sanitizer.removedCharacterCount ?? 0)} />
          <MetricCard label="final safe" value={<StatusBadge value={Boolean(flow.sanitizer.finalAnswerSafe)} />} />
          <MetricCard label="raw output" value="hidden" tone="ok" />
        </div>
      </SectionPanel>
      <SectionPanel title="Turn Impact" defaultOpen>
        <div className="control-grid">
          <MetricCard label="memory candidates" value={String(turnImpact.memoryCandidates ? (turnImpact.memoryCandidates as unknown[]).length : 0)} />
          <MetricCard label="growth events" value={String(turnImpact.growthEvents ? (turnImpact.growthEvents as unknown[]).length : 0)} />
          <MetricCard label="tool proposals" value={String(turnImpact.toolProposals ? (turnImpact.toolProposals as unknown[]).length : 0)} />
          <MetricCard label="audit events" value={String(turnImpact.auditEvents ? (turnImpact.auditEvents as unknown[]).length : 0)} />
        </div>
        <div className="inline-actions">
          <button type="button" onClick={() => openWindow("mind")}>Mind</button>
          <button type="button" onClick={() => openWindow("memory")}>Memory</button>
          <button type="button" onClick={() => openWindow("control")}>Control</button>
        </div>
      </SectionPanel>
      <SectionPanel title="Locked Self-evolution Boundary" defaultOpen={displayMode !== "basic"}>
        <DataTable
          columns={[{ key: "capability", label: "capability" }, { key: "enabled", label: "enabled" }, { key: "locked", label: "locked" }]}
          rows={flow.dangerousCapabilities.map((item) => ({ capability: String(item.label ?? item.id ?? "capability"), enabled: String(item.enabled ?? false), locked: String(item.locked ?? true) }))}
          empty="No capability registry available."
        />
      </SectionPanel>
      <JsonInspector value={flow} visible={displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
});
