import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import {
  approveGrowthEvent, approveImprovementProposal, approveMindMemoryCandidate,
  approveToolRequest, convertImprovementProposalToCodexDraft, deactivateMindMemoryCandidate,
  deleteCharacterAsset, fetchCharacterAssets, fetchGlitchSnapshot,
  fetchMemoryCards, reactivateMindMemoryCandidate, rejectGrowthEvent,
  rejectImprovementProposal, rejectMindMemoryCandidate, rejectToolRequest,
  resetCharacterAssetView, restoreCharacterAssetDefaults, runSelfReview,
  saveCharacterAssetView, sendChatMessage, uploadCharacterAsset,
  updateMindMemoryCandidateSafeFields,
} from "../api";
import type { CharacterAssetsPayload, CharacterViewSettingsPayload } from "../api";
import { navigateWebShell } from "../app/AppRouter";
import { WindowFrame } from "../components/WindowFrame";
import { TopMenu } from "../components/TopMenu";
import { CoreBackground } from "../components/CoreBackground";
import { normalizeCharacterView, RIN_CHARACTER_ASSETS } from "../rinCharacters";
import type { RinCharacterAsset } from "../rinCharacters";
import type {
  ConsoleWindow, GlitchErrorItem, GlitchSnapshot, MemoryCard,
  MindCandidateSafePatch, WindowPayload, WindowType,
} from "../types";
import {
  compactError, errorFingerprint, isDisplayMode, isDisplaySize, isDensity,
  CHARACTER_KEY, LAYOUT_KEY, PERSISTENT_TYPES, REUSABLE_WINDOW_TYPES, UI_SETTINGS_KEY,
} from "../utils";
import type { Density, DisplayMode, DisplaySize } from "../visualization";
import { WindowContent } from "../windows/WindowContent";

// ── window layout helpers ──

const WINDOW_META: Record<WindowType, { label: string; context: string; code: string }> = {
  purpose: { label: "Purpose", context: "Final Direction", code: "GOAL" },
  chat: { label: "Chat", context: "Default Session", code: "CHAT" },
  memory: { label: "Memory", context: "Memory Governance", code: "MEM" },
  memoryDetail: { label: "Memory Detail", context: "Memory Record", code: "MEM+" },
  tasks: { label: "Tasks", context: "Proposals", code: "TASK" },
  body: { label: "Body", context: "Avatar Interface", code: "BODY" },
  settings: { label: "Settings", context: "Model And UI", code: "SET" },
  developer: { label: "Developer", context: "Diagnostics", code: "DEV" },
  error: { label: "Error", context: "Runtime Error", code: "ERR" },
};

const WINDOW_MIN_Y = 64; // keep title bar below top system-menu (top:10 + height:52)

const DEFAULT_LAYOUT: Array<Pick<ConsoleWindow, "type" | "contextName" | "x" | "y" | "width" | "height">> = [
  { type: "purpose", contextName: "Final Direction", x: 44, y: WINDOW_MIN_Y, width: 450, height: 560 },
  { type: "chat", contextName: "Default Session", x: 516, y: WINDOW_MIN_Y, width: 500, height: 560 },
  { type: "memory", contextName: "Memory Governance", x: 1038, y: WINDOW_MIN_Y, width: 340, height: 560 },
];

