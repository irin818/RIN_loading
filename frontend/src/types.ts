import type { BodyReportPayload } from "./body/types";

export type WindowType =
  | "core"
  | "body"
  | "chat"
  | "memory"
  | "memoryDetail"
  | "context"
  | "trace"
  | "cognition"
  | "provider"
  | "cost"
  | "mind"
  | "error"
  | "tasks"
  | "tools"
  | "control"
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
  hiddenReasoningIncluded?: false;
  hiddenReasoningRedacted?: boolean;
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
  pricingProfile?: string;
  pricingUnit?: string;
  currencyOfficial?: string;
  displayCurrency?: string;
  usageSource?: string;
  cacheBreakdownAvailable?: boolean;
  inputCacheHitTokens?: number | null;
  inputCacheMissTokens?: number | null;
  minEstimatedCostUsd?: number | null;
  maxEstimatedCostUsd?: number | null;
  configuredEstimatedCostUsd?: number | null;
  configuredEstimatedCostCny?: number | null;
  officialBillingMatch?: "exact" | "estimate" | "unavailable" | string;
  explanation?: string;
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
  pricingProfile: string;
  pricingUnit: string;
  currencyOfficial: string;
  displayCurrency: string;
  usdCnyRate: number | null;
  usageSource: string;
  cacheBreakdownAvailable: boolean;
  inputCacheHitTokens: number | null;
  inputCacheMissTokens: number | null;
  minEstimatedCostUsd: number | null;
  maxEstimatedCostUsd: number | null;
  configuredEstimatedCostUsd: number | null;
  configuredEstimatedCostCny: number | null;
  officialBillingMatch: "exact" | "estimate" | "unavailable" | string;
  cacheHitRatioEstimate: number;
  explanation: string;
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

export interface ConsoleDataMapDomain {
  id: string;
  label: string;
  color: string;
}

export interface ConsoleDataMapBlock {
  id: string;
  label: string;
  domain: string;
  sourceEndpoint: string;
  sourceFunction: string;
  fieldSummary: string;
  safetyLevel: string;
  rawTextIncluded: false;
  secretValuesIncluded: false;
  writable: boolean;
  controlActions: string[];
  recommendedPanel: string;
  recommendedVisualization: string;
  dataCompleteness: string;
  developerOnly: boolean;
  chartPotential: boolean;
  hasGovernanceActions: boolean;
  notes: string;
}

