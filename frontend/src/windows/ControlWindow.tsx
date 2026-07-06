import { memo } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  DataTable, EmptyState, ExplanationList, JsonInspector,
  MetricCard, SectionPanel, SegmentedControl, StatusBadge,
} from "../visualization";
import { displaySafeValue, safeDisplayJson } from "../utils";
import type {
  ConfigRegistryPayload, ConsoleDataMapBlock,
  GlitchSnapshot, ImprovementProposal,
  WindowPayload, WindowType,
} from "../types";
import type { Density, DisplayMode, DisplaySize } from "../visualization";
import { ReviewStatusBadge } from "../visualization";

export const ControlWindow = memo(function ControlWindow({
  snapshot,
  displayMode,
  uiSettings,
  setUiSettings,
  reviewGrowthEvent,
  reviewToolRequest,
  runSelfReviewAction,
  reviewImprovementProposal,
  openWindow,
}: {
  snapshot: GlitchSnapshot | null;
  displayMode: DisplayMode;
  uiSettings: { displayMode: DisplayMode; displaySize: DisplaySize; density: Density };
  setUiSettings: Dispatch<SetStateAction<{ displayMode: DisplayMode; displaySize: DisplaySize; density: Density }>>;
  reviewGrowthEvent: (eventId: string, action: "approve" | "reject") => Promise<void>;
  reviewToolRequest: (requestId: string, action: "approve" | "reject") => Promise<void>;
  runSelfReviewAction: () => Promise<void>;
  reviewImprovementProposal: (proposalId: string, action: "approve" | "reject" | "convert") => Promise<void>;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
}) {
  const mind = snapshot?.mind;
  const dataMap = snapshot?.dataMap;
  const configRegistry = snapshot?.configRegistry;
  const selfReview = snapshot?.selfReview;
  const improvementProposals = snapshot?.improvementProposals;
  const growthEvents = mind ? (mind.growthEvents.length ? mind.growthEvents : mind.latest?.growthEvents ?? []) : [];
  const toolRequests = mind ? (mind.toolInvocationRequests.length ? mind.toolInvocationRequests : mind.latest?.toolInvocationRequests ?? []) : [];
  const pendingGrowth = growthEvents.filter((event) => !["owner_approved", "rejected"].includes(event.reviewStatus));
  const pendingTools = toolRequests.filter((request) => !["approved", "rejected", "executed", "blocked"].includes(request.status));
  const policy = mind?.policy;
  const dangerousFlags = policy ? [
    ["embeddings", policy.enableEmbeddings],
    ["model summaries", policy.enableModelSummaries],
    ["agent tools", policy.enableAgentTools],
    ["high-risk memory export", policy.allowHighRiskMemoryExport],
    ["self-model auto apply", policy.selfModelAutoApply],
  ] : [];

  return (
    <div className="control-module">
      <div className="module-strip">CONTROL · GOVERNANCE CENTER</div>
      <div className="control-grid">
        <MetricCard label="data blocks" value={dataMap?.dataBlocks.length ?? 0} />
        <MetricCard label="memory candidates" value={mind?.candidateCount ?? 0} />
        <MetricCard label="growth pending" value={pendingGrowth.length} tone={pendingGrowth.length ? "warn" : "ok"} />
        <MetricCard label="tool proposals" value={pendingTools.length} tone={pendingTools.length ? "warn" : "ok"} />
        <MetricCard label="danger defaults" value={policy?.dangerousDefaultsDisabled ? "disabled" : "check"} tone={policy?.dangerousDefaultsDisabled ? "ok" : "danger"} />
        <MetricCard label="provider keys" value="hidden" tone="ok" />
      </div>
      <SectionPanel title="View Controls" defaultOpen>
        <div className="control-settings">
          <SegmentedControl label="Mode" value={uiSettings.displayMode} options={["basic", "advanced", "developer"]} onChange={(displayMode) => setUiSettings((c) => ({ ...c, displayMode }))} />
          <SegmentedControl label="Size" value={uiSettings.displaySize} options={["small", "normal", "large", "xl"]} onChange={(displaySize) => setUiSettings((c) => ({ ...c, displaySize }))} />
          <SegmentedControl label="Density" value={uiSettings.density} options={["compact", "normal", "detailed"]} onChange={(density) => setUiSettings((c) => ({ ...c, density }))} />
        </div>
        <div className="windows-menu-actions inline-actions">
          <button type="button" onClick={() => openWindow("cognition")}>Cognition</button>
          <button type="button" onClick={() => openWindow("provider")}>Provider</button>
          <button type="button" onClick={() => openWindow("tools")}>Tools</button>
          <button type="button" onClick={() => openWindow("tasks")}>Tasks</button>
          <button type="button" onClick={() => openWindow("settings")}>Settings</button>
          <button type="button" onClick={() => openWindow("system")}>System</button>
        </div>
      </SectionPanel>
      <SectionPanel title="Config Registry" defaultOpen>
        <ConfigRegistryView registry={configRegistry} displayMode={displayMode} />
      </SectionPanel>
      <SectionPanel title="Self-review Reports" defaultOpen={displayMode !== "basic"}>
        <SelfReviewPanel selfReview={selfReview} onRunSelfReview={runSelfReviewAction} displayMode={displayMode} />
      </SectionPanel>
      <SectionPanel title="Improvement Proposals" defaultOpen>
        <ImprovementProposalPanel payload={improvementProposals} reviewImprovementProposal={reviewImprovementProposal} displayMode={displayMode} />
      </SectionPanel>
      <SectionPanel title="Policy Guardrails" defaultOpen>
        <div className="tag-row">
          {dangerousFlags.map(([label, enabled]) => <span key={String(label)}>{label}: {enabled ? "enabled" : "disabled"}</span>)}
        </div>
        {policy?.warnings.length ? <ExplanationList items={policy.warnings} /> : <p className="readable-note">Dangerous capabilities are disabled by default and policy writes are not exposed here.</p>}
      </SectionPanel>
      <SectionPanel title="Growth Governance" defaultOpen={displayMode !== "basic"}>
        <div className="governance-list">
          {growthEvents.length ? growthEvents.slice(0, 12).map((event) => {
            const actionable = !["owner_approved", "rejected"].includes(event.reviewStatus);
            return (
              <article key={event.id} className={`governance-row ${event.riskLevel}`}>
                <header><strong>{event.eventType}</strong><ReviewStatusBadge value={event.reviewStatus} /></header>
                <p>{event.summary}</p>
                <small>autoApplied=false · rawTextIncluded=false · active={String(event.active)}</small>
                {actionable ? <div className="mind-actions"><button type="button" onClick={() => void reviewGrowthEvent(event.id, "approve")}>APPROVE</button><button type="button" onClick={() => void reviewGrowthEvent(event.id, "reject")}>REJECT</button></div> : null}
              </article>
            );
          }) : <EmptyState message="No growth events awaiting review." />}
        </div>
      </SectionPanel>
      <SectionPanel title="Tool Proposal Governance" defaultOpen={displayMode !== "basic"}>
        <div className="governance-list">
          {toolRequests.length ? toolRequests.slice(0, 12).map((request) => {
            const actionable = !["approved", "rejected", "executed", "blocked"].includes(request.status);
            return (
              <article key={request.id} className={`governance-row ${request.riskLevel}`}>
                <header><strong>{request.toolName}</strong><StatusBadge value={request.status} /></header>
                <p>{request.actionSummary}</p>
                <small>executionDisabledByDefault=true · rawInputIncluded=false</small>
                {actionable ? <div className="mind-actions"><button type="button" onClick={() => void reviewToolRequest(request.id, "approve")}>APPROVE PROPOSAL</button><button type="button" onClick={() => void reviewToolRequest(request.id, "reject")}>REJECT</button></div> : null}
              </article>
            );
          }) : <EmptyState message="Tool execution remains disabled; no proposals." />}
        </div>
      </SectionPanel>
      <SectionPanel title="Data Map" defaultOpen={displayMode !== "basic"}>
        <DataMapView dataMap={dataMap} displayMode={displayMode} />
      </SectionPanel>
      <SectionPanel title="Provider And Cost Control" defaultOpen={displayMode === "developer"}>
        <div className="control-grid">
          <MetricCard label="provider" value={snapshot?.provider.activeProvider ?? "n/a"} />
          <MetricCard label="model" value={snapshot?.provider.activeModel ?? "n/a"} />
          <MetricCard label="pricing profile" value={snapshot?.cost.pricingProfile ?? "n/a"} />
          <MetricCard label="billing match" value={snapshot?.cost.officialBillingMatch ?? "n/a"} />
        </div>
        <p className="readable-note">Provider config is display-only. API keys and env values are never editable from this console.</p>
      </SectionPanel>
      <JsonInspector value={{ dataMap, policy, growthEvents, toolRequests, configRegistry, selfReview, improvementProposals }} visible={displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
});

// --- Sub-components for ControlWindow ---

const ConfigRegistryView = memo(function ConfigRegistryView({
  registry, displayMode,
}: { registry?: ConfigRegistryPayload; displayMode: DisplayMode }) {
  if (!registry) return <EmptyState message="Configuration registry loading." />;
  const highRiskCount = registry.items.filter((item) => item.riskLevel === "high").length;
  const editableCount = registry.items.filter((item) => item.editable).length;
  if (displayMode === "basic") {
    return (
      <div className="control-grid">
        <MetricCard label="sections" value={registry.sections.length} />
        <MetricCard label="items" value={registry.items.length} />
        <MetricCard label="high risk" value={highRiskCount} tone={highRiskCount ? "warn" : "ok"} />
        <MetricCard label="editable" value={editableCount} />
      </div>
    );
  }
  return (
    <div className="config-registry-view">
      <div className="data-map-grid">
        {registry.sections.map((section) => (
          <article key={section.id} className="data-domain domain-color-blue">
            <header><strong>{section.label}</strong><span>{registry.items.filter((item) => item.key.startsWith(section.id.split("-")[0])).length} items</span></header>
            <small>{section.description}</small>
          </article>
        ))}
      </div>
      <DataTable
        columns={[{ key: "key", label: "key" }, { key: "value", label: "current" }, { key: "source", label: "source" }, { key: "risk", label: "risk" }, { key: "editable", label: "edit" }, { key: "effect", label: "affects" }]}
        rows={registry.items.map((item) => ({ key: item.key, value: displaySafeValue(item.currentValue), source: item.envName ? `${item.source}:${item.envName}` : item.source, risk: item.riskLevel, editable: item.editable ? "yes" : "locked", effect: item.affects.join(", ") }))}
      />
      <p className="readable-note">Backend config editing is disabled in v1 except existing safe memory fields. API keys and env values are never shown or edited here.</p>
      <JsonInspector value={registry} visible={displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
});

import { shortLabel } from "../utils";

const SelfReviewPanel = memo(function SelfReviewPanel({
  selfReview, onRunSelfReview, displayMode,
}: { selfReview?: GlitchSnapshot["selfReview"]; onRunSelfReview: () => Promise<void>; displayMode: DisplayMode }) {
  if (!selfReview) return <EmptyState message="Self-review reports loading." />;
  return (
    <div className="self-review-panel">
      <div className="control-grid">
        <MetricCard label="reports" value={selfReview.reports.length} />
        <MetricCard label="proposal count" value={selfReview.proposalCount} />
        <MetricCard label="allowed level" value={`L${selfReview.allowedLevel}`} />
        <MetricCard label="L4+" value={selfReview.level4PlusLocked ? "locked" : "check"} tone={selfReview.level4PlusLocked ? "ok" : "danger"} />
      </div>
      <div className="inline-actions"><button type="button" onClick={() => void onRunSelfReview()}>RUN SELF REVIEW</button></div>
      <div className="governance-list">
        {selfReview.reports.length ? selfReview.reports.slice(0, 6).map((report) => (
          <article key={report.id} className={`governance-row ${report.riskLevel}`}>
            <header><strong>{shortLabel(report.createdAt)}</strong><StatusBadge value={report.status} /></header>
            <p>{report.summary}</p>
            <small>proposalIds={report.proposalIds.length} · rawTextIncluded=false</small>
          </article>
        )) : <EmptyState message="No self-review report yet. Run manual self review when needed." />}
      </div>
      <JsonInspector value={selfReview} visible={displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
});

const ImprovementProposalPanel = memo(function ImprovementProposalPanel({
  payload, reviewImprovementProposal, displayMode,
}: { payload?: GlitchSnapshot["improvementProposals"]; reviewImprovementProposal: (proposalId: string, action: "approve" | "reject" | "convert") => Promise<void>; displayMode: DisplayMode }) {
  if (!payload) return <EmptyState message="Improvement proposals loading." />;
  return (
    <div className="proposal-panel">
      <div className="control-grid">
        <MetricCard label="proposals" value={payload.proposals.length} />
        <MetricCard label="execution" value={payload.executionEnabled ? "enabled" : "disabled"} tone={payload.executionEnabled ? "danger" : "ok"} />
        <MetricCard label="auto PR" value={payload.autoPrEnabled ? "enabled" : "disabled"} tone={payload.autoPrEnabled ? "danger" : "ok"} />
        <MetricCard label="code write" value={payload.autoCodeWriteEnabled ? "enabled" : "disabled"} tone={payload.autoCodeWriteEnabled ? "danger" : "ok"} />
      </div>
      <div className="governance-list">
        {payload.proposals.length ? payload.proposals.slice(0, 10).map((proposal) => (
          <ImprovementProposalRow key={proposal.id} proposal={proposal} reviewImprovementProposal={reviewImprovementProposal} displayMode={displayMode} />
        )) : <EmptyState message="No improvement proposals yet. Run manual self review to create safe proposals." />}
      </div>
      <JsonInspector value={payload} visible={displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
});

const ImprovementProposalRow = memo(function ImprovementProposalRow({
  proposal, reviewImprovementProposal, displayMode,
}: { proposal: ImprovementProposal; reviewImprovementProposal: (proposalId: string, action: "approve" | "reject" | "convert") => Promise<void>; displayMode: DisplayMode }) {
  const actionable = !["rejected", "implemented", "verified", "archived", "blocked"].includes(proposal.status);
  return (
    <article className={`governance-row ${proposal.riskLevel}`}>
      <header><strong>{proposal.title}</strong><StatusBadge value={proposal.status} /></header>
      <p>{proposal.problemSummary}</p>
      <small>{proposal.type} · priority={proposal.priority} · requiresOwnerApproval={String(proposal.requiresOwnerApproval)}</small>
      {displayMode !== "basic" ? <div className="proposal-details"><p>{proposal.expectedBenefit}</p><small>{proposal.safetyImpact} · {proposal.dataPrivacyImpact}</small>{proposal.codexPromptDraft ? <pre className="safe-json">{proposal.codexPromptDraft}</pre> : null}</div> : null}
      {actionable ? <div className="mind-actions"><button type="button" onClick={() => void reviewImprovementProposal(proposal.id, "approve")}>APPROVE</button><button type="button" onClick={() => void reviewImprovementProposal(proposal.id, "reject")}>REJECT</button><button type="button" onClick={() => void reviewImprovementProposal(proposal.id, "convert")}>CODEX DRAFT</button></div> : null}
    </article>
  );
});

const DataMapView = memo(function DataMapView({
  dataMap, displayMode,
}: { dataMap?: GlitchSnapshot["dataMap"]; displayMode: DisplayMode }) {
  if (!dataMap) return <EmptyState message="Console data map loading." />;
  const blocksByDomain = new Map<string, ConsoleDataMapBlock[]>();
  for (const block of dataMap.dataBlocks) {
    blocksByDomain.set(block.domain, [...(blocksByDomain.get(block.domain) ?? []), block]);
  }
  if (displayMode === "basic") {
    return <div className="data-map-basic"><MetricCard label="domains" value={dataMap.domains.length} /><MetricCard label="blocks" value={dataMap.dataBlocks.length} /><MetricCard label="raw prompt" value="hidden" tone="ok" /><MetricCard label="secrets" value="hidden" tone="ok" /></div>;
  }
  return (
    <div className="data-map-view">
      <div className="data-map-grid">
        {dataMap.domains.map((domain) => {
          const blocks = blocksByDomain.get(domain.id) ?? [];
          const writable = blocks.filter((block) => block.writable).length;
          return <article key={domain.id} className={`data-domain domain-color-${domain.color}`}><header><strong>{domain.label}</strong><span>{blocks.length} blocks</span></header><small>{writable} writable · {blocks.filter((block) => block.hasGovernanceActions).length} governed</small></article>;
        })}
      </div>
      {displayMode === "developer" ? (
        <DataTable columns={[{ key: "label", label: "block" }, { key: "domain", label: "domain" }, { key: "panel", label: "panel" }, { key: "writable", label: "write" }, { key: "actions", label: "actions" }, { key: "safety", label: "safety" }]} rows={dataMap.dataBlocks.map((block) => ({ label: block.label, domain: block.domain, panel: block.recommendedPanel, writable: block.writable ? "yes" : "no", actions: block.controlActions.join(", ") || "none", safety: `${block.safetyLevel} / raw=${String(block.rawTextIncluded)}` }))} empty="No data blocks registered." />
      ) : null}
    </div>
  );
});