const SPAWN_LAYOUT: Record<WindowType, { x: number; y: number; width: number; height: number; offsetX: number; offsetY: number }> = {
  purpose: { x: 72, y: WINDOW_MIN_Y + 18, width: 500, height: 560, offsetX: 24, offsetY: 24 },
  chat: { x: 44, y: WINDOW_MIN_Y, width: 430, height: 516, offsetX: 34, offsetY: 28 },
  memory: { x: 828, y: WINDOW_MIN_Y, width: 420, height: 488, offsetX: -34, offsetY: 28 },
  memoryDetail: { x: 520, y: WINDOW_MIN_Y + 54, width: 430, height: 420, offsetX: 28, offsetY: 28 },
  tasks: { x: 96, y: WINDOW_MIN_Y + 64, width: 420, height: 320, offsetX: 32, offsetY: 30 },
  body: { x: 494, y: WINDOW_MIN_Y, width: 380, height: 560, offsetX: 24, offsetY: 20 },
  settings: { x: 510, y: WINDOW_MIN_Y + 102, width: 430, height: 320, offsetX: 26, offsetY: 26 },
  developer: { x: 170, y: WINDOW_MIN_Y + 12, width: 760, height: 620, offsetX: 22, offsetY: 22 },
  error: { x: 500, y: WINDOW_MIN_Y + 60, width: 460, height: 340, offsetX: 28, offsetY: 30 },
};

type CoreVisualState = "idle" | "thinking" | "streaming" | "memory" | "warning" | "error" | "critical";
type CharacterViewMap = Record<string, CharacterViewSettingsPayload>;

// ── helper functions ──

function windowTitle(type: WindowType, instanceNumber: number, contextName: string) {
  return `${WINDOW_META[type].label} #${instanceNumber} · ${contextName}`;
}

function spawnRect(type: WindowType, instanceNumber: number) {
  const base = SPAWN_LAYOUT[type];
  const offsetIndex = Math.max(0, instanceNumber - 1);
  const lane = offsetIndex % 6;
  const stack = Math.floor(offsetIndex / 6);
  return { x: base.x + base.offsetX * lane + stack * 16, y: base.y + base.offsetY * lane + stack * 18, width: base.width, height: base.height };
}

function makeWindow(type: WindowType, instanceNumber: number, zIndex: number, overrides: Partial<ConsoleWindow> = {}): ConsoleWindow {
  const layout = instanceNumber === 1 ? DEFAULT_LAYOUT.find((item) => item.type === type) : undefined;
  const fallback = spawnRect(type, instanceNumber);
  const contextName = overrides.contextName ?? layout?.contextName ?? WINDOW_META[type].context;
  const x = overrides.x ?? layout?.x ?? fallback.x;
  const y = overrides.y ?? layout?.y ?? fallback.y;
  const width = overrides.width ?? layout?.width ?? fallback.width;
  const height = overrides.height ?? layout?.height ?? fallback.height;
  const fitted = fitWindowToViewport({ x, y, width, height });
  return { id: overrides.id ?? `${type}-${Date.now()}-${instanceNumber}`, type, instanceNumber, contextName, title: windowTitle(type, instanceNumber, contextName), x: fitted.x, y: fitted.y, width: fitted.width, height: fitted.height, zIndex, minimized: overrides.minimized ?? false, maximized: overrides.maximized ?? false, visible: overrides.visible ?? true, payload: overrides.payload };
}

function defaultWindows() {
  return DEFAULT_LAYOUT.map((item, index) => makeWindow(
    item.type,
    1,
    item.type === "purpose" ? 50 : 20 + index,
    item,
  ));
}

function fitWindowToViewport(rect: { x: number; y: number; width: number; height: number }) {
  if (typeof window === "undefined") return rect;
  const vw = Math.max(320, window.innerWidth);
  const vh = Math.max(360, window.innerHeight - 46);
  const width = Math.min(rect.width, Math.max(280, vw - 24));
  const height = Math.min(rect.height, Math.max(220, vh - 24));
  return { width, height, x: Math.max(0, Math.min(rect.x, vw - width - 12)), y: Math.max(WINDOW_MIN_Y, Math.min(rect.y, vh - height - 12)) };
}

