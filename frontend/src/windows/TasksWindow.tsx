import { memo } from "react";
import {
  EmptyState,
  JsonInspector,
  MetricCard,
  SectionPanel,
  StatusBadge,
} from "../visualization";
import { safeDisplayJson, shortLabel } from "../utils";
import type { DisplayMode } from "../visualization";
import type { GlitchSnapshot, ImprovementProposal } from "../types";

export const TasksWindow = memo(function TasksWindow({
  snapshot,
  displayMode,
  runSelfReviewAction,
  reviewImprovementProposal,
  reviewGrowthEvent,
  reviewToolRequest,
}: {
  snapshot: GlitchSnapshot | null;
  displayMode: DisplayMode;
  runSelfReviewAction: () => Promise<void>;
  reviewImprovementProposal: (proposalId: string, action: "approve" | "reject" | "convert") => Promise<void>;
  reviewGrowthEvent: (eventId: string, action: "approve" | "reject") => Promise<void>;
  reviewToolRequest: (requestId: string, action: "approve" | "reject") => Promise<void>;
}) {
  const selfReview = snapshot?.selfReview;
  const proposals = snapshot?.improvementProposals;
  const mind = snapshot?.mind;
  const growthEvents = mind ? (mind.growthEvents.length ? mind.growthEvents : mind.latest?.growthEvents ?? []) : [];
  const toolRequests = mind ? (mind.toolInvocationRequests.length ? mind.toolInvocationRequests : mind.latest?.toolInvocationRequests ?? []) : [];
  const pendingGrowth = growthEvents.filter((event) => !["owner_approved", "rejected"].includes(event.reviewStatus));
  const pendingTools = toolRequests.filter((request) => !["approved", "rejected", "executed", "blocked"].includes(request.status));

  return (
    <div className="tasks-module">
      <div className="module-strip">TASKS · PROPOSALS REQUIRE OWNER REVIEW</div>
      <div className="control-grid">
        <MetricCard label="self reviews" value={selfReview?.reports.length ?? 0} />
        <MetricCard label="improvements" value={proposals?.proposals.length ?? 0} />
        <MetricCard label="growth pending" value={pendingGrowth.length} tone={pendingGrowth.length ? "warn" : "ok"} />
        <MetricCard label="tool proposals" value={pendingTools.length} tone={pendingTools.length ? "warn" : "ok"} />
        <MetricCard label="execution" value={proposals?.executionEnabled ? "enabled" : "disabled"} tone={proposals?.executionEnabled ? "danger" : "ok"} />
        <MetricCard label="code write" value={proposals?.autoCodeWriteEnabled ? "enabled" : "disabled"} tone={proposals?.autoCodeWriteEnabled ? "danger" : "ok"} />
      </div>

      <SectionPanel title="Self-review Reports" defaultOpen>
        {!selfReview ? <EmptyState message="Self-review reports loading." /> : (
          <div className="self-review-panel">
            <div className="inline-actions">
              <button type="button" onClick={() => void runSelfReviewAction()}>RUN SELF REVIEW</button>
            </div>
            <div className="governance-list">
              {selfReview.reports.length ? selfReview.reports.slice(0, 6).map((report) => (
                <article key={report.id} className={`governance-row ${report.riskLevel}`}>
                  <header><strong>{shortLabel(report.createdAt)}</strong><StatusBadge value={report.status} /></header>
                  <p>{report.summary}</p>
                  <small>proposalIds={report.proposalIds.length} · rawTextIncluded=false</small>
                </article>
              )) : <EmptyState message="No self-review report yet. Run manual self review when needed." />}
            </div>
          </div>
        )}
      </SectionPanel>

      <SectionPanel title="Improvement Proposals" defaultOpen>
        {!proposals ? <EmptyState message="Improvement proposals loading." /> : (
          <div className="proposal-panel">
            <div className="governance-list">
              {proposals.proposals.length ? proposals.proposals.slice(0, 10).map((proposal) => (
                <ImprovementProposalRow
                  key={proposal.id}
                  proposal={proposal}
                  displayMode={displayMode}
                  reviewImprovementProposal={reviewImprovementProposal}
                />
              )) : <EmptyState message="No improvement proposals yet. Run manual self review to create safe proposals." />}
            </div>
            <JsonInspector value={proposals} visible={displayMode === "developer"} stringify={safeDisplayJson} />
          </div>
        )}
      </SectionPanel>

      <SectionPanel title="Growth Governance" defaultOpen={displayMode !== "basic"}>
        <div className="governance-list">
          {growthEvents.length ? growthEvents.slice(0, 12).map((event) => {
            const actionable = !["owner_approved", "rejected"].includes(event.reviewStatus);
            return (
              <article key={event.id} className={`governance-row ${event.riskLevel}`}>
                <header><strong>{event.eventType}</strong><StatusBadge value={event.reviewStatus} /></header>
                <p>{event.summary}</p>
                <small>autoApplied=false · rawTextIncluded=false · active={String(event.active)}</small>
                {actionable ? (
                  <div className="mind-actions">
                    <button type="button" onClick={() => void reviewGrowthEvent(event.id, "approve")}>APPROVE</button>
                    <button type="button" onClick={() => void reviewGrowthEvent(event.id, "reject")}>REJECT</button>
                  </div>
                ) : null}
              </article>
            );
          }) : <EmptyState message="No growth events awaiting review." />}
        </div>
      </SectionPanel>

      <SectionPanel title="Tool Proposals" defaultOpen={displayMode !== "basic"}>
        <div className="governance-list">
          {toolRequests.length ? toolRequests.slice(0, 12).map((request) => {
            const actionable = !["approved", "rejected", "executed", "blocked"].includes(request.status);
            return (
              <article key={request.id} className={`governance-row ${request.riskLevel}`}>
                <header><strong>{request.toolName}</strong><StatusBadge value={request.status} /></header>
                <p>{request.actionSummary}</p>
                <small>executionDisabledByDefault=true · rawInputIncluded=false</small>
                {actionable ? (
                  <div className="mind-actions">
                    <button type="button" onClick={() => void reviewToolRequest(request.id, "approve")}>APPROVE PROPOSAL</button>
                    <button type="button" onClick={() => void reviewToolRequest(request.id, "reject")}>REJECT</button>
                  </div>
                ) : null}
              </article>
            );
          }) : <EmptyState message="Tool execution remains disabled; no proposals." />}
        </div>
      </SectionPanel>
    </div>
  );
});

