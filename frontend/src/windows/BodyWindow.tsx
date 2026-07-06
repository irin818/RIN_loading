import { memo, useCallback, useEffect, useRef, useState } from "react";
import type {
  ChangeEvent,
  Dispatch,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
  WheelEvent as ReactWheelEvent,
} from "react";
import {
  deleteBodyState,
  loadBodyManifest,
  loadBodyStates,
  resolveBodyImageUrl,
  setCurrentBodyState,
  uploadBodyState,
  type BodyStateEntry,
  type BodyStatesPayload,
  type SimpleBodyManifest,
} from "../body/bodyApi";
import { BODY_STATES, normalizeBodyState, type BodyState } from "../body/bodyState";
import {
  applyBodyViewToDocument,
  loadBodyView,
  saveBodyView,
  type BodyViewSettings,
} from "../body/bodyView";
import type { GlitchSnapshot } from "../types";
import type { RinCharacterAsset } from "../rinCharacters";
import "../body/body.css";

function clamp(val: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

function SliderControl({
  label, value, min, max, step = 1, unit = "", onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="body-config-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="body-config-val">{value}{unit}</span>
    </label>
  );
}

type BodyWindowProps = {
  snapshot: GlitchSnapshot | null;
  selectedCharacterId: string;
  selectedCharacter: RinCharacterAsset;
  characterAssets: RinCharacterAsset[];
  characterEditMode: boolean;
  setCharacterEditMode: Dispatch<SetStateAction<boolean>>;
  resetSelectedCharacterView: () => Promise<void>;
  addCharacterFiles: (files: FileList | null) => Promise<void>;
  deleteCharacter: (characterId: string) => Promise<void>;
  restoreDefaultCharacters: () => Promise<void>;
  galleryNotice: string;
  galleryBusy: boolean;
  selectCharacter: (characterId: string) => void;
  nextCharacter: () => void;
};

export const BodyWindow = memo(function BodyWindow({
  snapshot,
  selectedCharacterId,
  selectedCharacter,
  characterAssets,
  characterEditMode,
  setCharacterEditMode,
  resetSelectedCharacterView,
  addCharacterFiles,
  deleteCharacter,
  restoreDefaultCharacters,
  galleryNotice,
  galleryBusy,
  selectCharacter,
  nextCharacter,
}: BodyWindowProps) {
  const currentState = normalizeBodyState(snapshot?.body?.currentState);
  const [manifest, setManifest] = useState<SimpleBodyManifest | null>(null);
  const [previewState, setPreviewState] = useState<BodyState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bodyView, setBodyView] = useState<BodyViewSettings>(loadBodyView);
  const [synced, setSynced] = useState(false);

  const [stateEntries, setStateEntries] = useState<BodyStateEntry[]>([]);
  const [stateBusy, setStateBusy] = useState(false);
  const [stateNotice, setStateNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const characterFileInputRef = useRef<HTMLInputElement | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; viewX: number; viewY: number; moved: boolean } | null>(null);
  const viewRef = useRef(bodyView);
  viewRef.current = bodyView;

  const state: BodyState = previewState ?? currentState;
  const stateLabel = manifest?.states[state]?.label ?? stateEntries.find(e => e.stateId === state)?.label ?? state;
  const imgSrc = resolveBodyImageUrl(state, manifest, stateEntries);

  // ── Save view IMMEDIATELY (no debounce) and signal sync ──
  const saveViewNow = useCallback((view: BodyViewSettings) => {
    saveBodyView(view);
    applyBodyViewToDocument(view);
    // Signal desktop via localStorage (FloatingChat polls every 500ms)
    localStorage.setItem("rin-body-view", JSON.stringify(view));
    setSynced(true);
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => setSynced(false), 1200);
  }, []);

  // ── Load manifest + dynamic states ──
  useEffect(() => {
    const ctrl = new AbortController();
    loadBodyManifest(ctrl.signal).then(setManifest).catch((e) => {
      if (!ctrl.signal.aborted) setLoadError(e instanceof Error ? e.message : "Failed");
    });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    loadBodyStates(ctrl.signal)
      .then(setStateEntries)
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // Apply view on mount
  useEffect(() => { applyBodyViewToDocument(bodyView); }, []);

  // ── Upload ──
  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setStateBusy(true);
    setStateNotice("Uploading...");
    try {
      let latestPayload: BodyStatesPayload | null = null;
      const selectedStateIds: string[] = [];
      for (const file of Array.from(files)) {
        latestPayload = await uploadBodyState(file);
        if (latestPayload.selectedStateId) selectedStateIds.push(latestPayload.selectedStateId);
        setStateEntries(latestPayload.states);
      }
      const selectedStateId = selectedStateIds[0] ?? latestPayload?.selectedStateId;
      if (selectedStateId) {
        setPreviewState(selectedStateId);
        localStorage.setItem("rin-body-state", selectedStateId);
        await setCurrentBodyState(selectedStateId);
      }
      setStateNotice(`Uploaded to ${latestPayload?.storageScope ?? "local body store"}`);
    } catch (e) {
      setStateNotice(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setStateBusy(false);
      event.currentTarget.value = "";
      setTimeout(() => setStateNotice(""), 4000);
    }
  }, []);

  // ── Delete ──
  const deleteState = useCallback(async (stateId: string) => {
    setStateBusy(true);
    setStateNotice("Deleting...");
    try {
      const data = await deleteBodyState(stateId);
      setStateEntries(data.states);
      if (previewState === stateId || state === stateId) {
        const nextState = data.currentState ?? data.states[0]?.stateId ?? "默认";
        setPreviewState(nextState);
        localStorage.setItem("rin-body-state", nextState);
      }
      setStateNotice("Deleted ✓");
    } catch (e) {
      setStateNotice(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setStateBusy(false);
      setTimeout(() => setStateNotice(""), 4000);
    }
  }, [previewState, state]);

  // ── State change: persist to backend + localStorage ──
  const handleStateChange = useCallback(async (newState: BodyState) => {
    setPreviewState(newState);
    localStorage.setItem("rin-body-state", newState);
    try { await setCurrentBodyState(newState); } catch {}
  }, []);

  // ── View update (saves immediately) ──
  const updateView = useCallback((patch: Partial<BodyViewSettings>) => {
    setBodyView(prev => {
      const next = { ...prev, ...patch };
      saveViewNow(next);
      return next;
    });
  }, [saveViewNow]);

  // ── Drag handlers ──
  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!editMode || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewX: viewRef.current.x, viewY: viewRef.current.anchorY, moved: false };
  }, [editMode]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    updateView({ x: clamp(drag.viewX + dx, -400, 400, 0), anchorY: clamp(drag.viewY - dy, 0, 100, 50) });
  }, [updateView]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }, []);

  const handleWheel = useCallback((event: ReactWheelEvent<HTMLElement>) => {
    if (!editMode) return;
    event.preventDefault();
    updateView({ scale: clamp(viewRef.current.scale + (event.deltaY < 0 ? 0.05 : -0.05), 0.3, 3.0, 1) });
  }, [editMode, updateView]);

  const resetView = useCallback(() => {
    const factory: BodyViewSettings = { scale: 1, x: 0, y: 0, anchorY: 50, winWidth: 240, bodyHeight: 380, bubbleArea: 86, bubbleWidth: 160, bubblePadding: "6px 8px", bubbleFontSize: 11, chatWidth: 140, chatBottom: 4 };
    setBodyView(factory);
    saveViewNow(factory);
  }, [saveViewNow]);

  const previewScale = 0.28;
  const pw = Math.round(bodyView.winWidth * previewScale);
  const ph = Math.round((bodyView.bubbleArea + bodyView.bodyHeight) * previewScale);

  const allStateIds = [...new Set([...BODY_STATES, ...stateEntries.map(s => s.stateId)])];
  const stateLabelMap: Record<string, string> = {};
  for (const s of stateEntries) stateLabelMap[s.stateId] = s.label;
  for (const s of BODY_STATES) stateLabelMap[s] = manifest?.states[s]?.label ?? s;
  const selectedCharacterIndex = characterAssets.findIndex((c) => c.id === selectedCharacterId);
  const prevCharacter = useCallback(() => {
    const prev = selectedCharacterIndex > 0 ? selectedCharacterIndex - 1 : characterAssets.length - 1;
    selectCharacter(characterAssets[prev]?.id ?? selectedCharacter.id);
  }, [characterAssets, selectedCharacter.id, selectedCharacterIndex, selectCharacter]);
  const handleCharacterFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    void addCharacterFiles(event.target.files);
    event.currentTarget.value = "";
  }, [addCharacterFiles]);

  return (
    <div className="body-module">
      {/* Header */}
      <div className="body-module-header">
        <div>
          <strong>LAYERED AVATAR</strong>
          <small>{currentState}{previewState ? ` · ${previewState}` : ""}{synced ? " ✦ SYNCED" : ""}</small>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <button type="button" className="body-preview-toggle" onClick={() => setPreviewOpen(v => !v)}>{previewOpen ? "▾ PREVIEW" : "▸ PREVIEW"}</button>
          <span className={`body-runtime-dot${snapshot?.body?.currentState ? " live" : ""}`}>{snapshot?.body?.currentState ? "LIVE" : "WAIT"}</span>
        </div>
      </div>

      {/* Desktop preview */}
      {previewOpen && (
        <div className="body-desktop-preview-section">
          <span className="body-section-label">DESKTOP PREVIEW</span>
          <div className="body-desktop-preview" style={{ width: pw, height: ph }}>
            <div className="body-mini-bubble"><div className="body-mini-bubble-tail" /></div>
            <div className="body-mini-character">
              {imgSrc ? <img src={imgSrc} alt={stateLabel} draggable={false} style={{ objectPosition: `center ${bodyView.anchorY}%`, transform: `scale(${bodyView.scale})` }} /> : null}
            </div>
          </div>
        </div>
      )}

      {/* Character preview */}
      <div className={`body-preview${editMode ? " editing" : ""}`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onWheel={handleWheel}>
        {loadError ? <p className="body-preview-error">{loadError}</p>
        : imgSrc ? <img src={imgSrc} alt={`Body: ${stateLabel}`} draggable={false} style={{ objectPosition: `center ${bodyView.anchorY}%`, transform: `translate(${bodyView.x}px, ${bodyView.y}px) scale(${bodyView.scale})`, cursor: editMode ? "grab" : undefined }} />
        : <p className="body-preview-error">Loading…</p>}
        <div className="body-preview-badge">{stateLabel}</div>
        {editMode && <div className="body-preview-overlay"><span>DRAG TO POSITION · SCROLL TO SCALE</span></div>}
      </div>

      {/* Edit bar */}
      <div className="body-edit-bar-wrap">
        <div className="body-edit-bar">
          <button type="button" className={`body-edit-toggle${editMode ? " active" : ""}`} onClick={() => setEditMode(v => !v)}>{editMode ? "LOCK" : "EDIT POSITION"}</button>
          <button type="button" className="body-edit-reset" onClick={resetView}>RESET</button>
          <button type="button" className={`body-edit-toggle${configOpen ? " active" : ""}`} onClick={() => setConfigOpen(v => !v)}>{configOpen ? "HIDE CONFIG" : "CONFIGURE"}</button>
          {editMode && <span className="body-edit-info">s:{bodyView.scale.toFixed(2)} x:{bodyView.x} a:{bodyView.anchorY}%</span>}
        </div>
        {configOpen && (
          <div className="body-config-panel">
            <span className="body-section-label">WINDOW</span>
            <SliderControl label="Width" value={bodyView.winWidth} min={120} max={800} step={10} unit="px" onChange={v => updateView({ winWidth: v })} />
            <SliderControl label="Body H" value={bodyView.bodyHeight} min={120} max={900} step={10} unit="px" onChange={v => updateView({ bodyHeight: v })} />
            <SliderControl label="Bubble gap" value={bodyView.bubbleArea} min={0} max={200} step={4} unit="px" onChange={v => updateView({ bubbleArea: v })} />
            <span className="body-section-label">IMAGE</span>
            <SliderControl label="Scale" value={bodyView.scale} min={0.3} max={3.0} step={0.05} onChange={v => updateView({ scale: v })} />
            <SliderControl label="Anchor Y" value={bodyView.anchorY} min={0} max={100} step={1} unit="%" onChange={v => updateView({ anchorY: v })} />
            <span className="body-section-label">BUBBLE</span>
            <SliderControl label="Width" value={bodyView.bubbleWidth} min={80} max={400} step={10} unit="px" onChange={v => updateView({ bubbleWidth: v })} />
            <SliderControl label="Font" value={bodyView.bubbleFontSize} min={8} max={24} step={1} unit="px" onChange={v => updateView({ bubbleFontSize: v })} />
            <span className="body-section-label">CHAT BAR</span>
            <SliderControl label="Width" value={bodyView.chatWidth} min={80} max={400} step={10} unit="px" onChange={v => updateView({ chatWidth: v })} />
            <SliderControl label="Bottom" value={bodyView.chatBottom} min={0} max={60} step={2} unit="px" onChange={v => updateView({ chatBottom: v })} />
          </div>
        )}
      </div>

      {/* State selector */}
      <div className="body-state-selector">
        <span>STATE</span>
        <div className="body-state-options">
          {allStateIds.map(s => (
            <button key={s} type="button" className={state === s ? "active" : ""} onClick={() => { void handleStateChange(s); }}>
              {stateLabelMap[s] ?? s}
              {stateEntries.some(e => e.stateId === s && e.custom) && (
                <span className="body-state-del" onClick={e => { e.stopPropagation(); void deleteState(s); }} title="Delete">×</span>
              )}
            </button>
          ))}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFileChange} disabled={stateBusy} />
        <button type="button" className="body-state-add" onClick={() => fileInputRef.current?.click()} disabled={stateBusy} title="Upload new state image">
          {stateBusy ? "…" : "+"}
        </button>
        {previewState && <button type="button" className="body-state-auto" onClick={() => setPreviewState(null)}>auto</button>}
      </div>

      {/* State notice */}
      {stateNotice && <div className="gallery-notice">{stateNotice}</div>}

      {/* Launchers */}
      <div className="body-launchers">
        <a href="/body" target="_blank" rel="noreferrer" className="body-launch-btn">OPEN BODY</a>
        <a href="/body/floating" target="_blank" rel="noreferrer" className="body-launch-btn primary">DESKTOP FLOATING</a>
      </div>
      <section className="body-character-panel" aria-label="Stage character">
        <div className="body-character-header">
          <button type="button" className="gallery-arrow" onClick={prevCharacter} disabled={characterAssets.length <= 1} aria-label="Previous character">&lsaquo;</button>
          <div>
            <strong>{selectedCharacter.label}</strong>
            <small>{selectedCharacter.source}{selectedCharacter.pose ? ` / ${selectedCharacter.pose}` : ""}</small>
          </div>
          <button type="button" className="gallery-arrow" onClick={nextCharacter} disabled={characterAssets.length <= 1} aria-label="Next character">&rsaquo;</button>
        </div>
        <div className="body-character-actions">
          <input ref={characterFileInputRef} type="file" accept="image/*" multiple className="gallery-file-input" onChange={handleCharacterFileChange} disabled={galleryBusy} />
          <button type="button" onClick={() => characterFileInputRef.current?.click()} disabled={galleryBusy}>ADD IMAGE</button>
          <button type="button" className={characterEditMode ? "active" : ""} onClick={() => setCharacterEditMode((v) => !v)} disabled={galleryBusy}>
            {characterEditMode ? "LOCK STAGE" : "EDIT STAGE"}
          </button>
          <button type="button" onClick={() => void resetSelectedCharacterView()} disabled={galleryBusy}>RESET VIEW</button>
          <button type="button" onClick={() => void restoreDefaultCharacters()} disabled={galleryBusy}>DEFAULTS</button>
        </div>
        {(galleryBusy || galleryNotice) && (
          <div className={`gallery-notice${galleryBusy ? " busy" : ""}`}>
            {galleryBusy ? "Syncing..." : galleryNotice}
          </div>
        )}
        <div className="body-character-strip" aria-label="Character thumbnails">
          {characterAssets.map((character) => (
            <div key={character.id} className={`gallery-thumb${character.id === selectedCharacterId ? " active" : ""}`}>
              <button type="button" className="gallery-thumb-btn" onClick={() => selectCharacter(character.id)} aria-label={character.label}>
                <img src={character.previewPath} alt="" />
              </button>
              {characterEditMode && characterAssets.length > 1 ? (
                <button
                  type="button"
                  className="gallery-thumb-del"
                  onClick={() => void deleteCharacter(character.id)}
                  disabled={galleryBusy}
                  aria-label={`Delete ${character.label}`}
                >
                  &times;
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
});
