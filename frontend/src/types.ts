export type WindowType =
  | "core"
  | "chat"
  | "memory"
  | "memoryDetail"
  | "trace"
  | "provider"
  | "cost"
  | "mind"
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
  configurationStatus: string;
  streamingSupport: string;
  health: string;
  lastLatencyMs: number | string;
  lastError: string;
  availableProviders: Array<Record<string, unknown>>;
  safeConfig: Record<string, unknown>;
}

export interface CostUsageRecord {
  id: string;
  turnId: string | null;
  conversationId: string | null;
  providerId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  currency: string;
  estimateMethod: string;
  contextCharacterCount: number;
  createdAt: string;
  rawPromptIncluded: false;
  rawResponseIncluded: false;
  hiddenReasoningIncluded: false;
  secretValuesIncluded: false;
}

export interface CostSummary {
  ok: boolean;
  mode: string;
  readOnly: boolean;
  localOnly: boolean;
  provider: string;
  adapter: string;
  model: string;
  configured: boolean;
  configurationStatus: string;
  currency: string;
  priceConfig: Record<string, unknown>;
  eventCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalEstimatedCost: number;
  latest: CostUsageRecord | null;
  recent: CostUsageRecord[];
  rawPromptIncluded: false;
  rawResponseIncluded: false;
  hiddenReasoningIncluded: false;
  secretValuesIncluded: false;
}

export interface MindMessageUnderstanding {
  mode: string;
  secondaryModes: string[];
  intentSummary: string;
  topicTags: string[];
  emotionalTone: string;
  urgency: string;
  relationshipRelevance: string;
  memorySignalType: string;
  privacyRisk: string;
  confidence: number;
  reasons: string[];
}

export interface MindOwnerState {
  energyLevel: string;
  moodValence: string;
  arousalLevel: string;
  focusState: string;
  motivationState: string;
  immersionInertia: string;
  interruptionRisk: string;
  resultUrgency: string;
  supportNeed: string;
  confidence: number;
  evidenceMessageIds: string[];
  ttlHours: number;
  expiresAt: string;
}

export interface MindContextPlan {
  mode: string;
  ownerStateIncluded: boolean;
  selectedRecentMessageIds: string[];
  selectedMemoryTraceIds: string[];
  selectedMemorySourceIds: string[];
  selectedProfileSections: string[];
  selectedSummaryIds: string[];
  excludedItems: Array<{ id: string; kind: string; reason: string }>;
  budget: number;
  estimatedTokens: number;
  privacyFlags: Record<string, boolean>;
  exportAllowed: boolean;
  reasons: string[];
}

export interface MindRetrievalItem {
  sourceKind: string;
  sourceId: string;
  traceId: string;
  score: number;
  selected: boolean;
  reasons: string[];
  matchedTags: string[];
  salienceScore: number;
  confidence: number | null;
  safeSummary: string;
  normalizedValue: string | null;
  riskLevel: string;
  rawTextIncluded: false;
}

export interface MindMemoryRetrieval {
  selected: MindRetrievalItem[];
  excluded: MindRetrievalItem[];
  queryTags: string[];
  maxSelected: number;
  selectionPolicy: string;
  rawMemoryIncluded: false;
}

export interface MindMemoryCandidate {
  id: string;
  type: string;
  summary: string;
  safeSummary: string;
  normalizedValue: string | null;
  rawTextIncluded: false;
  redacted: boolean;
  sourceKind: string;
  language: string;
  sourceMessageIds: string[];
  confidence: number;
  salience: number;
  stability: string;
  decayPolicy: string;
  riskLevel: string;
  reviewStatus: string;
  active: boolean;
  tags: string[];
  evidenceHashes: string[];
  contradictionOf: string | null;
  supersedes: string | null;
  ownerConfirmed: boolean;
  autoPromote: boolean;
  reasons: string[];
}

