export type WindowType =
  | "core"
  | "chat"
  | "memory"
  | "memoryDetail"
  | "trace"
  | "provider"
  | "error"
  | "tasks"
  | "tools"
  | "settings"
  | "system";

export type WindowPayload = Record<string, unknown>;

export interface ConsoleWindow {
  id: string;
  type: WindowType;
  instanceNumber: number;
  contextName: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  visible: boolean;
  payload?: WindowPayload;
}

export interface ConversationSummary {
  id: string;
  shortId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  shortId: string;
  role: "owner" | "rin" | "system" | string;
  content: string;
  createdAt: string;
  fullTextIncluded: boolean;
}

export interface MemoryCard {
  id: string;
  shortId: string;
  kind: string;
  type: string;
  title: string;
  summary: string;
  contentPreview: string;
  source: string;
  sourceMessageId: string;
  linkedSession: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
  confidence: string;
  importance: string;
  salienceScore: number | string;
  tags: string[];
  metadata: Record<string, unknown>;
  readOnly: boolean;
  fullTextIncluded: boolean;
}

export interface RuntimeTraceStage {
  name: string;
  displayName: string;
  status: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  summary: string;
  input?: Record<string, unknown>;
  operation?: Record<string, unknown>;
  output?: Record<string, unknown>;
  decision?: Record<string, unknown>;
  privacy?: Record<string, unknown>;
}

export interface RuntimeTrace {
  turnId: string;
  turnShortId: string;
  conversationId: string;
  conversationShortId: string;
  status: string;
  errorCode?: string;
  totalDurationMs: number;
  privacyMode: string;
  stages: RuntimeTraceStage[];
  analysis?: Record<string, unknown>;
}

export interface ProviderStatus {
  activeProvider: string;
  activeAdapter: string;
  activeModel: string;
  configured: boolean;
  streamingSupport: string;
  health: string;
  lastLatencyMs: number | string;
  lastError: string;
  availableProviders: Array<Record<string, unknown>>;
  safeConfig: Record<string, unknown>;
}

export interface GlitchErrorItem {
  id: string;
  code: string;
  severity: "info" | "warning" | "error" | "critical" | string;
  module: string;
  message: string;
  lastStep: string;
  turnId?: string;
  traceAvailable: boolean;
}

export interface GlitchSnapshot {
  ok: boolean;
  mode: string;
  readOnly: boolean;
  localOnly: boolean;
  version: string;
  fullTextIncluded: boolean;
  rawPromptIncluded: boolean;
  rawModelOutputIncluded: boolean;
  hiddenReasoningIncluded: boolean;
  secretValuesIncluded: boolean;
  externalProviderCallCount: number;
  core: {
    name: string;
    status: string;
    mode: string;
    avatarAssetPath: string;
    replaceableImageNote: string;
    animationEnabledByDefault: boolean;
  };
  dashboard: {
    readiness: { ok: boolean; label: string };
    adapter: string;
    model: string;
    serverMode: string;
    externalProviderCallCount: number;
    database: { schemaVersion: number; conversations: number; messages: number };
    memoryContext: {
      available: boolean;
      memoryV2Traces: number;
      fullTextIncluded: boolean;
      ringFillPercent: number;
    };
    activeConversation: {
      id: string | null;
      messageCount: number;
      ownerMessages: number;
      rinMessages: number;
    };
    health: Record<string, string>;
  };
  conversations: ConversationSummary[];
  selectedConversationId: string | null;
  messages: ChatMessage[];
  memory: {
    cards: MemoryCard[];
    totalVisible: number;
    query: string;
    compactDefault: boolean;
    readOnly: boolean;
    fullTextIncluded: boolean;
  };
  trace: {
    latest: RuntimeTrace | null;
    recent: RuntimeTrace[];
    readOnly: boolean;
    rawPromptIncluded: boolean;
    rawModelOutputIncluded: boolean;
    hiddenReasoningIncluded: boolean;
  };
  provider: ProviderStatus;
  errors: GlitchErrorItem[];
  windows: Record<string, unknown>;
}

export interface ChatSendResult {
  ok: boolean;
  status: string;
  conversationId: string;
  turnId: string;
  elapsedMs: number;
  errorCode: string | null;
  ownerMessage: ChatMessage | null;
  rinMessage: ChatMessage | null;
  finalAnswer: string;
  externalProviderCallCount: number;
  rawThinkingStored: boolean;
  rawModelOutputIncluded: boolean;
  hiddenReasoningIncluded: boolean;
}
