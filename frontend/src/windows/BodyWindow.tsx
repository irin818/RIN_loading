import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { bodyImageUrl, loadBodyManifest, type SimpleBodyManifest } from "../body/bodyApi";
import { BODY_STATES, normalizeBodyState, type BodyState } from "../body/bodyState";
import { applyBodyViewToDocument, loadBodyView, saveBodyView, type BodyViewSettings } from "../body/bodyView";
import type { GlitchSnapshot } from "../types";
import "../body/body.css";

function clamp(val: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

export const BodyWindow = memo(function BodyWindow({
  snapshot,
}: {
  snapshot: GlitchSnapshot | null;
}) {
  const currentState = normalizeBodyState(snapshot?.body?.currentState);
  const [manifest, setManifest] = useState<SimpleBodyManifest | null>(null);
  const [previewState, setPreviewState] = useState<BodyState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [bodyView, setBodyView] = useState<BodyViewSettings>(loadBodyView);
  const viewRef = useRef(bodyView);
  viewRef.current = bodyView;
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; viewX: number; viewY: number; moved: boolean } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const state: BodyState = previewState ?? currentState;
  const stateLabel = manifest?.states[state]?.label ?? state;
  const imgSrc = manifest ? bodyImageUrl(manifest, state) : null;

  // Apply view to document root (affects desktop floating window)
  useEffect(() => {
    applyBodyViewToDocument(bodyView);
  }, [bodyView]);

  // Load manifest
  useEffect(() => {
    const ctrl = new AbortController();
    loadBodyManifest(ctrl.signal)
      .then(setManifest)
      .catch((e) => { if (!ctrl.signal.aborted) setLoadError(e instanceof Error ? e.message : "Failed to load"); });
    return () => ctrl.abort();
  }, []);

  // ── Edit mode handlers (mirrors Gallery / CoreBackground pattern) ──

  const updateView = useCallback((patch: Partial<BodyViewSettings>) => {
    setBodyView((prev) => ({ ...prev, ...patch }));
  }, []);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveBodyView(viewRef.current);
    }, 400);
  }, []);

  const commitNow = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    saveBodyView(viewRef.current);
  }, []);

  // Save on edit mode exit
  const prevEditMode = useRef(editMode);
  useEffect(() => {
    if (prevEditMode.current && !editMode) {
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
      saveBodyView(viewRef.current);
    }
    prevEditMode.current = editMode;
  }, [editMode]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!editMode || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewX: viewRef.current.x, viewY: viewRef.current.anchorY, moved: false };
  }, [editMode]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    updateView({ x: clamp(drag.viewX + dx, -200, 200, 0), anchorY: clamp(drag.viewY - dy, 0, 100, 35) });
  }, [updateView]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      dragRef.current = null;
      if (drag.moved) commitNow();
    }
  }, [commitNow]);

  const handleWheel = useCallback((event: ReactWheelEvent<HTMLElement>) => {
    if (!editMode) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.05 : -0.05;
    const newScale = clamp(viewRef.current.scale + delta, 0.3, 3.0, 1);
    updateView({ scale: newScale });
    scheduleSave();
  }, [editMode, scheduleSave, updateView]);

  const resetView = useCallback(() => {
    const def: BodyViewSettings = { scale: 1, x: 0, y: 0, anchorY: 35 };
    setBodyView(def);
    saveBodyView(def);
    applyBodyViewToDocument(def);
  }, []);

  return (
    <div className="body-module">
      {/* ── Header ── */}
      <div className="body-module-header">
        <div>
          <strong>LAYERED AVATAR</strong>
          <small>runtime: {currentState}{previewState ? ` · preview: ${previewState}` : ""}</small>
        </div>
        <span className={`body-runtime-dot${snapshot?.body?.currentState ? " live" : ""}`}>
          {snapshot?.body?.currentState ? "LIVE" : "WAIT"}
        </span>
      </div>

      {/* ── Body preview (editable in edit mode) ── */}
      <div
        className={`body-preview${editMode ? " editing" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        {loadError ? (
          <p className="body-preview-error">{loadError}</p>
        ) : imgSrc ? (
          <img
            src={imgSrc}
            alt={`Body: ${stateLabel}`}
            draggable={false}
            style={{
              objectPosition: `center ${bodyView.anchorY}%`,
              transform: `translate(${bodyView.x}px, ${bodyView.y}px) scale(${bodyView.scale})`,
              cursor: editMode ? "grab" : undefined,
            }}
          />
        ) : (
          <p className="body-preview-error">Loading…</p>
        )}
        <div className="body-preview-badge">{stateLabel}</div>
        {editMode && (
          <div className="body-preview-overlay">
            <span>DRAG TO POSITION · SCROLL TO SCALE</span>
          </div>
        )}
      </div>

      {/* ── View edit controls ── */}
      <div className="body-edit-bar">
        <button
          type="button"
          className={`body-edit-toggle${editMode ? " active" : ""}`}
          onClick={() => setEditMode((v) => !v)}
        >
          {editMode ? "LOCK VIEW" : "EDIT VIEW"}
        </button>
        <button type="button" className="body-edit-reset" onClick={resetView}>
          RESET
        </button>
        {editMode && (
          <span className="body-edit-info">
            scale: {bodyView.scale.toFixed(2)} · x: {bodyView.x} · anchor: {bodyView.anchorY}%
          </span>
        )}
      </div>

      {/* ── State selector ── */}
      <div className="body-state-selector">
        <span>STATE</span>
        <div className="body-state-options">
          {BODY_STATES.map((s) => {
            const label = manifest?.states[s]?.label ?? s;
            return (
              <button
                key={s}
                type="button"
                className={state === s ? "active" : ""}
                onClick={() => setPreviewState(s)}
              >{label}</button>
            );
          })}
        </div>
        {previewState && (
          <button type="button" className="body-state-auto" onClick={() => setPreviewState(null)}>
            follow runtime
          </button>
        )}
      </div>

      {/* ── Desktop launchers ── */}
      <div className="body-launchers">
        <a href="/body" target="_blank" rel="noreferrer" className="body-launch-btn">
          OPEN BODY WINDOW
        </a>
        <a href="/body/floating" target="_blank" rel="noreferrer" className="body-launch-btn primary">
          DESKTOP FLOATING
        </a>
      </div>

      {/* ── Footer info ── */}
      <div className="body-module-footer">
        <small>Cmd+C chat · Cmd+B toggle background · Esc close</small>
      </div>
    </div>
  );
});
