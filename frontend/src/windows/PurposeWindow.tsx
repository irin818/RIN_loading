import { memo } from "react";
import {
  EmptyState,
  MetricCard,
  MiniBar,
  SectionPanel,
  StatusBadge,
} from "../visualization";
import type { PurposeCompassDimension, PurposeCompassPayload } from "../types";

export const PurposeWindow = memo(function PurposeWindow({
  compass,
}: {
  compass: PurposeCompassPayload | null;
}) {
  if (!compass) return <EmptyState message="Purpose compass loading." />;

  return (
    <div className="purpose-module">
      <div className="module-strip">PURPOSE COMPASS · LOCAL GOVERNANCE</div>
      <p className="purpose-statement">{compass.finalPurpose}</p>
      <div className="control-grid">
        <MetricCard label="maturity" value={`${compass.overall.score}%`} tone={toneForScore(compass.overall.score)} />
        <MetricCard label="status" value={<StatusBadge value={compass.overall.status} />} />
        <MetricCard label="dimensions" value={compass.overall.dimensionCount} />
        <MetricCard label="read only" value={<StatusBadge value={compass.readOnly} />} tone={compass.readOnly ? "ok" : "danger"} />
        <MetricCard label="local only" value={<StatusBadge value={compass.localOnly} />} tone={compass.localOnly ? "ok" : "danger"} />
        <MetricCard label="secrets" value={compass.secretValuesIncluded ? "included" : "excluded"} tone={compass.secretValuesIncluded ? "danger" : "ok"} />
      </div>

      <SectionPanel title="Operating Direction" defaultOpen>
        <p className="readable-note">{compass.operatingDirection}</p>
        <div className="tag-row">
          {compass.guardrails.map((guardrail) => (
            <span key={guardrail.id}>{guardrail.label}</span>
          ))}
        </div>
      </SectionPanel>

      <SectionPanel title="Capability Dimensions" defaultOpen>
        <div className="purpose-dimension-list">
          {compass.dimensions.map((dimension) => (
            <PurposeDimensionCard key={dimension.id} dimension={dimension} />
          ))}
        </div>
      </SectionPanel>

      <SectionPanel title="Recommended Development Slices" defaultOpen>
        <div className="governance-list">
          {compass.recommendedSlices.map((item) => (
            <article key={item.id} className="governance-row medium">
              <header>
                <strong>{item.title}</strong>
                <StatusBadge value={item.requiresOwnerApproval ? "owner_review" : "ready"} />
              </header>
              <p>{item.summary}</p>
              <small>{item.dimension} · {item.guardrail}</small>
            </article>
          ))}
        </div>
      </SectionPanel>

      <SectionPanel title="Inactive Scopes">
        <div className="tag-row">
          {compass.inactiveScopes.map((scope) => <span key={scope}>{scope}</span>)}
        </div>
      </SectionPanel>
    </div>
  );
});

const PurposeDimensionCard = memo(function PurposeDimensionCard({
  dimension,
}: {
  dimension: PurposeCompassDimension;
}) {
  return (
    <article className={`purpose-dimension ${toneForScore(dimension.score)}`}>
      <header>
        <div>
          <strong>{dimension.label}</strong>
          <small>{dimension.status}</small>
        </div>
        <b>{dimension.score}%</b>
      </header>
      <MiniBar value={dimension.score} max={100} label={dimension.label} />
      <p>{dimension.purpose}</p>
      <div className="purpose-signal-grid">
        {dimension.signals.map((signal) => (
          <span key={`${dimension.id}-${signal.label}`}>
            <em>{signal.label}</em>
            <b>{String(signal.value)}</b>
          </span>
        ))}
      </div>
      <ul className="purpose-evidence-list">
        {dimension.evidence.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <small>{dimension.nextStep}</small>
    </article>
  );
});

function toneForScore(score: number): "ok" | "warn" | "danger" | "neutral" {
  if (score >= 70) return "ok";
  if (score >= 45) return "warn";
  return "danger";
}