export interface MindPolicyMetadata {
  contextMaxCharacters: number;
  recentHistorySelectedLimit: number;
  recentHistoryCandidateLimit: number;
  memoryRetrievalCandidateLimit: number;
  memoryMaxSelected: number;
  autopromoteConfidence: number;
  ownerStateTtlHours: number;
  enableEmbeddings: boolean;
  embeddingProvider: string;
  enableModelSummaries: boolean;
  enableAgentTools: boolean;
  allowHighRiskMemoryExport: boolean;
  selfModelAutoApply: boolean;
  warnings: string[];
  dangerousDefaultsDisabled: boolean;
  secretValuesIncluded: false;
}

export interface MindConversationSummary {
  id: string;
  conversationId: string;
  topicTags: string[];
  activeMode: string;
  recentDecisionHints: string[];
  preferenceHints: string[];
  correctionHints: string[];
  relationshipHints: string[];
  unresolvedHints: string[];
  lastUpdatedTurnId: string;
  sourceMessageCount: number;
  reviewStatus: string;
  modelGenerated: boolean;
  rawTextIncluded: false;
  createdAt: string;
  updatedAt: string;
}

export interface MindGrowthEvent {
  id: string;
  eventType: string;
  summary: string;
  sourceTurnId: string;
  sourceMessageId: string;
  candidate: Record<string, unknown>;
  riskLevel: string;
  reviewStatus: string;
  createdAt: string;
  appliedAt: string | null;
  active: boolean;
  rawTextIncluded: false;
}

export interface MindToolInvocationRequest {
  id: string;
  sourceTurnId: string;
  intent: string;
  toolName: string;
  actionSummary: string;
  riskLevel: string;
  requiresOwnerApproval: boolean;
  status: string;
  createdAt: string;
  rawInputIncluded: false;
  secretValuesIncluded: false;
}

export interface MindLifecycle {
  observed: boolean;
  understood: boolean;
  planned: boolean;
  responded: boolean;
  candidateGenerated: boolean;
  stored: boolean;
  awaitingReview: boolean;
  stages: string[];
  rawTextIncluded: false;
}

export interface MindResponsePlan {
  tone: string;
  length: string;
  directness: string;
  warmth: string;
  initiativeLevel: string;
  askFollowup: boolean;
  referenceMemory: boolean;
  provideStructure: boolean;
  provideComfort: boolean;
  challengeOwner: boolean;
  avoidOverexplaining: boolean;
  rinCharacterExpression: string;
  emotionalMirroring: string;
  nextActionStyle: string;
  reasons: string[];
}

export interface RinMindSnapshot {
  messageUnderstanding: MindMessageUnderstanding;
  ownerState: MindOwnerState;
  contextPlan: MindContextPlan;
  memoryRetrieval: MindMemoryRetrieval;
  memoryCandidates: MindMemoryCandidate[];
  conversationSummary: MindConversationSummary | null;
  growthEvents: MindGrowthEvent[];
  toolInvocationRequests: MindToolInvocationRequest[];
  responsePlan: MindResponsePlan;
  lifecycle: MindLifecycle;
  policy: MindPolicyMetadata;
  createdAt: string;
  safeForUi: true;
  rawTextIncluded: false;
  secretValuesIncluded: false;
}

export interface RinMindPayload {
  ok: boolean;
  mode: string;
  readOnly: boolean;
  localOnly: boolean;
  latest: RinMindSnapshot | null;
  candidateCount: number;
  memoryCandidates: MindMemoryCandidate[];
  policy: MindPolicyMetadata;
  growthEvents: MindGrowthEvent[];
  toolInvocationRequests: MindToolInvocationRequest[];
  embeddingStatus: {
    enabled: boolean;
    provider: string;
    entryCount: number;
    rawTextIncluded: false;
  };
  safeForUi: true;
  rawTextIncluded: false;
  rawPromptIncluded: false;
  rawMemoryIncluded: false;
  hiddenReasoningIncluded: false;
  secretValuesIncluded: false;
}

export interface MindCandidateActionResult {
  ok: boolean;
  mode: string;
  readOnly: boolean;
  localOnly: boolean;
  candidate: MindMemoryCandidate;
  rawTextIncluded: false;
  secretValuesIncluded: false;
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
  repeatCount?: number;
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
  cost: CostSummary;
  mind: RinMindPayload;
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
