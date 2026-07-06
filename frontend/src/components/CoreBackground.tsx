import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { normalizeCharacterView } from "../rinCharacters";
import type { RinCharacterAsset } from "../rinCharacters";

type CoreVisualState = "idle" | "thinking" | "streaming" | "memory" | "warning" | "error" | "critical";

type CharacterViewSettings = {
  x: number; y: number; scale: number;
  cropTop: number; cropRight: number; cropBottom: number; cropLeft: number;
};

const VIEW_STORAGE_PREFIX = "rin-char-view-";

function loadCachedView(characterId: string): CharacterViewSettings | null {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_PREFIX + characterId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizeCharacterView(parsed);
  } catch { return null; }
}

function cacheView(characterId: string, view: CharacterViewSettings) {
  try { localStorage.setItem(VIEW_STORAGE_PREFIX + characterId, JSON.stringify(view)); } catch { /* quota exceeded — silent */ }
}

export const CoreBackground = memo(function CoreBackground({
  visualState,
  selectedCharacter,
  selectedCharacterView,
  characterEditMode,
  updateCharacterView,
  commitCharacterView,
}: {
  visualState: CoreVisualState;
  selectedCharacter: RinCharacterAsset;
  selectedCharacterView: CharacterViewSettings;
  characterEditMode: boolean;
  updateCharacterView: (patch: Partial<CharacterViewSettings>) => void;
  commitCharacterView: (view: CharacterViewSettings) => void;
}) {
  const [glitchBurst, setGlitchBurst] = useState(false);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; viewX: number; viewY: number; moved: boolean } | null>(null);
  const suppressStageClick = useRef(false);
  const viewRef = useRef(selectedCharacterView);
  viewRef.current = selectedCharacterView;
  const commitRef = useRef(commitCharacterView);
  commitRef.current = commitCharacterView;
  const charIdRef = useRef(selectedCharacter.id);
  charIdRef.current = selectedCharacter.id;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save — fires after user stops adjusting for 400ms
  const scheduleCommit = useCallback((view: CharacterViewSettings) => {
    cacheView(charIdRef.current, view);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      commitRef.current(view);
    }, 400);
  }, []);

  // Immediate save (on drag end — no debounce needed since it's a discrete action)
  const commitNow = useCallback((view: CharacterViewSettings) => {
    cacheView(charIdRef.current, view);
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    commitRef.current(view);
  }, []);

  // Auto-save when exiting edit mode
  const prevEditMode = useRef(characterEditMode);
  useEffect(() => {
    if (prevEditMode.current && !characterEditMode) {
      // Just exited edit mode — flush any pending save immediately
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
      commitRef.current(viewRef.current);
    }
    prevEditMode.current = characterEditMode;
  }, [characterEditMode]);

  // Restore cached view on character switch (as fallback before API returns)
  useEffect(() => {
    const cached = loadCachedView(selectedCharacter.id);
    if (cached) {
      updateCharacterView(cached);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCharacter.id]);

  const triggerBlink = useCallback(() => { setGlitchBurst(true); window.setTimeout(() => setGlitchBurst(false), 260); }, []);
  const handleCharacterClick = useCallback(() => {
    if (characterEditMode || suppressStageClick.current) { suppressStageClick.current = false; return; }
    triggerBlink();
  }, [characterEditMode, triggerBlink]);
  const handleStagePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!characterEditMode || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewX: viewRef.current.x, viewY: viewRef.current.y, moved: false };
  }, [characterEditMode]);
  const handleStagePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX; const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    updateCharacterView({ x: drag.viewX + dx, y: drag.viewY + dy });
  }, [updateCharacterView]);
  const handleStagePointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      const nextView = normalizeCharacterView({ ...viewRef.current, x: drag.viewX + event.clientX - drag.startX, y: drag.viewY + event.clientY - drag.startY }, selectedCharacter);
      suppressStageClick.current = drag.moved;
      dragRef.current = null;
      if (drag.moved) { updateCharacterView(nextView); commitNow(nextView); }
    }
  }, [commitNow, selectedCharacter, updateCharacterView]);
  const handleStageWheel = useCallback((event: ReactWheelEvent<HTMLElement>) => {
    if (!characterEditMode) return;
    event.preventDefault();
    const nextView = normalizeCharacterView({ ...viewRef.current, scale: viewRef.current.scale + (event.deltaY < 0 ? 0.05 : -0.05) }, selectedCharacter);
    updateCharacterView(nextView);
    scheduleCommit(nextView);
  }, [characterEditMode, scheduleCommit, selectedCharacter, updateCharacterView]);

  const characterStyle = {
    "--rin-character-stage-scale": String(selectedCharacterView.scale),
    "--rin-character-stage-x": `${selectedCharacterView.x}px`,
    "--rin-character-stage-y": `${selectedCharacterView.y}px`,
    "--rin-character-crop-top": `${selectedCharacterView.cropTop}%`,
    "--rin-character-crop-right": `${selectedCharacterView.cropRight}%`,
    "--rin-character-crop-bottom": `${selectedCharacterView.cropBottom}%`,
    "--rin-character-crop-left": `${selectedCharacterView.cropLeft}%`,
  } as CSSProperties;

  return (
    <section
      className={`core-background rin-anime-stage core-visual-${visualState} ${glitchBurst ? "core-blink" : ""}`}
      aria-label="RIN anime companion stage"
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
      onPointerCancel={handleStagePointerUp}
      onWheel={handleStageWheel}
    >
      {/* ── Moonlit Clover Grove · Scene Layers ── */}

      {/* Moon glow behind character */}
      <div className="moon-glow" />

      {/* Ambient bloom */}
      <div className="core-ambient-bloom" />

      {/* Firefly particles */}
      <div className="firefly" /><div className="firefly" /><div className="firefly" /><div className="firefly" />
      <div className="firefly" /><div className="firefly" /><div className="firefly" /><div className="firefly" />
      <div className="firefly" /><div className="firefly" /><div className="firefly" /><div className="firefly" />
      <div className="firefly" /><div className="firefly" />

      {/* Clover decorations */}
      <div className="clover-deco" /><div className="clover-deco" /><div className="clover-deco" /><div className="clover-deco" />
      <div className="clover-deco" /><div className="clover-deco" /><div className="clover-deco" /><div className="clover-deco" />
      <div className="clover-deco" /><div className="clover-deco" />

      {/* Character echo (subtle after-image) */}
      <img src={selectedCharacter.path} alt="" className="rin-character-echo" aria-hidden="true" />

      {/* Character stage */}
      <button
        type="button"
        className={`rin-character-stage ${characterEditMode ? "editing" : ""}`}
        data-character-id={selectedCharacter.id}
        style={characterStyle}
        onClick={handleCharacterClick}
        onMouseEnter={triggerBlink}
        aria-label={characterEditMode ? `Editing RIN character view for ${selectedCharacter.label}` : `RIN character stage for ${selectedCharacter.label}`}
      >
        <span className="rin-stage-shadow" />
        <img key={selectedCharacter.id} src={selectedCharacter.path} alt="" className="core-rin-background-image rin-character-image" />
      </button>

      {/* Side decoration */}
      <div className="rin-side-code" aria-hidden="true"><span>RIN</span><i /></div>

      {/* Bottom vignette */}
      <div className="vignette-bottom" />

      {/* Hero label */}
      <div className="core-label">
        <span>RIN CORE</span>
        <small>LOCAL AI COMPANION</small>
      </div>
    </section>
  );
});
