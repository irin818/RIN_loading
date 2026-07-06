import { useEffect, useMemo, useState } from "react";
import {
  loadBodyManifest,
  loadBodyStates,
  resolveBodyImageUrl,
  type BodyStateEntry,
  type SimpleBodyManifest,
} from "./bodyApi";
import { BODY_STATES, normalizeBodyState, type BodyState } from "./bodyState";
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
  const [stateEntries, setStateEntries] = useState<BodyStateEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BodyState | null>(null);

  const state: BodyState = forcedState ?? preview ?? normalizeBodyState(currentState);

  const availableStateIds = useMemo(
    () => stateEntries.length > 0 ? stateEntries.map((entry) => entry.stateId) : [...BODY_STATES],
    [stateEntries],
  );
  const hasStateImage = Boolean(
    stateEntries.some((entry) => entry.stateId === state) || manifest?.states[state],
  );
  const label = (
    stateEntries.find((entry) => entry.stateId === state)?.label
    ?? manifest?.states[state]?.label
    ?? state
  );
  const imgSrc = resolveBodyImageUrl(state, manifest, stateEntries);

  useEffect(() => {
    const ctrl = new AbortController();
    loadBodyManifest(ctrl.signal)
      .then(setManifest)
      .catch((e) => {
        if (!ctrl.signal.aborted) setLoadError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    loadBodyStates(ctrl.signal)
      .then(setStateEntries)
      .catch(() => { /* non-critical */ });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (hasStateImage || !state) return;
    const ctrl = new AbortController();
    loadBodyStates(ctrl.signal)
      .then(setStateEntries)
      .catch(() => { /* backend may be restarting */ });
    return () => ctrl.abort();
  }, [hasStateImage, state]);

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
            {availableStateIds.map((s) => (
              <button
                key={s}
                type="button"
                className={state === s ? "active" : ""}
                onClick={() => setPreview(s)}
              >
                {stateEntries.find((e) => e.stateId === s)?.label ?? manifest?.states[s]?.label ?? s}
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
