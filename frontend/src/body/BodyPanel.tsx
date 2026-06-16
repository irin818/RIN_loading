import { useEffect, useState } from "react";
import { bodyImageUrl, loadBodyManifest, type SimpleBodyManifest } from "./bodyApi";
import { BODY_STATES, type BodyState, normalizeBodyState } from "./bodyState";
import "./body.css";

export interface BodyPanelProps {
  currentState: BodyState | null | undefined;
  forcedState?: BodyState | null;
  compact?: boolean;
  floating?: boolean;
  showControls?: boolean;
}

export function BodyPanel({
  currentState,
  forcedState,
  compact = false,
  floating = false,
  showControls = true,
}: BodyPanelProps) {
  const [manifest, setManifest] = useState<SimpleBodyManifest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BodyState | null>(null);

  const state: BodyState = forcedState ?? preview ?? normalizeBodyState(currentState);
  const label = manifest?.states[state]?.label ?? state;

  useEffect(() => {
    const ctrl = new AbortController();
    loadBodyManifest(ctrl.signal)
      .then(setManifest)
      .catch((e) => {
        if (!ctrl.signal.aborted) setLoadError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => ctrl.abort();
  }, []);

  const imgSrc = manifest ? bodyImageUrl(manifest, state) : null;

  return (
    <section className={`rin-body ${compact ? "compact" : ""} ${floating ? "floating" : ""}`}>
      <div className="rin-body-stage">
        {loadError ? (
          <p className="rin-body-fallback">{loadError}</p>
        ) : imgSrc ? (
          <img
            className="rin-body-image"
            src={imgSrc}
            alt={`RIN ${label}`}
            draggable={false}
          />
        ) : (
          <p className="rin-body-fallback">Loading…</p>
        )}
      </div>

      {showControls ? (
        <div className="rin-body-controls">
          <div className="rin-body-buttons">
            {BODY_STATES.map((s) => (
              <button
                key={s}
                type="button"
                className={state === s ? "active" : ""}
                onClick={() => setPreview(s)}
              >
                {s}
              </button>
            ))}
          </div>
          {preview ? (
            <button type="button" className="rin-body-reset" onClick={() => setPreview(null)}>
              follow runtime
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="rin-body-label">{label}</p>
    </section>
  );
}
