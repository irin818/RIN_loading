import type { ReactNode } from "react";

export type DisplayMode = "basic" | "advanced" | "developer";
export type DisplaySize = "small" | "normal" | "large" | "xl";
export type Density = "compact" | "normal" | "detailed";

export function MetricCard(props: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "ok" | "warn" | "danger" | "neutral";
}) {
  return (
    <article className={`viz-metric ${props.tone ?? "neutral"}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.note ? <small>{props.note}</small> : null}
    </article>
  );
}

export function StatusBadge({ value }: { value: string | boolean }) {
  const label = typeof value === "boolean" ? (value ? "on" : "off") : value;
  const tone = ["ok", "active", "success", "owner_approved", "auto_promoted", "true"].includes(
    label.toLowerCase(),
  )
    ? "ok"
    : ["warning", "review_required", "candidate", "medium"].includes(label.toLowerCase())
      ? "warn"
      : ["error", "failed", "blocked", "rejected", "false", "high"].includes(label.toLowerCase())
        ? "danger"
        : "neutral";
  return <span className={`viz-badge ${tone}`}>{label}</span>;
}

export function RiskBadge({ value }: { value: string }) {
  return <span className={`viz-badge risk-${value}`}>{value}</span>;
}

export function ReviewStatusBadge({ value }: { value: string }) {
  return <span className={`viz-badge review-${value}`}>{value}</span>;
}

export function MiniBar(props: { value: number; max?: number; label?: string }) {
  const max = props.max ?? 1;
  const percent = Math.max(0, Math.min(100, (props.value / Math.max(0.0001, max)) * 100));
  return (
    <div className="mini-bar" title={props.label}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

export function StackedBar(props: {
  segments: Array<{ label: string; value: number; tone?: string }>;
}) {
  const total = props.segments.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1;
  return (
    <div className="stacked-bar">
      {props.segments.map((item) => (
        <span
          key={item.label}
          className={item.tone ?? ""}
          style={{ width: `${(Math.max(0, item.value) / total) * 100}%` }}
          title={`${item.label}: ${item.value}`}
        />
      ))}
    </div>
  );
}

export function Timeline(props: {
  events: Array<{ id?: string; type: string; label?: string; at?: string | null; status?: string }>;
}) {
  if (!props.events.length) {
    return <EmptyState message="No timeline events available." />;
  }
  return (
    <ol className="viz-timeline">
      {props.events.map((event, index) => (
        <li key={event.id ?? `${event.type}-${index}`} className={event.status ?? event.type}>
          <span>{event.type}</span>
          <strong>{event.label ?? event.type}</strong>
          <small>{event.at ?? "n/a"}</small>
        </li>
      ))}
    </ol>
  );
}

export function DataTable<T extends Record<string, ReactNode>>(props: {
  columns: Array<{ key: keyof T; label: string }>;
  rows: T[];
  empty?: string;
}) {
  if (!props.rows.length) {
    return <EmptyState message={props.empty ?? "No rows."} />;
  }
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {props.columns.map((column) => (
              <th key={String(column.key)}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, index) => (
            <tr key={index}>
              {props.columns.map((column) => (
                <td key={String(column.key)}>{row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExplanationList({ items }: { items: string[] }) {
  if (!items.length) {
    return <EmptyState message="No explanation available." />;
  }
  return (
    <ul className="explanation-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function JsonInspector(props: {
  value: unknown;
  visible: boolean;
  stringify: (value: unknown) => string;
}) {
  if (!props.visible) {
    return null;
  }
  return <pre className="safe-json">{props.stringify(props.value)}</pre>;
}

export function EmptyState({ message }: { message: string }) {
  return <p className="empty-state">{message}</p>;
}

export function ChartCard(props: { title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section className="chart-card">
      <header>
        <strong>{props.title}</strong>
        {props.note ? <small>{props.note}</small> : null}
      </header>
      {props.children}
    </section>
  );
}

export function SectionPanel(props: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="section-panel" open={props.defaultOpen}>
      <summary>{props.title}</summary>
      <div className="section-panel-body">{props.children}</div>
    </details>
  );
}

export function SegmentedControl<T extends string>(props: {
  label: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="segmented-control">
      <span>{props.label}</span>
      <div>
        {props.options.map((option) => (
          <button
            key={option}
            type="button"
            className={props.value === option ? "active" : ""}
            onClick={() => props.onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </label>
  );
}
