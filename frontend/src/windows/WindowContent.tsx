import { memo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { BodyWindow } from "./BodyWindow";
import { ChatWindow } from "./ChatWindow";
import { MemoryWindow, MemoryDetailWindow } from "./MemoryWindow";
import { ErrorWindow } from "./ErrorWindow";
import { SettingsWindow } from "./SettingsWindow";
import { TasksWindow } from "./TasksWindow";
import { DeveloperWindow } from "./DeveloperWindow";
import type {
  ConsoleWindow, GlitchErrorItem, GlitchSnapshot, MemoryCard,
  MindCandidateSafePatch, WindowPayload, WindowType,
} from "../types";
import type { Density, DisplayMode, DisplaySize } from "../visualization";
import type { RinCharacterAsset } from "../rinCharacters";

export const WindowContent = memo(function WindowContent({
  win,
  snapshot,
  chatInput, setChatInput, chatBusy, lastChatContent, submitChat,
  refreshSnapshot, memoryCompact, setMemoryCompact, memoryQuery, setMemoryQuery,
  searchMemory, reviewMindCandidate, editMindCandidate, reviewGrowthEvent,
  reviewToolRequest, runSelfReviewAction, reviewImprovementProposal,
  uiSettings, setUiSettings, selectedCharacter, selectedCharacterId,
  characterAssets, characterEditMode, setCharacterEditMode,
  resetSelectedCharacterView, addCharacterFiles, deleteCharacter,
  restoreDefaultCharacters, galleryNotice, galleryBusy,
  selectCharacter, nextCharacter, openWindow, openErrorWindow, closeWindow,
}: {
  win: ConsoleWindow;
  snapshot: GlitchSnapshot | null;
  chatInput: string;
  setChatInput: (value: string) => void;
  chatBusy: boolean;
  lastChatContent: string;
  submitChat: (content: string) => Promise<void>;
  refreshSnapshot: (conversationId?: string | null) => Promise<void>;
  memoryCompact: boolean;
  setMemoryCompact: (value: boolean) => void;
  memoryQuery: string;
  setMemoryQuery: (value: string) => void;
  searchMemory: () => Promise<void>;
  reviewMindCandidate: (candidateId: string, action: "approve" | "reject" | "deactivate" | "reactivate") => Promise<void>;
  editMindCandidate: (candidateId: string, patch: MindCandidateSafePatch) => Promise<void>;
  reviewGrowthEvent: (eventId: string, action: "approve" | "reject") => Promise<void>;
  reviewToolRequest: (requestId: string, action: "approve" | "reject") => Promise<void>;
  runSelfReviewAction: () => Promise<void>;
  reviewImprovementProposal: (proposalId: string, action: "approve" | "reject" | "convert") => Promise<void>;
  uiSettings: { displayMode: DisplayMode; displaySize: DisplaySize; density: Density };
  setUiSettings: Dispatch<SetStateAction<{ displayMode: DisplayMode; displaySize: DisplaySize; density: Density }>>;
  selectedCharacter: RinCharacterAsset;
  selectedCharacterId: string;
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
  openWindow: (type: WindowType, options?: { contextName?: string; payload?: WindowPayload; focusExistingId?: string }) => void;
  openErrorWindow: (error: GlitchErrorItem) => void;
  closeWindow: (id: string) => void;
}) {
  switch (win.type) {
    case "chat":
      return <ChatWindow snapshot={snapshot} chatInput={chatInput} setChatInput={setChatInput} chatBusy={chatBusy} lastChatContent={lastChatContent} submitChat={submitChat} openWindow={openWindow} />;
    case "memory":
      return <MemoryWindow snapshot={snapshot} memoryCompact={memoryCompact} setMemoryCompact={setMemoryCompact} memoryQuery={memoryQuery} setMemoryQuery={setMemoryQuery} searchMemory={searchMemory} reviewMindCandidate={reviewMindCandidate} openWindow={openWindow} />;
    case "memoryDetail":
      return <MemoryDetailWindow card={win.payload?.card as MemoryCard | undefined} displayMode={uiSettings.displayMode} />;
    case "tasks":
      return <TasksWindow snapshot={snapshot} displayMode={uiSettings.displayMode} runSelfReviewAction={runSelfReviewAction} reviewImprovementProposal={reviewImprovementProposal} reviewGrowthEvent={reviewGrowthEvent} reviewToolRequest={reviewToolRequest} />;
    case "body":
      return <BodyWindow snapshot={snapshot} selectedCharacterId={selectedCharacterId} selectedCharacter={selectedCharacter} characterAssets={characterAssets} characterEditMode={characterEditMode} setCharacterEditMode={setCharacterEditMode} resetSelectedCharacterView={resetSelectedCharacterView} addCharacterFiles={addCharacterFiles} deleteCharacter={deleteCharacter} restoreDefaultCharacters={restoreDefaultCharacters} galleryNotice={galleryNotice} galleryBusy={galleryBusy} selectCharacter={selectCharacter} nextCharacter={nextCharacter} />;
    case "settings":
      return <SettingsWindow snapshot={snapshot} uiSettings={uiSettings} setUiSettings={setUiSettings} openWindow={openWindow} />;
    case "developer":
      return <DeveloperWindow snapshot={snapshot} displayMode={uiSettings.displayMode} openWindow={openWindow} reviewMindCandidate={reviewMindCandidate} editMindCandidate={editMindCandidate} />;
    case "error":
      return <ErrorWindow error={win.payload?.error as GlitchErrorItem | undefined} trace={snapshot?.trace.latest ?? null} openWindow={openWindow} onDismiss={() => closeWindow(win.id)} />;
    default:
      return null;
  }
});
