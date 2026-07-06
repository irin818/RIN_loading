import { memo, useCallback, useRef } from "react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import type { RinCharacterAsset } from "../rinCharacters";

export const GalleryWindow = memo(function GalleryWindow({
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
}: {
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
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      void addCharacterFiles(event.target.files);
      event.target.value = "";
    },
    [addCharacterFiles],
  );

  const selectedIndex = characterAssets.findIndex((c) => c.id === selectedCharacterId);
  const prevCharacter = useCallback(() => {
    const prev = selectedIndex > 0 ? selectedIndex - 1 : characterAssets.length - 1;
    selectCharacter(characterAssets[prev].id);
  }, [selectedIndex, characterAssets, selectCharacter]);

  return (
    <div className="gallery-module">
      {/* ── Header: name + cycle arrows ── */}
      <div className="gallery-header">
        <button type="button" className="gallery-arrow" onClick={prevCharacter} disabled={characterAssets.length <= 1} aria-label="Previous character">&lsaquo;</button>
        <div className="gallery-header-info">
          <strong>{selectedCharacter.label}</strong>
          <small>{selectedCharacter.source}{selectedCharacter.pose ? ` / ${selectedCharacter.pose}` : ""}</small>
        </div>
        <button type="button" className="gallery-arrow" onClick={nextCharacter} disabled={characterAssets.length <= 1} aria-label="Next character">&rsaquo;</button>
      </div>

      {/* ── Large preview ── */}
      <div className="gallery-preview">
        <img src={selectedCharacter.previewPath} alt={selectedCharacter.label} />
        {characterEditMode && (
          <div className="gallery-preview-overlay">
            <span>DRAG TO REPOSITION · SCROLL TO SCALE</span>
          </div>
        )}
      </div>

      {/* ── Action bar ── */}
      <div className="gallery-actions">
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="gallery-file-input" onChange={handleFileChange} disabled={galleryBusy} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={galleryBusy}>+ ADD</button>
        <button type="button" className={characterEditMode ? "active" : ""} onClick={() => setCharacterEditMode((v) => !v)} disabled={galleryBusy}>
          {characterEditMode ? "LOCK VIEW" : "EDIT VIEW"}
        </button>
        <button type="button" onClick={() => void resetSelectedCharacterView()} disabled={galleryBusy}>RESET</button>
        <button type="button" onClick={() => void restoreDefaultCharacters()} disabled={galleryBusy}>DEFAULTS</button>
      </div>

      {/* ── Status notices ── */}
      {(galleryBusy || galleryNotice) && (
        <div className={`gallery-notice${galleryBusy ? " busy" : ""}`}>
          {galleryBusy ? "Syncing..." : galleryNotice}
        </div>
      )}

      {/* ── Filmstrip thumbnails ── */}
      <div className="gallery-filmstrip" aria-label="Character thumbnails">
        {characterAssets.map((character) => (
          <div
            key={character.id}
            className={`gallery-thumb${character.id === selectedCharacterId ? " active" : ""}`}
            data-character-id={character.id}
          >
            <button
              type="button"
              className="gallery-thumb-btn"
              onClick={() => selectCharacter(character.id)}
              aria-label={character.label}
            >
              <img src={character.previewPath} alt="" />
            </button>
            {characterEditMode && characterAssets.length > 1 && (
              <button
                type="button"
                className="gallery-thumb-del"
                onClick={() => void deleteCharacter(character.id)}
                disabled={galleryBusy}
                aria-label={`Delete ${character.label}`}
              >&times;</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
