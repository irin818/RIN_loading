import { memo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { CoreStatus } from "./CoreStatus";
import { BodyWindow } from "./BodyWindow";
import { ChatWindow } from "./ChatWindow";
import { MemoryWindow, MemoryDetailWindow } from "./MemoryWindow";
import { TraceWindow } from "./TraceWindow";
import { CognitionFlowWindow } from "./CognitionFlowWindow";
import { ProviderWindow } from "./ProviderWindow";
import { ContextWindow } from "./ContextWindow";
import { CostWindow } from "./CostWindow";
import { ControlWindow } from "./ControlWindow";
import { MindWindow } from "./MindWindow";
import { ErrorWindow } from "./ErrorWindow";
import { GalleryWindow } from "./GalleryWindow";
import { StubWindow } from "./StubWindow";
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
    case "core":
      return <CoreStatus snapshot={snapshot} />;
    case "body":
      return <BodyWindow snapshot={snapshot} />;
    case "chat":
      return <ChatWindow snapshot={snapshot} chatInput={chatInput} setChatInput={setChatInput} chatBusy={chatBusy} lastChatContent={lastChatContent} submitChat={submitChat} openWindow={openWindow} />;
    case "memory":
      return <MemoryWindow snapshot={snapshot} memoryCompact={memoryCompact} setMemoryCompact={setMemoryCompact} memoryQuery={memoryQuery} setMemoryQuery={setMemoryQuery} searchMemory={searchMemory} openWindow={openWindow} />;
    case "gallery":
      return <GalleryWindow selectedCharacterId={selectedCharacterId} selectedCharacter={selectedCharacter} characterAssets={characterAssets} characterEditMode={characterEditMode} setCharacterEditMode={setCharacterEditMode} resetSelectedCharacterView={resetSelectedCharacterView} addCharacterFiles={addCharacterFiles} deleteCharacter={deleteCharacter} restoreDefaultCharacters={restoreDefaultCharacters} galleryNotice={galleryNotice} galleryBusy={galleryBusy} selectCharacter={selectCharacter} nextCharacter={nextCharacter} />;
    case "memoryDetail":
      return <MemoryDetailWindow card={win.payload?.card as MemoryCard | undefined} displayMode={uiSettings.displayMode} />;
    case "context":
      return <ContextWindow snapshot={snapshot} displayMode={uiSettings.displayMode} />;
    case "trace":
      return <TraceWindow trace={snapshot?.trace.latest ?? null} analytics={snapshot?.mind.analytics?.trace} displayMode={uiSettings.displayMode} />;
    case "cognition":
      return <CognitionFlowWindow flow={snapshot?.cognitionFlow} displayMode={uiSettings.displayMode} openWindow={openWindow} />;
    case "provider":
      return <ProviderWindow snapshot={snapshot} openWindow={openWindow} displayMode={uiSettings.displayMode} />;
    case "cost":
      return <CostWindow snapshot={snapshot} displayMode={uiSettings.displayMode} />;
    case "control":
      return <ControlWindow snapshot={snapshot} displayMode={uiSettings.displayMode} uiSettings={uiSettings} setUiSettings={setUiSettings} reviewGrowthEvent={reviewGrowthEvent} reviewToolRequest={reviewToolRequest} runSelfReviewAction={runSelfReviewAction} reviewImprovementProposal={reviewImprovementProposal} openWindow={openWindow} />;
    case "mind":
      return <MindWindow snapshot={snapshot} reviewMindCandidate={reviewMindCandidate} editMindCandidate={editMindCandidate} displayMode={uiSettings.displayMode} />;
    case "error":
      return <ErrorWindow error={win.payload?.error as GlitchErrorItem | undefined} trace={snapshot?.trace.latest ?? null} openWindow={openWindow} onDismiss={() => closeWindow(win.id)} />;
    case "tasks":
    case "tools":
    case "settings":
    case "system":
      return <StubWindow type={win.type} snapshot={snapshot} />;
    default:
      return null;
  }
});
