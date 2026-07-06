import { memo, useState } from "react";
import {
  ChartCard, DataTable, EmptyState, ExplanationList, JsonInspector,
  MetricCard, MiniBar, RiskBadge, ReviewStatusBadge, SectionPanel,
  StackedBar, StatusBadge, Timeline,
} from "../visualization";
import {
  levelValue, recordDistributionSegments, safeDisplayJson, shortLabel, uniqueValues,
} from "../utils";
import type {
  GlitchSnapshot, MemoryCandidateAnalytics,
  MindCandidateSafePatch, MindContextAnalytics, MindContextPlan,
  MindMemoryAnalytics, MindMemoryCandidate, MindOwnerState,
  MindOwnerStateTrend, MindResponsePlan,
} from "../types";
import type { DisplayMode } from "../visualization";

export const MindWindow = memo(function MindWindow({
  snapshot,
  reviewMindCandidate,
  editMindCandidate,
  displayMode,
}: {
  snapshot: GlitchSnapshot | null;
  reviewMindCandidate: (candidateId: string, action: "approve" | "reject" | "deactivate" | "reactivate") => Promise<void>;
  editMindCandidate: (candidateId: string, patch: MindCandidateSafePatch) => Promise<void>;
  displayMode: DisplayMode;
}) {
  const mind = snapshot?.mind;
  const latest = mind?.latest;
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  if (!mind || !latest) return <p className="empty-state">No RIN Mind snapshot captured yet.</p>;
  const understanding = latest.messageUnderstanding;
  const ownerState = latest.ownerState;
  const contextPlan = latest.contextPlan;
  const retrieval = latest.memoryRetrieval;
  const responsePlan = latest.responsePlan;
  const candidates = mind.memoryCandidates.length ? mind.memoryCandidates : latest.memoryCandidates;
  const analytics = mind.analytics;
  const memoryAnalytics = analytics?.memory;
  const contextAnalytics = analytics?.context;
  const candidateAnalytics = memoryAnalytics?.candidates ?? [];
  const analyticsById = new Map(candidateAnalytics.map((item) => [item.candidateId, item]));
  const typeOptions = uniqueValues(candidates.map((c) => c.type));
  const filteredCandidates = candidates.filter((candidate) => {
    const searchable = [candidate.safeSummary, candidate.normalizedValue ?? "", candidate.type, candidate.reviewStatus, candidate.riskLevel, candidate.tags.join(" ")].join(" ").toLowerCase();
    const activeMatch = activeFilter === "all" || (activeFilter === "active" && candidate.active) || (activeFilter === "inactive" && !candidate.active);
    return (statusFilter === "all" || candidate.reviewStatus === statusFilter) && (riskFilter === "all" || candidate.riskLevel === riskFilter) && (typeFilter === "all" || candidate.type === typeFilter) && activeMatch && (!candidateSearch.trim() || searchable.includes(candidateSearch.trim().toLowerCase()));
  });
  const selectedCandidate = (selectedCandidateId ? candidateAnalytics.find((item) => item.candidateId === selectedCandidateId) : undefined) ?? candidateAnalytics[0];
  const disabledFeatures: Array<[string, boolean]> = [
    ["embeddings", mind.policy.enableEmbeddings], ["model summaries", mind.policy.enableModelSummaries], ["agent tools", mind.policy.enableAgentTools],
    ["high-risk memory export", mind.policy.allowHighRiskMemoryExport], ["self-model auto apply", mind.policy.selfModelAutoApply],
  ];
  return (
    <div className="mind-module">
      <div className="module-strip">RIN MIND · SAFE SNAPSHOT</div>
      <div className="mind-grid">
        <MetricCard label="mode" value={understanding.mode} />
        <MetricCard label="support" value={ownerState.supportNeed} />
        <MetricCard label="urgency" value={<StatusBadge value={understanding.urgency} />} />
        <MetricCard label="risk" value={<RiskBadge value={understanding.privacyRisk} />} />
        <MetricCard label="memory selected" value={retrieval.selected.length} />
        <MetricCard label="candidates" value={mind.candidateCount} />
      </div>
      <SectionPanel title="Mind Policy" defaultOpen={displayMode !== "basic"}>
        <div className="mind-plan-grid">
          <MetricCard label="ctx" value={mind.policy.contextMaxCharacters} />
          <MetricCard label="recent max" value={mind.policy.recentHistorySelectedLimit} />
          <MetricCard label="memory max" value={mind.policy.memoryMaxSelected} />
          <MetricCard label="dangerous defaults" value={mind.policy.dangerousDefaultsDisabled ? "disabled" : "check"} tone={mind.policy.dangerousDefaultsDisabled ? "ok" : "danger"} />
        </div>
        <div className="tag-row">{disabledFeatures.map(([label, enabled]) => <span key={String(label)}>{label}: {enabled ? "enabled" : "disabled"}</span>)}</div>
        {mind.policy.warnings.length ? <p className="readable-note">{mind.policy.warnings.join(" · ")}</p> : null}
      </SectionPanel>
      <SectionPanel title="Message Understanding" defaultOpen>
        <p className="readable-note">{understanding.intentSummary}</p>
        <div className="tag-row">{understanding.topicTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        {displayMode !== "basic" ? <div className="mind-plan-grid"><MetricCard label="confidence" value={understanding.confidence.toFixed(2)} /><MetricCard label="tone" value={understanding.emotionalTone} /><MetricCard label="relationship" value={understanding.relationshipRelevance} /><MetricCard label="memory signal" value={understanding.memorySignalType} /></div> : null}
        <ExplanationList items={understanding.reasons.slice(0, displayMode === "basic" ? 3 : 8)} />
      </SectionPanel>
      <SectionPanel title="Owner State" defaultOpen>
        <OwnerStateView ownerState={ownerState} trend={analytics?.ownerStateTrend} displayMode={displayMode} />
      </SectionPanel>
      <SectionPanel title="Response Plan" defaultOpen={displayMode !== "basic"}>
        <ResponsePlanView responsePlan={responsePlan} ownerState={ownerState} selectedMemoryCount={retrieval.selected.length} displayMode={displayMode} />
      </SectionPanel>
      <SectionPanel title="Memory Visualization" defaultOpen>
        <MemoryAnalyticsView analytics={memoryAnalytics} candidates={candidates} selectedCandidate={selectedCandidate} setSelectedCandidateId={setSelectedCandidateId} displayMode={displayMode} />
      </SectionPanel>
      {displayMode !== "basic" ? <SectionPanel title="Context Plan Explainability" defaultOpen><ContextPlanView analytics={contextAnalytics} fallbackPlan={contextPlan} displayMode={displayMode} /></SectionPanel> : null}
      {displayMode !== "basic" ? <SectionPanel title="Memory Retrieval" defaultOpen>
        <div className="mind-list">{retrieval.selected.length ? retrieval.selected.map((item) => <article key={`${item.sourceKind}:${item.sourceId}`} className="mind-row"><strong>{item.sourceKind}</strong><span>score {item.score}</span><p>{item.safeSummary}</p>{item.normalizedValue ? <small>{item.normalizedValue}</small> : null}<small>{item.reasons.join(", ") || "selected"}</small></article>) : <p className="empty-state">No relevant memory selected.</p>}</div>
      </SectionPanel> : null}
      <SectionPanel title="Memory Editor" defaultOpen={displayMode !== "basic"}>
        <div className="mind-filter-row">
          <label>search<input value={candidateSearch} onChange={(e) => setCandidateSearch(e.target.value)} placeholder="safe summary / value / tag" /></label>
          <label>type<select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="all">all</option>{typeOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
          <label>status<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">all</option><option value="candidate">candidate</option><option value="review_required">review_required</option><option value="auto_promoted">auto_promoted</option><option value="owner_approved">owner_approved</option><option value="rejected">rejected</option><option value="inactive">inactive</option></select></label>
          <label>risk<select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}><option value="all">all</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="blocked">blocked</option></select></label>
          <label>active<select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}><option value="all">all</option><option value="active">active</option><option value="inactive">inactive</option></select></label>
        </div>
        <div className="mind-list">{filteredCandidates.length ? filteredCandidates.map((candidate) => <MemoryCandidateRow key={candidate.id} candidate={candidate} analytics={analyticsById.get(candidate.id)} reviewMindCandidate={reviewMindCandidate} editMindCandidate={editMindCandidate} setSelectedCandidateId={setSelectedCandidateId} displayMode={displayMode} />) : <p className="empty-state">No memory candidates match filters.</p>}</div>
      </SectionPanel>
      <SectionPanel title="Conversation Summary">
        {latest.conversationSummary ? <div className="mind-list"><article className="mind-row"><strong>{latest.conversationSummary.activeMode}</strong><p>{latest.conversationSummary.topicTags.join(", ") || "No topic tags."}</p><small>modelGenerated={String(latest.conversationSummary.modelGenerated)} rawTextIncluded=false</small></article></div> : <p className="empty-state">No deterministic summary yet.</p>}
        <JsonInspector value={latest.conversationSummary} visible={displayMode === "developer"} stringify={safeDisplayJson} />
      </SectionPanel>
      <SectionPanel title="Self Growth"><div className="mind-list">{mind.growthEvents.length ? mind.growthEvents.map((event) => <article key={event.id} className={`mind-row ${event.riskLevel}`}><strong>{event.eventType}</strong><ReviewStatusBadge value={event.reviewStatus} /><p>{event.summary}</p><small>safe summary only · rawTextIncluded=false</small></article>) : <p className="empty-state">No self-growth candidates.</p>}</div></SectionPanel>
      <SectionPanel title="Tool Proposals"><div className="mind-list">{mind.toolInvocationRequests.length ? mind.toolInvocationRequests.map((request) => <article key={request.id} className={`mind-row ${request.riskLevel}`}><strong>{request.toolName}</strong><StatusBadge value={request.status} /><p>{request.actionSummary}</p><small>execution disabled by default · requiresOwnerApproval={String(request.requiresOwnerApproval)}</small></article>) : <p className="empty-state">Tool execution disabled; no proposals.</p>}</div></SectionPanel>
      <SectionPanel title="Lifecycle"><Timeline events={latest.lifecycle.stages.map((stage, i) => ({ id: `${stage}-${i}`, type: stage, label: "complete", at: latest.createdAt, status: "ok" }))} /><JsonInspector value={{ lifecycle: latest.lifecycle, embeddings: mind.embeddingStatus }} visible={displayMode === "developer"} stringify={safeDisplayJson} /></SectionPanel>
      <JsonInspector value={{ latest, memoryAnalytics, contextAnalytics }} visible={displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
});

// --- MindWindow sub-components ---

const OwnerStateView = memo(function OwnerStateView({ ownerState, trend, displayMode }: { ownerState: MindOwnerState; trend?: MindOwnerStateTrend; displayMode: DisplayMode }) {
  const rows: Array<[string, string]> = [["energy", ownerState.energyLevel], ["mood", ownerState.moodValence], ["arousal", ownerState.arousalLevel], ["focus", ownerState.focusState], ["motivation", ownerState.motivationState], ["immersion", ownerState.immersionInertia], ["interrupt", ownerState.interruptionRisk], ["urgency", ownerState.resultUrgency]];
  return (
    <div className="owner-state-view">
      <div className="state-bar-grid">{rows.map(([label, value]) => <article key={label}><header><span>{label}</span><strong>{value}</strong></header><MiniBar value={levelValue(value)} /></article>)}</div>
      <div className="mind-plan-grid"><MetricCard label="support" value={ownerState.supportNeed} /><MetricCard label="confidence" value={ownerState.confidence.toFixed(2)} /><MetricCard label="ttl" value={`${ownerState.ttlHours}h`} /><MetricCard label="expires" value={shortLabel(ownerState.expiresAt)} /></div>
      {displayMode !== "basic" && trend?.points.length ? <ChartCard title="Recent Owner State Trend" note={trend.explanation}><DataTable columns={[{ key: "createdAt", label: "time" }, { key: "moodValence", label: "mood" }, { key: "focusState", label: "focus" }, { key: "supportNeed", label: "support" }, { key: "confidence", label: "conf" }]} rows={trend.points.slice(-8).map((point) => ({ createdAt: shortLabel(String(point.createdAt ?? "")), moodValence: String(point.moodValence ?? "n/a"), focusState: String(point.focusState ?? "n/a"), supportNeed: String(point.supportNeed ?? "n/a"), confidence: String(point.confidence ?? "n/a") }))} /></ChartCard> : null}
    </div>
  );
});

const ResponsePlanView = memo(function ResponsePlanView({ responsePlan, ownerState, selectedMemoryCount, displayMode }: { responsePlan: MindResponsePlan; ownerState: MindOwnerState; selectedMemoryCount: number; displayMode: DisplayMode }) {
  const explanations = [
    responsePlan.provideComfort || ownerState.moodValence === "negative" ? "RIN uses a warmer or more supportive tone because owner state indicates comfort may help." : "RIN keeps the tone direct because owner state does not require comfort-first handling.",
    responsePlan.provideStructure ? "RIN provides structure because the response plan requests organized next steps." : "RIN avoids extra structure because the current plan is conversational.",
    responsePlan.referenceMemory && selectedMemoryCount ? "RIN may reference memory because safe approved memory was selected for this turn." : "RIN will not force memory references when no safe selected memory is needed.",
  ];
  return (
    <div className="response-plan-view">
      <div className="mind-plan-grid"><MetricCard label="tone" value={responsePlan.tone} /><MetricCard label="length" value={responsePlan.length} /><MetricCard label="directness" value={responsePlan.directness} /><MetricCard label="warmth" value={responsePlan.warmth} /><MetricCard label="initiative" value={responsePlan.initiativeLevel} /><MetricCard label="next action" value={responsePlan.nextActionStyle} /></div>
      <div className="tag-row"><span>comfort={String(responsePlan.provideComfort)}</span><span>structure={String(responsePlan.provideStructure)}</span><span>referenceMemory={String(responsePlan.referenceMemory)}</span><span>avoidOverexplaining={String(responsePlan.avoidOverexplaining)}</span></div>
      <ExplanationList items={displayMode === "basic" ? explanations.slice(0, 2) : [...explanations, ...responsePlan.reasons]} />
      <JsonInspector value={responsePlan} visible={displayMode === "developer"} stringify={safeDisplayJson} />
    </div>
  );
});

const MemoryAnalyticsView = memo(function MemoryAnalyticsView({ analytics, candidates, selectedCandidate, setSelectedCandidateId, displayMode }: { analytics?: MindMemoryAnalytics; candidates: MindMemoryCandidate[]; selectedCandidate?: MemoryCandidateAnalytics; setSelectedCandidateId: (id: string) => void; displayMode: DisplayMode }) {
  const counts = analytics?.counts;
  if (!analytics) return <EmptyState message="Memory analytics not available yet." />;
  const reviewSegments = recordDistributionSegments(counts?.byReviewStatus ?? {});
  const riskSegments = recordDistributionSegments(counts?.byRiskLevel ?? {});
  return (
    <div className="memory-analytics-view">
      <div className="mind-plan-grid"><MetricCard label="total" value={counts?.total ?? candidates.length} /><MetricCard label="active" value={counts?.active ?? 0} tone="ok" /><MetricCard label="inactive" value={counts?.inactive ?? 0} /><MetricCard label="pending" value={analytics.pendingReview.length} tone="warn" /><MetricCard label="near decay" value={analytics.nearDecayThreshold.length} tone="warn" /><MetricCard label="selected now" value={analytics.selectedInCurrentContextIds.length} /></div>
      <ChartCard title="Review Status Distribution"><StackedBar segments={reviewSegments} /></ChartCard>
      <ChartCard title="Risk Distribution"><StackedBar segments={riskSegments} /></ChartCard>
      {displayMode !== "basic" ? <ChartCard title="Memory Strength Ranking" note={analytics.formula}><div className="strength-ranking">{analytics.strongest.length ? analytics.strongest.map((item) => <button key={item.candidateId} type="button" onClick={() => setSelectedCandidateId(item.candidateId)}><span>{item.shortId}</span><strong>{item.type}</strong><MiniBar value={item.memoryStrength} /><small>{item.safeSummary}</small></button>) : <EmptyState message="No memory candidates yet." />}</div></ChartCard> : null}
      {selectedCandidate && displayMode !== "basic" ? <MemoryCandidateDetail analytics={selectedCandidate} displayMode={displayMode} /> : null}
    </div>
  );
});

const MemoryCandidateDetail = memo(function MemoryCandidateDetail({ analytics, displayMode }: { analytics: MemoryCandidateAnalytics; displayMode: DisplayMode }) {
  return (
    <ChartCard title="Selected Memory Detail" note={analytics.explanation}>
      <div className="mind-plan-grid"><MetricCard label="strength" value={analytics.memoryStrength} /><MetricCard label="risk" value={<RiskBadge value={analytics.riskLevel} />} /><MetricCard label="review" value={<ReviewStatusBadge value={analytics.reviewStatus} />} /><MetricCard label="decay" value={analytics.decayPolicy} /></div>
      <p className="readable-note">{analytics.safeSummary}</p>
      {analytics.normalizedValue ? <p className="readable-note">{analytics.normalizedValue}</p> : null}
      <ForgettingCurve analytics={analytics} />
      <Timeline events={analytics.eventMarkers.map((e) => ({ type: e.type, label: e.label, at: e.at }))} />
      <div className="mind-plan-grid"><MetricCard label="retrieval events" value={analytics.retrievalEvents.length} /><MetricCard label="context injections" value={analytics.contextInjectionEvents.length} /><MetricCard label="conflict" value={analytics.contradictionOf ?? "none"} /><MetricCard label="supersedes" value={analytics.supersedes ?? "none"} /></div>
      <JsonInspector value={analytics} visible={displayMode === "developer"} stringify={safeDisplayJson} />
    </ChartCard>
  );
});

function ForgettingCurve({ analytics }: { analytics: MemoryCandidateAnalytics }) {
  const width = 520; const height = 160; const padding = 24;
  const points = analytics.predictedDecayPoints;
  if (!points.length) return <EmptyState message="Not enough history for a forgetting curve." />;
  const maxHours = Math.max(1, ...points.map((p) => p.elapsedHours));
  const path = points.map((point, i) => { const x = padding + (point.elapsedHours / maxHours) * (width - padding * 2); const y = height - padding - point.memoryStrength * (height - padding * 2); return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ");
  const weakeningY = height - padding - analytics.thresholds.weakening * (height - padding * 2);
  const forgettingY = height - padding - analytics.thresholds.forgetting * (height - padding * 2);
  return (
    <svg className="forgetting-curve" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Memory forgetting curve">
      <line x1={padding} y1={weakeningY} x2={width - padding} y2={weakeningY} className="threshold weakening" />
      <line x1={padding} y1={forgettingY} x2={width - padding} y2={forgettingY} className="threshold forgetting" />
      <path d={path} />
      {points.map((point) => { const x = padding + (point.elapsedHours / maxHours) * (width - padding * 2); const y = height - padding - point.memoryStrength * (height - padding * 2); return <circle key={point.at} cx={x} cy={y} r="4"><title>{`${point.at} · ${point.memoryStrength}`}</title></circle>; })}
      <text x={padding} y={16}>memory strength</text>
      <text x={width - padding - 86} y={height - 7}>time</text>
    </svg>
  );
}

const ContextPlanView = memo(function ContextPlanView({ analytics, fallbackPlan, displayMode }: { analytics?: MindContextAnalytics; fallbackPlan: MindContextPlan; displayMode: DisplayMode }) {
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

const MemoryCandidateRow = memo(function MemoryCandidateRow({ candidate, analytics, reviewMindCandidate, editMindCandidate, setSelectedCandidateId, displayMode }: { candidate: MindMemoryCandidate; analytics?: MemoryCandidateAnalytics; reviewMindCandidate: (candidateId: string, action: "approve" | "reject" | "deactivate" | "reactivate") => Promise<void>; editMindCandidate: (candidateId: string, patch: MindCandidateSafePatch) => Promise<void>; setSelectedCandidateId: (id: string) => void; displayMode: DisplayMode }) {
  const [safeSummary, setSafeSummary] = useState(candidate.safeSummary);
  const [normalizedValue, setNormalizedValue] = useState(candidate.normalizedValue ?? "");
  const [tagsText, setTagsText] = useState(candidate.tags.join(", "));
  const actionable = ["candidate", "review_required"].includes(candidate.reviewStatus) && candidate.riskLevel !== "blocked";
  const canDeactivate = candidate.active && candidate.riskLevel !== "blocked";
  const canReactivate = !candidate.active && candidate.riskLevel !== "blocked";
  const canSafeEdit = candidate.riskLevel !== "blocked" && ["low", "medium"].includes(candidate.riskLevel) && displayMode !== "basic";
  return (
    <article className={`mind-candidate ${candidate.riskLevel}`}>
      <header><button type="button" className="link-button" onClick={() => setSelectedCandidateId(candidate.id)}>{candidate.type}</button><ReviewStatusBadge value={candidate.reviewStatus} /></header>
      <p>{candidate.safeSummary}</p>
      {candidate.normalizedValue ? <p className="readable-note">{candidate.normalizedValue}</p> : null}
      <dl className="detail-list compact"><div><dt>risk</dt><dd><RiskBadge value={candidate.riskLevel} /></dd></div><div><dt>confidence</dt><dd>{candidate.confidence}</dd></div><div><dt>salience</dt><dd>{candidate.salience}</dd></div><div><dt>strength</dt><dd>{analytics?.memoryStrength ?? "n/a"}</dd></div><div><dt>auto</dt><dd>{candidate.autoPromote ? "yes" : "no"}</dd></div><div><dt>active</dt><dd>{candidate.active ? "yes" : "no"}</dd></div><div><dt>redacted</dt><dd>{candidate.redacted ? "yes" : "no"}</dd></div></dl>
      {analytics ? <MiniBar value={analytics.memoryStrength} /> : null}
      <div className="tag-row">{candidate.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
      {canSafeEdit ? <div className="candidate-editor"><label>safeSummary<textarea value={safeSummary} onChange={(e) => setSafeSummary(e.target.value)} /></label><label>normalizedValue<textarea value={normalizedValue} onChange={(e) => setNormalizedValue(e.target.value)} /></label><label>tags<input value={tagsText} onChange={(e) => setTagsText(e.target.value)} /></label><button type="button" onClick={() => void editMindCandidate(candidate.id, { safeSummary, normalizedValue: normalizedValue.trim() ? normalizedValue : null, tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean) })}>SAVE SAFE EDIT</button></div> : null}
      {actionable ? <div className="mind-actions"><button type="button" onClick={() => void reviewMindCandidate(candidate.id, "approve")}>APPROVE</button><button type="button" onClick={() => void reviewMindCandidate(candidate.id, "reject")}>REJECT</button></div> : null}
      {canDeactivate ? <div className="mind-actions"><button type="button" onClick={() => void reviewMindCandidate(candidate.id, "deactivate")}>DEACTIVATE</button></div> : null}
      {canReactivate ? <div className="mind-actions"><button type="button" onClick={() => void reviewMindCandidate(candidate.id, "reactivate")}>REACTIVATE</button></div> : null}
      <JsonInspector value={{ candidate, analytics }} visible={displayMode === "developer"} stringify={safeDisplayJson} />
    </article>
  );
});