export interface ConsoleDataMap {
  ok: boolean;
  mode: "console-data-map";
  readOnly: true;
  localOnly: true;
  rawPromptIncluded: false;
  rawMemoryIncluded: false;
  hiddenReasoningIncluded: false;
  secretValuesIncluded: false;
  domains: ConsoleDataMapDomain[];
  dataBlocks: ConsoleDataMapBlock[];
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
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface MemoryCandidateAnalytics {
  candidateId: string;
  shortId: string;
  type: string;
  safeSummary: string;
  normalizedValue: string | null;
  riskLevel: string;
  reviewStatus: string;
  active: boolean;
  ownerConfirmed: boolean;
  autoPromote: boolean;
  salience: number;
  confidence: number;
  stability: string;
  decayPolicy: string;
  memoryStrength: number;
  thresholds: { weakening: number; forgetting: number };
  predictedDecayPoints: Array<{ at: string; elapsedHours: number; memoryStrength: number }>;
  eventMarkers: Array<{ type: string; at: string | null; label: string }>;
  retrievalEvents: Array<Record<string, unknown>>;
  contextInjectionEvents: Array<Record<string, unknown>>;
  selectedInCurrentContext: boolean;
  tags: string[];
  reasons: string[];
  contradictionOf: string | null;
  supersedes: string | null;
  sourceKind: string;
  createdAt: string | null;
  updatedAt: string | null;
  explanation: string;
  historyStatus: string;
  rawTextIncluded: false;
  secretValuesIncluded: false;
}

export interface MindMemoryAnalytics {
  ok: boolean;
  mode: string;
  readOnly: boolean;
  localOnly: boolean;
  counts: {
    total: number;
    byReviewStatus: Record<string, number>;
    byRiskLevel: Record<string, number>;
    byType: Record<string, number>;
    active: number;
    inactive: number;
  };
  strongest: MemoryCandidateAnalytics[];
  pendingReview: MemoryCandidateAnalytics[];
  nearDecayThreshold: MemoryCandidateAnalytics[];
  selectedInCurrentContextIds: string[];
  candidates: MemoryCandidateAnalytics[];
  thresholds: { weakening: number; forgetting: number };
  formula: string;
  explanation: string;
  rawTextIncluded: false;
  rawPromptIncluded: false;
  rawMemoryIncluded: false;
  hiddenReasoningIncluded: false;
  secretValuesIncluded: false;
}

export interface MindContextAnalytics {
  ok: boolean;
  mode: string;
  readOnly: boolean;
  localOnly: boolean;
  turnCreatedAt: string | null;
  flow: string[];
  budget: {
    maxCharacters: number;
    estimatedTokens: number;
    segments: Array<{ type: string; included: boolean; count: number; estimatedTokens: number }>;
  };
  sources: Array<{
    sourceKind: string;
    sourceId: string;
    fullSourceIdIncluded: false;
    included: boolean;
    reason: string;
    riskLevel: string;
    estimatedChars: number;
    estimatedTokens: number;
    safePreview: string;
    rawTextIncluded: false;
  }>;
  providerRequestOutline: {
    messageCount: number;
    selectedMemoryCount: number;
    excludedMemoryCount: number;
    currentOwnerInputLast: boolean;
    rawPromptIncluded: false;
  };
  explanation: string;
  rawReasons: string[];
  privacyFlags: Record<string, boolean>;
  rawTextIncluded: false;
  rawPromptIncluded: false;
  rawMemoryIncluded: false;
  hiddenReasoningIncluded: false;
  secretValuesIncluded: false;
}

export interface MindOwnerStateTrend {
  ok: boolean;
  mode: string;
  readOnly: boolean;
  localOnly: boolean;
  recentLimit: number;
  points: Array<Record<string, string | number>>;
  explanation: string;
  rawTextIncluded: false;
  rawPromptIncluded: false;
  secretValuesIncluded: false;
}

export interface MindTraceAnalytics {
  ok: boolean;
  mode: string;
  readOnly: boolean;
  localOnly: boolean;
  latest: {
    turnId: string | null;
    turnShortId: string;
    status: string;
    totalDurationMs: number;
    providerDurationMs: number;
    stageCount: number;
    warningCount: number;
    errorCount: number;
    currentOwnerInputLast: boolean;
    rawPromptIncluded: false;
    hiddenReasoningIncluded: false;
  };
  stages: Array<{
    name: string;
    displayName: string;
    status: string;
    durationMs: number;
    summary: string;
    startedAt: string;
    endedAt: string;
  }>;
  recent: Array<{ turnId: string; turnShortId: string; status: string; totalDurationMs: number }>;
  rawPromptIncluded: false;
  rawMemoryIncluded: false;
  hiddenReasoningIncluded: false;
  secretValuesIncluded: false;
}

export interface RinMindAnalytics {
  ok: boolean;
  mode: string;
  readOnly: boolean;
  localOnly: boolean;
  memory: MindMemoryAnalytics;
  context: MindContextAnalytics;
  ownerStateTrend: MindOwnerStateTrend;
  trace: MindTraceAnalytics;
  rawTextIncluded: false;
  rawPromptIncluded: false;
  rawMemoryIncluded: false;
  hiddenReasoningIncluded: false;
  secretValuesIncluded: false;
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
  analytics?: RinMindAnalytics;
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

export interface CognitionFlowStep {
  id: string;
  label: string;
  stageName: string;
  status: string;
  durationMs: number;
  summary: string;
  localOnly: boolean;
  sentToProvider: boolean;
  details: Record<string, unknown>;
  rawTextIncluded: false;
  rawPromptIncluded: false;
  rawMemoryIncluded: false;
  rawModelOutputIncluded: false;
  hiddenReasoningIncluded: false;
  secretValuesIncluded: false;
}

export interface CognitionFlowPayload {
  ok: boolean;
  mode: string;
  readOnly: boolean;
  localOnly: boolean;
  turnId: string | null;
  turnShortId: string;
  traceAvailable: boolean;
  snapshotAvailable: boolean;
  status: string;
  createdAt: string | null;
  ownerInput: {
    inputLength: string | number;
    inputHash: string;
    latestOwnerInputPreservedAsFinalOwnerMessage: boolean;
    rawTextIncluded: false;
  };
  steps: CognitionFlowStep[];
  contextSegments: Array<Record<string, unknown>>;
  localOnlyDecisions: Array<Record<string, unknown>>;
  providerSentContext: Record<string, unknown>;
  providerResponseMetadata: Record<string, unknown>;
  sanitizer: Record<string, unknown>;
  finalAnswer: Record<string, unknown>;
  turnImpact: Record<string, unknown>;
  dangerousCapabilities: Array<Record<string, unknown>>;
  trace: RuntimeTrace | null;
  rawPromptIncluded: false;
  rawMemoryIncluded: false;
  rawModelOutputIncluded: false;
  hiddenReasoningIncluded: false;
  secretValuesIncluded: false;
}

export interface ConfigRegistrySection {
  id: string;
  label: string;
  description: string;
}

export interface ConfigRegistryItem {
  key: string;
  displayName: string;
  currentValue: unknown;
  defaultValue: unknown;
  source: string;
  editable: boolean;
  riskLevel: string;
  requiresRestart: boolean;
  requiresOwnerConfirm: boolean;
  affects: string[];
  description: string;
  lastUpdatedAt: string | null;
  auditRequired: boolean;
  rollbackAvailable: boolean;
  secretValueIncluded: false;
  envName?: string | null;
}

export interface ConfigRegistryPayload {
  ok: boolean;
  mode: string;
  readOnly: true;
  localOnly: true;
  rawPromptIncluded: false;
  rawMemoryIncluded: false;
  hiddenReasoningIncluded: false;
  secretValuesIncluded: false;
  sections: ConfigRegistrySection[];
  items: ConfigRegistryItem[];
}

export interface SelfReviewReport {
  id: string;
  summary: string;
  observations: Array<Record<string, unknown>>;
  proposalIds: string[];
  riskLevel: string;
  status: string;
  createdAt: string;
  rawTextIncluded: false;
  secretValuesIncluded: false;
}

export interface ImprovementProposal {
  id: string;
  reportId: string | null;
  type: string;
  title: string;
  problemSummary: string;
  evidence: Array<Record<string, unknown>>;
  affectedModules: string[];
  riskLevel: string;
  expectedBenefit: string;
  implementationSketch: string;
  testPlan: string;
  rollbackPlan: string;
  requiresCodex: boolean;
  requiresOwnerApproval: boolean;
  priority: string;
  status: string;
  estimatedComplexity: string;
  safetyImpact: string;
  dataPrivacyImpact: string;
  codexPromptDraft: string | null;
  createdAt: string;
  updatedAt: string;
  rawTextIncluded: false;
  secretValuesIncluded: false;
  executionEnabled: false;
}

export interface SelfReviewPayload {
  ok: boolean;
  mode: string;
  readOnly: boolean;
  localOnly: boolean;
  manualOnly: boolean;
  latestReportId: string | null;
  reports: SelfReviewReport[];
  proposalCount: number;
  allowedLevel: number;
  level4PlusLocked: boolean;
  rawTextIncluded: false;
  rawPromptIncluded: false;
  rawMemoryIncluded: false;
  hiddenReasoningIncluded: false;
  secretValuesIncluded: false;
}

export interface ImprovementProposalsPayload {
  ok: boolean;
  mode: string;
  readOnly: boolean;
  localOnly: boolean;
  executionEnabled: false;
  autoPrEnabled: false;
  autoCodeWriteEnabled: false;
  proposals: ImprovementProposal[];
  rawTextIncluded: false;
  rawPromptIncluded: false;
  rawMemoryIncluded: false;
  hiddenReasoningIncluded: false;
  secretValuesIncluded: false;
}

export interface ImprovementProposalActionResult {
  ok: boolean;
  mode: string;
  readOnly: false;
  localOnly: true;
  proposal: ImprovementProposal;
  executed: false;
  codeWritten: false;
  pullRequestCreated: false;
  rawTextIncluded: false;
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

export interface MindCandidateSafePatch {
  safeSummary?: string;
  normalizedValue?: string | null;
  tags?: string[];
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
    activeBodyRenderer: string;
    bodyRendererLabel: string;
    bodyManifestPath: string;
    cubismStatus: string;
    animationEnabledByDefault: boolean;
  };
  body: BodyReportPayload;
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
    body: {
      status: string;
      adapterId: string;
      activeRenderer: string;
      assetMode: string;
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
  cognitionFlow: CognitionFlowPayload;
  configRegistry: ConfigRegistryPayload;
  selfReview: SelfReviewPayload;
  improvementProposals: ImprovementProposalsPayload;
  dataMap: ConsoleDataMap;
  errors: GlitchErrorItem[];
  windows: Record<string, unknown>;
}

export interface GrowthEventActionResult {
  ok: boolean;
  mode: string;
  readOnly: false;
  localOnly: true;
  event: MindGrowthEvent;
  autoApplied: false;
  rawTextIncluded: false;
  secretValuesIncluded: false;
}

export interface ToolRequestActionResult {
  ok: boolean;
  mode: string;
  readOnly: false;
  localOnly: true;
  request: MindToolInvocationRequest;
  executed: false;
  executionDisabledByDefault: true;
  rawInputIncluded: false;
  secretValuesIncluded: false;
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
