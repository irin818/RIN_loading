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
  return (
    <div className="character-gallery-module">
      <div className="module-strip">CHARACTER ARCHIVE</div>
      <div className="gallery-current">
        <img src={selectedCharacter.previewPath} alt="" />
        <div>
          <span>ACTIVE IMAGE</span>
          <strong>{selectedCharacter.label}</strong>
          <small>{selectedCharacter.source} / {selectedCharacter.pose}</small>
        </div>
        <button type="button" onClick={nextCharacter} disabled={!characterEditMode || galleryBusy}>NEXT</button>
      </div>
      <div className="gallery-actions" aria-label="Character archive actions">
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="gallery-file-input" onChange={handleFileChange} disabled={galleryBusy} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={galleryBusy}>ADD</button>
        <button type="button" className={characterEditMode ? "active" : ""} onClick={() => setCharacterEditMode((v) => !v)} disabled={galleryBusy}>EDIT VIEW</button>
        <button type="button" onClick={() => void resetSelectedCharacterView()} disabled={galleryBusy}>RESET VIEW</button>
        <button type="button" onClick={() => void restoreDefaultCharacters()} disabled={galleryBusy}>RESTORE</button>
      </div>
      {characterEditMode ? <div className="gallery-view-editor"><span>EDIT UNLOCKED · LOCAL BACKEND SYNC · DRAG STAGE · WHEEL SCALE · CLICK CARD TO SWITCH</span></div> : null}
      {galleryBusy ? <div className="gallery-notice">SYNCING LOCAL ASSETS</div> : null}
      {galleryNotice ? <div className="gallery-notice">{galleryNotice}</div> : null}
      <div className="gallery-grid" aria-label="RIN character image archive">
        {characterAssets.map((character) => (
          <article key={character.id} className={`gallery-card ${character.id === selectedCharacterId ? "active" : ""}`} data-character-id={character.id}>
            <button type="button" className="gallery-select" disabled={!characterEditMode || galleryBusy} onClick={() => selectCharacter(character.id)}>
              <span className="gallery-thumb-frame"><img src={character.previewPath} alt="" /></span>
              <strong>{character.label}</strong>
              <small>{character.source}</small>
            </button>
            <button type="button" className="gallery-delete" disabled={!characterEditMode || galleryBusy} onClick={() => void deleteCharacter(character.id)} aria-label={`Delete ${character.label}`}>DEL</button>
          </article>
        ))}
      </div>
    </div>
  );
});
