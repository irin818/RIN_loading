import { memo } from "react";
import { safeDisplayJson } from "../utils";
import type { GlitchErrorItem, RuntimeTrace, WindowPayload, WindowType } from "../types";

export const ErrorWindow = memo(function ErrorWindow({
  error,
  trace,
  openWindow,
  onDismiss,
}: {
  error?: GlitchErrorItem;
  trace: RuntimeTrace | null;
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload }) => void;
  onDismiss: () => void;
}) {
  if (!error) return <p className="empty-state">No error selected.</p>;
  const repeatNote = error.repeatCount && error.repeatCount > 1 ? ` (repeated ${error.repeatCount}×)` : "";
  return (
    <div className={`error-module ${error.severity}`}>
      <div className="module-strip">ERROR · {error.severity}{repeatNote}</div>
      <dl className="detail-list">
        <div><dt>code</dt><dd>{error.code}</dd></div>
        <div><dt>severity</dt><dd>{error.severity}</dd></div>
        <div><dt>module</dt><dd>{error.module}</dd></div>
        <div><dt>last step</dt><dd>{error.lastStep}</dd></div>
      </dl>
      <p>{error.message}</p>
      <div className="error-actions">
        <button type="button" disabled={!error.traceAvailable || !trace} onClick={() => openWindow("trace", { contextName: "Error Trace" })}>
          OPEN TRACE
        </button>
        <button type="button" onClick={() => void navigator.clipboard?.writeText(safeDisplayJson(error))}>
          COPY ERROR
        </button>
        <button type="button" onClick={onDismiss}>DISMISS</button>
      </div>
    </div>
  );
});
