import { memo, useState } from "react";
import { EmptyState, JsonInspector, RiskBadge, ReviewStatusBadge, StatusBadge } from "../visualization";
import { safeDisplayJson } from "../utils";
import type { DisplayMode } from "../visualization";
import type { GlitchSnapshot, MemoryCard, MindMemoryCandidate, WindowPayload, WindowType } from "../types";

export const MemoryWindow = memo(function MemoryWindow({
  snapshot,
  memoryCompact,
  setMemoryCompact,
  memoryQuery,
  setMemoryQuery,
  searchMemory,
  reviewMindCandidate,
  openWindow,
}: {
  snapshot: GlitchSnapshot | null;
  memoryCompact: boolean;
  setMemoryCompact: (value: boolean) => void;
  memoryQuery: string;
  setMemoryQuery: (value: string) => void;
  searchMemory: () => Promise<void>;
  reviewMindCandidate: (candidateId: string, action: "approve" | "reject" | "deactivate" | "reactivate") => Promise<void>;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
}) {
  const cards = snapshot?.memory.cards ?? [];
  const candidates = snapshot?.mind.memoryCandidates.length
    ? snapshot.mind.memoryCandidates
    : snapshot?.mind.latest?.memoryCandidates ?? [];
  const [candidateFilter, setCandidateFilter] = useState<"pending" | "approved" | "rejected" | "inactive" | "all">("pending");
  const filteredCandidates = candidates.filter((candidate) => {
    if (candidateFilter === "pending") return ["candidate", "review_required"].includes(candidate.reviewStatus) && candidate.active;
    if (candidateFilter === "approved") return candidate.reviewStatus === "owner_approved" || candidate.reviewStatus === "auto_promoted";
    if (candidateFilter === "rejected") return candidate.reviewStatus === "rejected";
    if (candidateFilter === "inactive") return !candidate.active || candidate.reviewStatus === "inactive";
    return true;
  });
  const pendingCount = candidates.filter((candidate) => ["candidate", "review_required"].includes(candidate.reviewStatus) && candidate.active).length;
  const approvedCount = candidates.filter((candidate) => candidate.reviewStatus === "owner_approved" || candidate.reviewStatus === "auto_promoted").length;
  const rejectedCount = candidates.filter((candidate) => candidate.reviewStatus === "rejected").length;
  const inactiveCount = candidates.filter((candidate) => !candidate.active || candidate.reviewStatus === "inactive").length;
  return (
    <div className="memory-module">
      <div className="module-strip">MEMORY · GOVERNED REVIEW</div>
      <section className="memory-candidate-section" aria-label="Memory candidates">
        <div className="memory-summary-strip">
          <span><small>pending</small><b>{pendingCount}</b></span>
          <span><small>approved</small><b>{approvedCount}</b></span>
          <span><small>rejected</small><b>{rejectedCount}</b></span>
          <span><small>inactive</small><b>{inactiveCount}</b></span>
        </div>
        <div className="memory-filter-row">
          {(["pending", "approved", "rejected", "inactive", "all"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              className={candidateFilter === filter ? "active" : ""}
              onClick={() => setCandidateFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="memory-candidate-list">
          {filteredCandidates.length ? filteredCandidates.slice(0, 12).map((candidate) => (
            <MemoryCandidateReviewRow
              key={candidate.id}
              candidate={candidate}
              reviewMindCandidate={reviewMindCandidate}
            />
          )) : <EmptyState message="No memory candidates in this view." />}
        </div>
      </section>
      <div className="memory-toolbar">
        <input
          value={memoryQuery}
          onChange={(event) => setMemoryQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void searchMemory();
          }}
          placeholder="Filter memory metadata..."
        />
        <button type="button" onClick={() => void searchMemory()}>SEARCH</button>
        <button type="button" onClick={() => setMemoryCompact(!memoryCompact)}>
          {memoryCompact ? "EXPAND" : "COMPACT"}
        </button>
      </div>
      <div className={`memory-waterfall ${memoryCompact ? "compact" : "expanded"}`}>
        {cards.length ? (
          cards.map((card) => (
            <button
              key={`${card.kind}-${card.id}`}
              type="button"
              className="memory-card"
              onClick={() =>
                openWindow("memoryDetail", { contextName: card.title, payload: { card } })
              }
            >
              <span>{card.kind}</span>
              <strong>{card.title}</strong>
              <p>{card.contentPreview}</p>
              <dl>
                <div><dt>type</dt><dd>{card.type}</dd></div>
                <div><dt>score</dt><dd>{card.salienceScore}</dd></div>
                <div><dt>updated</dt><dd>{card.updatedAt}</dd></div>
              </dl>
            </button>
          ))
        ) : (
          <p className="empty-state">No memory cards match this filter.</p>
        )}
      </div>
    </div>
  );
});

const MemoryCandidateReviewRow = memo(function MemoryCandidateReviewRow({
  candidate,
  reviewMindCandidate,
}: {
  candidate: MindMemoryCandidate;
  reviewMindCandidate: (candidateId: string, action: "approve" | "reject" | "deactivate" | "reactivate") => Promise<void>;
}) {
  const actionable = ["candidate", "review_required"].includes(candidate.reviewStatus) && candidate.riskLevel !== "blocked";
  const canDeactivate = candidate.active && candidate.riskLevel !== "blocked";
  const canReactivate = !candidate.active && candidate.riskLevel !== "blocked";
  return (
    <article className={`memory-candidate-row ${candidate.riskLevel}`}>
      <header>
        <strong>{candidate.type}</strong>
        <ReviewStatusBadge value={candidate.reviewStatus} />
      </header>
      <p>{candidate.safeSummary}</p>
      {candidate.normalizedValue ? <small>{candidate.normalizedValue}</small> : null}
      <div className="tag-row">
        <RiskBadge value={candidate.riskLevel} />
        <StatusBadge value={candidate.active ? "active" : "inactive"} />
        <span>confidence: {candidate.confidence}</span>
        <span>rawTextIncluded=false</span>
        {candidate.tags.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <div className="mind-actions">
        {actionable ? (
          <>
            <button type="button" onClick={() => void reviewMindCandidate(candidate.id, "approve")}>APPROVE</button>
            <button type="button" onClick={() => void reviewMindCandidate(candidate.id, "reject")}>REJECT</button>
          </>
        ) : null}
        {canDeactivate ? <button type="button" onClick={() => void reviewMindCandidate(candidate.id, "deactivate")}>DEACTIVATE</button> : null}
        {canReactivate ? <button type="button" onClick={() => void reviewMindCandidate(candidate.id, "reactivate")}>REACTIVATE</button> : null}
      </div>
    </article>
  );
});

export const MemoryDetailWindow = memo(function MemoryDetailWindow({
  card,
  displayMode,
}: {
  card?: MemoryCard;
  displayMode: DisplayMode;
}) {
  if (!card) return <p className="empty-state">No memory card selected.</p>;
  return (
    <div className="detail-module">
      <div className="module-strip">{card.kind} · {card.shortId}</div>
      <h2>{card.title}</h2>
      <p>{card.summary}</p>
      <dl className="detail-list">
        <div><dt>memory_id</dt><dd>{card.id}</dd></div>
        <div><dt>type</dt><dd>{card.type}</dd></div>
        <div><dt>source</dt><dd>{card.source}</dd></div>
        <div><dt>linked session</dt><dd>{card.linkedSession}</dd></div>
        <div><dt>created_at</dt><dd>{card.createdAt}</dd></div>
        <div><dt>updated_at</dt><dd>{card.updatedAt}</dd></div>
        <div><dt>last_used_at</dt><dd>{card.lastUsedAt}</dd></div>
        <div><dt>confidence</dt><dd>{card.confidence}</dd></div>
        <div><dt>importance</dt><dd>{card.importance}</dd></div>
      </dl>
      <div className="tag-row">
        {card.tags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <JsonInspector value={card.metadata} visible={displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
});
