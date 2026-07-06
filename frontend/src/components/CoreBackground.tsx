import { memo, useCallback, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { normalizeCharacterView } from "../rinCharacters";
import type { RinCharacterAsset } from "../rinCharacters";

type CoreVisualState = "idle" | "thinking" | "streaming" | "memory" | "warning" | "error" | "critical";

type CharacterViewSettings = {
  x: number; y: number; scale: number;
  cropTop: number; cropRight: number; cropBottom: number; cropLeft: number;
};

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
  const triggerBlink = useCallback(() => { setGlitchBurst(true); window.setTimeout(() => setGlitchBurst(false), 260); }, []);
  const handleCharacterClick = useCallback(() => {
    if (characterEditMode || suppressStageClick.current) { suppressStageClick.current = false; return; }
    triggerBlink();
  }, [characterEditMode, triggerBlink]);
  const handleStagePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!characterEditMode || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewX: selectedCharacterView.x, viewY: selectedCharacterView.y, moved: false };
  }, [characterEditMode, selectedCharacterView.x, selectedCharacterView.y]);
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
      const nextView = normalizeCharacterView({ ...selectedCharacterView, x: drag.viewX + event.clientX - drag.startX, y: drag.viewY + event.clientY - drag.startY }, selectedCharacter);
      suppressStageClick.current = drag.moved;
      dragRef.current = null;
      if (drag.moved) { updateCharacterView(nextView); commitCharacterView(nextView); }
    }
  }, [commitCharacterView, selectedCharacter, selectedCharacterView, updateCharacterView]);
  const handleStageWheel = useCallback((event: ReactWheelEvent<HTMLElement>) => {
    if (!characterEditMode) return;
    event.preventDefault();
    const nextView = normalizeCharacterView({ ...selectedCharacterView, scale: selectedCharacterView.scale + (event.deltaY < 0 ? 0.05 : -0.05) }, selectedCharacter);
    updateCharacterView(nextView);
    commitCharacterView(nextView);
  }, [characterEditMode, commitCharacterView, selectedCharacter, selectedCharacterView, updateCharacterView]);

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
      <div className="core-depth-layer far" />
      <div className="core-depth-layer near" />
      <div className="core-ambient-bloom" />
      <div className="rin-manga-speed-lines" />
      <div className="rin-calibration-ring ring-a" />
      <div className="rin-calibration-ring ring-b" />
      <div className="rin-paint-splash splash-a" />
      <div className="rin-paint-splash splash-b" />
      <div className="rin-paint-splash splash-c" />
      <div className="rin-floral-field" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div>
      <div className="memory-fragment-field"><span /><span /><span /><span /><span /><span /></div>
      <img src={selectedCharacter.path} alt="" className="rin-character-echo" aria-hidden="true" />
      <button type="button" className={`rin-character-stage ${characterEditMode ? "editing" : ""}`} data-character-id={selectedCharacter.id} style={characterStyle} onClick={handleCharacterClick} onMouseEnter={triggerBlink} aria-label={characterEditMode ? `Editing RIN character view for ${selectedCharacter.label}` : `RIN character stage for ${selectedCharacter.label}`}>
        <span className="rin-stage-shadow" />
        <img key={selectedCharacter.id} src={selectedCharacter.path} alt="" className="core-rin-background-image rin-character-image" />
      </button>
      <div className="rin-side-code" aria-hidden="true"><span>FUTURE CODE</span><i /></div>
      <div className="foreground-trace-field"><span /><span /><span /><span /></div>
      <div className="core-label"><span data-text="RIN CORE">RIN CORE</span><small>LOCAL AI COMPANION</small></div>
    </section>
  );
});
