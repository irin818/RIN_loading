import { memo, useCallback, useRef } from "react";
import { Metric } from "../components/Metric";
import { normalizeBodyState } from "../body/bodyState";
import type { GlitchSnapshot } from "../types";

export const CoreStatus = memo(function CoreStatus({
  snapshot,
}: {
  snapshot: GlitchSnapshot | null;
}) {
  const health = snapshot?.dashboard.health ?? {};
  const bodyState = normalizeBodyState(snapshot?.body?.currentState);
  const bodyStateLabel =
    bodyState === "生气" ? "alert"
    : bodyState === "惊讶" ? "signal"
    : bodyState === "难受" ? "low"
    : "default";
  return (
    <div className="core-status">
      <div className="module-strip">RIN CORE PRESENCE</div>
      <div className="core-status-grid">
        <Metric label="Core" value={snapshot?.core.status ?? "booting"} />
        <Metric label="Mode" value={snapshot?.core.mode ?? "local-first"} />
        <Metric label="Schema" value={snapshot?.dashboard.database.schemaVersion ?? "n/a"} />
        <Metric label="Memory" value={snapshot?.dashboard.memoryContext.memoryV2Traces ?? 0} />
        <Metric label="Body" value={bodyStateLabel} />
      </div>
      <div className="health-matrix">
        {Object.entries(health).map(([key, value]) => (
          <span key={key} className={`health-pill ${value}`}>
            {key}: {value}
          </span>
        ))}
      </div>
      <p className="readable-note">
        Local-first runtime shell. Provider calls stay behind FastAPI adapters.
      </p>
    </div>
  );
});