const ImprovementProposalRow = memo(function ImprovementProposalRow({
  proposal,
  reviewImprovementProposal,
  displayMode,
}: {
  proposal: ImprovementProposal;
  reviewImprovementProposal: (proposalId: string, action: "approve" | "reject" | "convert") => Promise<void>;
  displayMode: DisplayMode;
}) {
  const actionable = !["rejected", "implemented", "verified", "archived", "blocked"].includes(proposal.status);
  return (
    <article className={`governance-row ${proposal.riskLevel}`}>
      <header><strong>{proposal.title}</strong><StatusBadge value={proposal.status} /></header>
      <p>{proposal.problemSummary}</p>
      <small>{proposal.type} · priority={proposal.priority} · requiresOwnerApproval={String(proposal.requiresOwnerApproval)}</small>
      {displayMode !== "basic" ? (
        <div className="proposal-details">
          <p>{proposal.expectedBenefit}</p>
          <small>{proposal.safetyImpact} · {proposal.dataPrivacyImpact}</small>
          {proposal.codexPromptDraft ? <pre className="safe-json">{proposal.codexPromptDraft}</pre> : null}
        </div>
      ) : null}
      {actionable ? (
        <div className="mind-actions">
          <button type="button" onClick={() => void reviewImprovementProposal(proposal.id, "approve")}>APPROVE</button>
          <button type="button" onClick={() => void reviewImprovementProposal(proposal.id, "reject")}>REJECT</button>
          <button type="button" onClick={() => void reviewImprovementProposal(proposal.id, "convert")}>CODEX DRAFT</button>
        </div>
      ) : null}
    </article>
  );
});
