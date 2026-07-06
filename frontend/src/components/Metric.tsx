import { memo } from "react";

export const Metric = memo(function Metric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <article className="hud-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
});