function loadLayout(): ConsoleWindow[] {
  const raw = localStorage.getItem(LAYOUT_KEY);
  if (!raw) return defaultWindows();
  try {
    const parsed = JSON.parse(raw) as ConsoleWindow[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultWindows();
    return parsed.map((item, index) => ({ ...item, ...fitWindowToViewport(item), title: windowTitle(item.type, item.instanceNumber, item.contextName), zIndex: item.zIndex || 20 + index }));
  } catch { return defaultWindows(); }
}

function initialInstanceCounts(windows: ConsoleWindow[]) {
  return windows.reduce<Partial<Record<WindowType, number>>>((counts, item) => { counts[item.type] = Math.max(counts[item.type] ?? 0, item.instanceNumber); return counts; }, {});
}

function loadUiSettings() {
  const fallback = { displayMode: "basic" as DisplayMode, displaySize: "normal" as DisplaySize, density: "normal" as Density };
  const raw = localStorage.getItem(UI_SETTINGS_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<typeof fallback>;
    return { displayMode: isDisplayMode(parsed.displayMode) ? parsed.displayMode : fallback.displayMode, displaySize: isDisplaySize(parsed.displaySize) ? parsed.displaySize : fallback.displaySize, density: isDensity(parsed.density) ? parsed.density : fallback.density };
  } catch { return fallback; }
}

function loadCharacterId() { return localStorage.getItem(CHARACTER_KEY) ?? RIN_CHARACTER_ASSETS[0].id; }

function deriveCoreVisualState(snapshot: GlitchSnapshot | null, chatBusy: boolean): CoreVisualState {
  if (snapshot?.errors.some((item) => item.severity === "critical")) return "critical";
  if (snapshot?.errors.some((item) => item.severity === "error")) return "error";
  if (snapshot?.errors.some((item) => item.severity === "warning") || snapshot?.core.status === "warning" || snapshot?.provider.health === "warning") return "warning";
  if (chatBusy) return "thinking";
  if (snapshot?.trace.latest?.status === "running") return "streaming";
  if ((snapshot?.memory.totalVisible ?? 0) > 0) return "memory";
  return "idle";
}

function isTextEntryElement(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

function topmostVisibleWindow(windows: ConsoleWindow[]) {
  return windows.filter((item) => item.visible && !item.minimized).reduce<ConsoleWindow | null>((top, item) => (!top || item.zIndex > top.zIndex ? item : top), null);
}

// ── Main app ──

export default function GlitchCoreApp() {
  const [snapshot, setSnapshot] = useState<GlitchSnapshot | null>(null);
  const [windows, setWindows] = useState<ConsoleWindow[]>(() => loadLayout());
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [windowsMenuOpen, setWindowsMenuOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryCompact, setMemoryCompact] = useState(true);
  const [lastChatContent, setLastChatContent] = useState("");
  const [uiSettings, setUiSettings] = useState(() => loadUiSettings());
  const [characterAssets, setCharacterAssets] = useState<RinCharacterAsset[]>(RIN_CHARACTER_ASSETS);
  const [characterViews, setCharacterViews] = useState<CharacterViewMap>({});
  const [selectedCharacterId, setSelectedCharacterId] = useState(() => loadCharacterId());
  const [characterEditMode, setCharacterEditMode] = useState(false);
  const [galleryNotice, setGalleryNotice] = useState("");
  const [galleryBusy, setGalleryBusy] = useState(false);

  const instanceCounts = useRef(initialInstanceCounts(windows));
  const zCounter = useRef(Math.max(40, ...windows.map((item) => item.zIndex)));
  const openedTraceErrorIds = useRef(new Set<string>());
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const memoryQueryRef = useRef(memoryQuery);
  memoryQueryRef.current = memoryQuery;

  const coreVisualState = deriveCoreVisualState(snapshot, chatBusy);
  const selectedCharacterIndex = Math.max(0, characterAssets.findIndex((item) => item.id === selectedCharacterId));
  const selectedCharacter = characterAssets[selectedCharacterIndex] ?? characterAssets[0] ?? RIN_CHARACTER_ASSETS[0];
  const selectedCharacterView = normalizeCharacterView(characterViews[selectedCharacter.id], selectedCharacter);

  // ── stable callbacks ──

  const applyCharacterPayload = useCallback((payload: CharacterAssetsPayload, preferredAssetId?: string | null) => {
    const nextAssets = payload.assets.length > 0 ? payload.assets : RIN_CHARACTER_ASSETS;
    setCharacterAssets(nextAssets);
    setCharacterViews(payload.views ?? {});
    setSelectedCharacterId((current) => {
      if (preferredAssetId && nextAssets.some((item) => item.id === preferredAssetId)) return preferredAssetId;
      return nextAssets.some((item) => item.id === current) ? current : nextAssets[0]?.id ?? RIN_CHARACTER_ASSETS[0].id;
    });
  }, []);

  const selectCharacter = useCallback((characterId: string) => {
    setCharacterAssets((assets) => {
      if (assets.some((item) => item.id === characterId)) { setSelectedCharacterId(characterId); }
      return assets;
    });
  }, []);

  const cycleCharacter = useCallback(() => {
    setSelectedCharacterId((current) => {
      setCharacterAssets((assets) => {
        const currentIndex = assets.findIndex((item) => item.id === current);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % assets.length : 0;
        setSelectedCharacterId(assets[nextIndex]?.id ?? RIN_CHARACTER_ASSETS[0].id);
        return assets;
      });
      return current;
    });
  }, []);

  const handleBackgroundPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
    const y = (event.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
    event.currentTarget.style.setProperty("--parallax-x", x.toFixed(4));
    event.currentTarget.style.setProperty("--parallax-y", y.toFixed(4));
  }, []);

  const focusWindow = useCallback((id: string) => {
    zCounter.current += 1;
    setActiveWindowId(id);
    setWindows((items) => items.map((item) => item.id === id ? { ...item, zIndex: zCounter.current, minimized: false, visible: true } : item));
  }, []);

  const updateWindow = useCallback((id: string, patch: Partial<ConsoleWindow>) => {
    setWindows((items) => items.map((item) => item.id === id ? { ...item, ...patch, title: windowTitle(patch.type ?? item.type, patch.instanceNumber ?? item.instanceNumber, patch.contextName ?? item.contextName) } : item));
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows((items) => items.flatMap((item) => item.id !== id ? [item] : PERSISTENT_TYPES.has(item.type) ? [{ ...item, visible: false, minimized: false }] : []));
    setActiveWindowId((current) => current === id ? null : current);
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((items) => items.map((item) => item.id === id ? { ...item, minimized: true, visible: true } : item));
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    setWindows((items) => items.map((item) => item.id === id ? { ...item, maximized: !item.maximized, minimized: false } : item));
    focusWindow(id);
  }, [focusWindow]);

  const focusPanel = useCallback((id: string) => {
    zCounter.current += 1;
    setWindows((items) => items.map((item) => item.id === id ? { ...item, zIndex: zCounter.current, maximized: true, minimized: false, visible: true } : item.maximized ? { ...item, maximized: false } : item));
    setActiveWindowId(id);
  }, []);

  const restoreFocusMode = useCallback(() => { setWindows((items) => items.map((item) => ({ ...item, maximized: false }))); }, []);

  const resetLayout = useCallback(() => {
    const next = defaultWindows();
    instanceCounts.current = initialInstanceCounts(next);
    zCounter.current = 40;
    setWindows(next);
    setActiveWindowId(next[0]?.id ?? null);
  }, []);

  const restoreAll = useCallback(() => { setWindows((items) => items.map((item) => ({ ...item, minimized: false, visible: true }))); }, []);
  const minimizeAll = useCallback(() => { setWindows((items) => items.map((item) => ({ ...item, minimized: true }))); }, []);

  const openWindow = useCallback((type: WindowType, options: { contextName?: string; payload?: WindowPayload; focusExistingId?: string } = {}) => {
    if (options.focusExistingId) { focusWindow(options.focusExistingId); return; }
    const reusable = REUSABLE_WINDOW_TYPES.has(type) && !options.payload ? windows.find((item) => item.type === type && !item.payload && (!options.contextName || item.contextName === options.contextName)) : undefined;
    if (reusable) { focusWindow(reusable.id); return; }
    const next = (instanceCounts.current[type] ?? 0) + 1;
    instanceCounts.current[type] = next;
    zCounter.current += 1;
    const created = makeWindow(type, next, zCounter.current, { contextName: options.contextName, payload: options.payload });
    setWindows((items) => [...items, created]);
    setActiveWindowId(created.id);
  }, [focusWindow, windows]);

  const openErrorWindow = useCallback((error: GlitchErrorItem) => {
    const fingerprint = errorFingerprint(error);
    const existing = windows.find((item) => item.type === "error" && item.payload?.error && errorFingerprint(item.payload.error as GlitchErrorItem) === fingerprint);
    if (existing) {
      const existingError = existing.payload!.error as GlitchErrorItem;
      const repeatCount = (existingError.repeatCount ?? 1) + 1;
      zCounter.current += 1;
      setWindows((items) => items.map((item) => item.id === existing.id ? { ...item, zIndex: zCounter.current, minimized: false, visible: true, contextName: `${error.code} (×${repeatCount})`, title: windowTitle(item.type, item.instanceNumber, `${error.code} (×${repeatCount})`), payload: { error: { ...existingError, id: error.id, repeatCount } as GlitchErrorItem } } : item));
      setActiveWindowId(existing.id);
      return;
    }
    openWindow("error", { contextName: error.code, payload: { error: { ...error, repeatCount: 1 } } });
  }, [openWindow, windows]);

  // ── snapshot refresh (stable) ──

  const refreshSnapshot = useCallback(async (conversationId?: string | null) => {
    try {
      const payload = await fetchGlitchSnapshot(conversationId ?? snapshotRef.current?.selectedConversationId ?? null, memoryQueryRef.current);
      setSnapshot(payload);
    } catch (error) { openErrorWindow(compactError(error)); }
  }, [openErrorWindow]);

  // ── character view callbacks ──

  const updateSelectedCharacterView = useCallback((patch: Partial<CharacterViewSettingsPayload>) => {
    setCharacterViews((items) => {
      const base = normalizeCharacterView(items[selectedCharacter.id], selectedCharacter);
      return { ...items, [selectedCharacter.id]: normalizeCharacterView({ ...base, ...patch }, selectedCharacter) };
    });
  }, [selectedCharacter]);

  const commitSelectedCharacterView = useCallback(async (view: CharacterViewSettingsPayload) => {
    try { const payload = await saveCharacterAssetView(selectedCharacter.id, view); applyCharacterPayload(payload, selectedCharacter.id); }
    catch { /* silent — background sync; localStorage fallback already cached */ }
  }, [applyCharacterPayload, selectedCharacter.id]);

  const resetSelectedCharacterView = useCallback(async () => {
    setCharacterViews((items) => { const next = { ...items }; delete next[selectedCharacter.id]; return next; });
    setGalleryBusy(true);
    try { const payload = await resetCharacterAssetView(selectedCharacter.id); applyCharacterPayload(payload, selectedCharacter.id); setGalleryNotice("VIEW RESET"); }
    catch { setGalleryNotice("VIEW RESET FAILED"); }
    finally { setGalleryBusy(false); }
  }, [applyCharacterPayload, selectedCharacter.id]);

  const addCharacterFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) { setGalleryNotice("IMAGE FILES ONLY"); return; }
    const importedIds: string[] = [];
    setGalleryBusy(true);
    try {
      let latestPayload: CharacterAssetsPayload | null = null;
      for (const file of imageFiles) { const payload = await uploadCharacterAsset(file); latestPayload = payload; if (payload.selectedAssetId) importedIds.push(payload.selectedAssetId); }
      if (latestPayload) { applyCharacterPayload(latestPayload, importedIds[0] ?? latestPayload.selectedAssetId); setGalleryNotice(`ADDED ${importedIds.length} IMAGE${importedIds.length > 1 ? "S" : ""}`); }
    } catch { setGalleryNotice("IMAGE SAVE FAILED"); }
    finally { setGalleryBusy(false); }
  }, [applyCharacterPayload]);

  const deleteCharacter = useCallback(async (characterId: string) => {
    if (characterAssets.length <= 1) { setGalleryNotice("KEEP ONE IMAGE"); return; }
    const target = characterAssets.find((item) => item.id === characterId);
    if (!target) return;
    setGalleryBusy(true);
    try { const payload = await deleteCharacterAsset(characterId); applyCharacterPayload(payload); setGalleryNotice(target.custom ? "IMAGE DELETED" : "DEFAULT HIDDEN"); }
    catch { setGalleryNotice("DELETE FAILED"); }
    finally { setGalleryBusy(false); }
  }, [applyCharacterPayload, characterAssets]);

  const restoreDefaultCharacters = useCallback(async () => {
    setGalleryBusy(true);
    try { const payload = await restoreCharacterAssetDefaults(); applyCharacterPayload(payload, selectedCharacterId); setGalleryNotice("DEFAULTS RESTORED"); }
    catch { setGalleryNotice("RESTORE FAILED"); }
    finally { setGalleryBusy(false); }
  }, [applyCharacterPayload, selectedCharacterId]);

  const submitChat = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || chatBusy) return;
    setChatBusy(true);
    setLastChatContent(trimmed);
    try { const result = await sendChatMessage(trimmed, snapshotRef.current?.selectedConversationId); setChatInput(""); await refreshSnapshot(result.conversationId); }
    catch (error) { openErrorWindow(compactError(error)); }
    finally { setChatBusy(false); }
  }, [chatBusy, openErrorWindow, refreshSnapshot]);

  const searchMemory = useCallback(async () => {
    try {
      const cards = await fetchMemoryCards(memoryQueryRef.current);
      setSnapshot((current) => current ? { ...current, memory: { ...current.memory, cards, totalVisible: cards.length, query: memoryQueryRef.current } } : current);
    } catch (error) { openErrorWindow(compactError(error)); }
  }, [openErrorWindow]);

  const reviewMindCandidate = useCallback(async (candidateId: string, action: "approve" | "reject" | "deactivate" | "reactivate") => {
    try {
      if (action === "approve") await approveMindMemoryCandidate(candidateId); else if (action === "reject") await rejectMindMemoryCandidate(candidateId); else if (action === "deactivate") await deactivateMindMemoryCandidate(candidateId); else await reactivateMindMemoryCandidate(candidateId);
      await refreshSnapshot();
    } catch (error) { openErrorWindow(compactError(error)); }
  }, [openErrorWindow, refreshSnapshot]);

  const editMindCandidate = useCallback(async (candidateId: string, patch: MindCandidateSafePatch) => {
    try { await updateMindMemoryCandidateSafeFields(candidateId, patch); await refreshSnapshot(); }
    catch (error) { openErrorWindow(compactError(error)); }
  }, [openErrorWindow, refreshSnapshot]);

  const reviewGrowthEvent = useCallback(async (eventId: string, action: "approve" | "reject") => {
    try { if (action === "approve") await approveGrowthEvent(eventId); else await rejectGrowthEvent(eventId); await refreshSnapshot(); }
    catch (error) { openErrorWindow(compactError(error)); }
  }, [openErrorWindow, refreshSnapshot]);

  const reviewToolRequest = useCallback(async (requestId: string, action: "approve" | "reject") => {
    try { if (action === "approve") await approveToolRequest(requestId); else await rejectToolRequest(requestId); await refreshSnapshot(); }
    catch (error) { openErrorWindow(compactError(error)); }
  }, [openErrorWindow, refreshSnapshot]);

  const runSelfReviewAction = useCallback(async () => {
    try { await runSelfReview(); await refreshSnapshot(); }
    catch (error) { openErrorWindow(compactError(error)); }
  }, [openErrorWindow, refreshSnapshot]);

  const reviewImprovementProposal = useCallback(async (proposalId: string, action: "approve" | "reject" | "convert") => {
    try { if (action === "approve") await approveImprovementProposal(proposalId); else if (action === "reject") await rejectImprovementProposal(proposalId); else await convertImprovementProposalToCodexDraft(proposalId); await refreshSnapshot(); }
    catch (error) { openErrorWindow(compactError(error)); }
  }, [openErrorWindow, refreshSnapshot]);

  // ── effects ──

  useEffect(() => { localStorage.setItem(LAYOUT_KEY, JSON.stringify(windows)); }, [windows]);
  useEffect(() => { localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(uiSettings)); }, [uiSettings]);
  useEffect(() => { localStorage.setItem(CHARACTER_KEY, selectedCharacterId); }, [selectedCharacterId]);

  useEffect(() => {
    let cancelled = false;
    setGalleryBusy(true);
    void fetchCharacterAssets().then((payload) => { if (!cancelled) applyCharacterPayload(payload); }).catch(() => { if (!cancelled) setGalleryNotice("ASSET API OFFLINE"); }).finally(() => { if (!cancelled) setGalleryBusy(false); });
    return () => { cancelled = true; };
  }, [applyCharacterPayload]);

  useEffect(() => {
    if (!characterAssets.some((item) => item.id === selectedCharacterId)) {
      setSelectedCharacterId(characterAssets[0]?.id ?? RIN_CHARACTER_ASSETS[0].id);
    }
  }, [characterAssets, selectedCharacterId]);

  useEffect(() => {
    if (!galleryNotice) return;
    const timeout = window.setTimeout(() => setGalleryNotice(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [galleryNotice]);

  useEffect(() => { if (!activeWindowId && windows[0]) setActiveWindowId(windows[0].id); }, [activeWindowId, windows]);

  // Poll snapshot every 15s using stable refresh
  useEffect(() => {
    void refreshSnapshot(null);
    const timer = window.setInterval(() => void refreshSnapshot(), 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once — uses refs internally

  useEffect(() => {
    if (!snapshot) return;
    for (const error of snapshot.errors) {
      if (openedTraceErrorIds.current.has(error.id)) continue;
      openedTraceErrorIds.current.add(error.id);
      if (error.severity === "critical" || error.severity === "error") openErrorWindow(error);
    }
  }, [openErrorWindow, snapshot]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return;
      if (isTextEntryElement(event.target)) { event.preventDefault(); event.stopPropagation(); (event.target as HTMLElement).blur(); return; }
      if (windowsMenuOpen) { event.preventDefault(); event.stopPropagation(); setWindowsMenuOpen(false); return; }
      const focused = windows.find((item) => item.id === activeWindowId && item.visible && !item.minimized);
      const top = focused ?? topmostVisibleWindow(windows);
      if (!top) return;
      event.preventDefault(); event.stopPropagation();
      closeWindow(top.id);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeWindowId, closeWindow, windows, windowsMenuOpen]);

  // ── derived ──

  const visibleWindows = useMemo(() => windows.filter((item) => item.visible && !item.minimized), [windows]);
  const minimizedWindows = useMemo(() => windows.filter((item) => item.minimized), [windows]);
  const hiddenWindows = useMemo(() => windows.filter((item) => !item.visible), [windows]);
  const focusedWindow = visibleWindows.find((item) => item.maximized);
  const errorCount = snapshot?.errors.length ?? 0;

  // Memoize the windowContentProps to keep WindowContent stable
  const windowContentProps = useMemo(() => ({
    snapshot, chatInput, setChatInput, chatBusy, lastChatContent, submitChat,
    refreshSnapshot, memoryCompact, setMemoryCompact, memoryQuery, setMemoryQuery,
    searchMemory, reviewMindCandidate, editMindCandidate, reviewGrowthEvent,
    reviewToolRequest, runSelfReviewAction, reviewImprovementProposal,
    uiSettings, setUiSettings, selectedCharacter, selectedCharacterId: selectedCharacter.id,
    characterAssets, characterEditMode, setCharacterEditMode, resetSelectedCharacterView,
    addCharacterFiles, deleteCharacter, restoreDefaultCharacters, galleryNotice,
    galleryBusy, selectCharacter, nextCharacter: cycleCharacter, openWindow,
    openErrorWindow, closeWindow,
  }), [
    snapshot, chatInput, chatBusy, lastChatContent, submitChat, refreshSnapshot,
    memoryCompact, memoryQuery, searchMemory, reviewMindCandidate, editMindCandidate,
    reviewGrowthEvent, reviewToolRequest, runSelfReviewAction, reviewImprovementProposal,
    uiSettings, selectedCharacter.id, characterAssets, characterEditMode,
    resetSelectedCharacterView, addCharacterFiles, deleteCharacter, restoreDefaultCharacters,
    galleryNotice, galleryBusy, selectCharacter, cycleCharacter, openWindow,
    openErrorWindow, closeWindow,
  ]);

  return (
    <div className={`rin-os core-state-${coreVisualState} display-${uiSettings.displayMode} size-${uiSettings.displaySize} density-${uiSettings.density}`} onPointerMove={handleBackgroundPointerMove}>
      <div className="scanline-layer" />
      <TopMenu snapshot={snapshot} coreVisualState={coreVisualState} errorCount={errorCount} windows={windows} minimizedWindows={minimizedWindows} hiddenWindows={hiddenWindows} windowsMenuOpen={windowsMenuOpen} setWindowsMenuOpen={setWindowsMenuOpen} openWindow={openWindow} focusWindow={focusWindow} restoreAll={restoreAll} minimizeAll={minimizeAll} resetLayout={resetLayout} uiSettings={uiSettings} setUiSettings={setUiSettings} onNavigate={navigateWebShell} />
      <main className="workspace">
        <CoreBackground visualState={coreVisualState} selectedCharacter={selectedCharacter} selectedCharacterView={selectedCharacterView} characterEditMode={characterEditMode} updateCharacterView={updateSelectedCharacterView} commitCharacterView={commitSelectedCharacterView} />
        {focusedWindow ? <FocusNav windows={visibleWindows} activeWindowId={focusedWindow.id} onFocusPanel={focusPanel} onRestore={restoreFocusMode} /> : null}
        {visibleWindows.map((item) => (
          <WindowFrame key={item.id} win={item} active={item.id === activeWindowId} onFocus={focusWindow} onUpdate={updateWindow} onClose={closeWindow} onMinimize={minimizeWindow} onMaximize={toggleMaximize}>
            <WindowContent win={item} {...windowContentProps} />
          </WindowFrame>
        ))}
      </main>
    </div>
  );
}

// ── FocusNav (small, stable) ──

const FocusNav = memo(function FocusNav({ windows, activeWindowId, onFocusPanel, onRestore }: { windows: ConsoleWindow[]; activeWindowId: string; onFocusPanel: (id: string) => void; onRestore: () => void }) {
  const majorWindows = windows.filter((item) => ["purpose", "chat", "memory", "tasks", "body", "settings", "developer"].includes(item.type));
  return (
    <nav className="focus-nav" aria-label="Focus mode navigation">
      {majorWindows.map((item) => <button key={item.id} type="button" className={item.id === activeWindowId ? "active" : ""} onClick={() => onFocusPanel(item.id)}>{WINDOW_META[item.type].code}</button>)}
      <button type="button" onClick={onRestore}>RESTORE</button>
    </nav>
  );
});
