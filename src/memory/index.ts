export {
  createMemoryProposal,
  getMemoryItem,
  getMemoryCounts,
  listMemoryItems,
  maybeCreateOwnerMemoryProposal,
  reviewMemoryProposal,
  updateMemoryMetadata,
} from "./manager";
export type {
  MemoryConfidence,
  MemoryImportance,
  MemoryMetadata,
  MemoryMetadataInput,
  MemoryProposal,
  MemoryRecord,
  MemoryReviewDecision,
  MemoryStatus,
  MemoryType,
} from "./manager";
export {
  buildRetrievalTokenProfile,
  normalizeLatinToken,
  preprocessText,
  scoreRetrievalOverlap,
} from "./retrievalTokens";
export {
  DEFAULT_FIXTURE_EMBEDDING_DIMENSION,
  DEFAULT_LOCAL_EMBEDDING_PROVIDER_CONFIG,
  DEFAULT_LOCAL_EMBEDDING_TIMEOUT_MS,
  DISABLED_LOCAL_EMBEDDING_PROVIDER_ID,
  FIXTURE_SEMANTIC_EMBEDDING_PROVIDER_ID,
  LocalEmbeddingProviderError,
  classifyLocalEmbeddingError,
  cosineSimilarity,
  createFixtureSemanticEmbeddingProvider,
  createOllamaLocalEmbeddingProvider,
  createUnsupportedLocalEmbeddingProvider,
  dotProduct,
  evaluateLocalEmbeddingProviderReadiness,
  normalizeVector,
} from "./semanticEmbedding";
export { createInMemoryVectorIndex } from "./vectorIndex";
export { generateFixtureSemanticCandidates } from "./semanticPrototype";
export {
  formatTempSemanticEmbeddingEvaluationSummary,
  isDefaultTempSemanticProvider,
  runBuiltInTempSemanticEmbeddingEvaluation,
  runTempSemanticEmbeddingEvaluation,
} from "./semanticTempEvaluation";
export {
  deterministicCandidateIdsForMemories,
  formatSemanticAcceptedMemoryIndexReport,
  runSemanticAcceptedMemoryIndexReport,
} from "./semanticAcceptedMemoryIndex";
export {
  formatHybridRetrievalReport,
  runHybridRetrievalReport,
} from "./hybridRetrievalReport";
export {
  formatSemanticTraceList,
  formatSemanticTraceRecord,
  getSemanticTraceRecord,
  listSemanticTraceRecords,
  recordSemanticTrace,
  semanticTraceFromAcceptedMemoryIndexReport,
  semanticTraceFromHybridRetrievalReport,
} from "./semanticTrace";
export { selectSemanticContextExpansionCandidates } from "./semanticContextExpansion";
export {
  analyzeMemoryMaintenance,
  formatMemoryMaintenanceReport,
} from "./maintenance";
export {
  buildMemoryConflictReport,
  buildMemoryGovernanceSmokeReport,
  buildMemoryHealthReport,
  formatMemoryConflictReport,
  formatMemoryGovernanceSmokeReport,
  formatMemoryHealthReport,
} from "./governance";
export {
  formatSemanticReadinessReport,
  getSemanticReadinessReport,
} from "./semanticReadiness";
export {
  buildMemoryV2SchemaReport,
  formatMemoryV2SchemaReport,
} from "./v2Schema";
export {
  buildShortTermMemoryReport,
  formatShortTermMemoryReport,
} from "./shortTermMemory";
export {
  formatSemanticLiveReadinessReport,
  getSemanticLiveReadinessReport,
  readSemanticLiveEmbeddingConfig,
} from "./semanticLiveReadiness";
export type {
  RetrievalMatchResult,
  RetrievalTokenProfile,
} from "./retrievalTokens";
export type {
  LocalEmbeddingProviderConfig,
  LocalEmbeddingErrorCode,
  LocalEmbeddingProvider,
  LocalEmbeddingProviderReadiness,
  LocalEmbeddingResult,
  LocalEmbeddingTextInput,
  SemanticEmbeddingInput,
  SemanticEmbeddingProvider,
  SemanticEmbeddingProviderKind,
  SemanticEmbeddingResult,
  SemanticEmbeddingVector,
} from "./semanticEmbedding";
export type {
  InMemoryVectorIndex,
  VectorIndexEntry,
  VectorIndexMatch,
  VectorIndexQueryOptions,
} from "./vectorIndex";
export type {
  FixtureSemanticCandidateGenerationOptions,
  FixtureSemanticCandidateGenerationResult,
  FixtureSemanticPrototypeMemory,
} from "./semanticPrototype";
export type {
  TempSemanticEmbeddingEvaluationOptions,
  TempSemanticEmbeddingEvaluationResult,
  TempSemanticEmbeddingRecord,
} from "./semanticTempEvaluation";
export type {
  SemanticAcceptedMemoryIndexOptions,
  SemanticAcceptedMemoryIndexProviderMode,
  SemanticAcceptedMemoryIndexReport,
  SemanticAcceptedMemoryIndexStatus,
} from "./semanticAcceptedMemoryIndex";
export type {
  HybridRetrievalReport,
  HybridRetrievalReportOptions,
  HybridRetrievalReportStatus,
} from "./hybridRetrievalReport";
export type {
  SemanticTraceKind,
  SemanticTraceListOptions,
  SemanticTracePayload,
  SemanticTraceRecord,
} from "./semanticTrace";
export type { SemanticContextExpansionResult } from "./semanticContextExpansion";
export type {
  MemoryMaintenanceOptions,
  MemoryMaintenanceReason,
  MemoryMaintenanceReport,
  MemoryMaintenanceSuggestion,
} from "./maintenance";
export type {
  MemoryArchiveSuggestion,
  MemoryConflictReport,
  MemoryConflictSuggestion,
  MemoryGovernanceReason,
  MemoryGovernanceSmokeReport,
  MemoryHealthReport,
  MemoryMergeSuggestion,
} from "./governance";
export type {
  SemanticReadinessCheck,
  SemanticReadinessReport,
} from "./semanticReadiness";
export type {
  SemanticLiveReadinessEnvironment,
  SemanticLiveReadinessReport,
} from "./semanticLiveReadiness";
export type {
  MemoryV2SchemaReport,
  MemoryV2TableName,
  MemoryV2TableStatus,
} from "./v2Schema";
export type {
  ShortTermMemoryMessageRef,
  ShortTermMemoryReport,
  ShortTermMemoryReportOptions,
  ShortTermMemoryRoleCounts,
} from "./shortTermMemory";
export {
  DEFAULT_MAX_INJECTED_MEMORIES,
  DEFAULT_MAX_SNIPPET_CHARACTERS,
  finalizeInjectionExplanations,
  memorySnippetText,
  retrieveAcceptedMemoriesWithExplanation,
  selectRelevantAcceptedMemories,
  summarizeMemoryInjection,
  toMemoryInjectionTrace,
} from "./retrieval";
export type {
  AcceptedMemoryRetrievalResult,
  AcceptedMemorySnippet,
  MemoryContextSource,
  MemoryInjectionExplanation,
  MemoryInjectionTrace,
  MemoryRetrievalOptions,
  MemorySkipReason,
} from "./retrieval";
export {
  evaluateMemoryCase,
  formatMemoryEvaluationSummary,
  runBuiltInMemoryEvaluation,
  runMemoryEvaluationCases,
  summarizeMemoryEvaluationCategories,
} from "./evaluation";
export {
  evaluateSemanticComparisonCase,
  formatSemanticComparisonSummary,
  runBuiltInSemanticComparisonEvaluation,
  runSemanticComparisonCases,
  summarizeSemanticComparisonCategories,
} from "./semanticEvaluation";
export { BUILT_IN_MEMORY_EVALUATION_CASES } from "./evaluationFixtures";
export { BUILT_IN_SEMANTIC_COMPARISON_CASES } from "./semanticEvaluationFixtures";
export type {
  MemoryEvaluationCategorySummary,
  MemoryEvaluationCaseResult,
  MemoryEvaluationRunResult,
} from "./evaluation";
export type {
  SemanticComparisonCaseResult,
  SemanticComparisonCategorySummary,
  SemanticComparisonContextBudgetImpact,
  SemanticComparisonPrivacyCheck,
  SemanticComparisonRunResult,
} from "./semanticEvaluation";
export type {
  MemoryEvaluationCase,
  MemoryEvaluationCategory,
  MemoryEvaluationMemoryInput,
} from "./evaluationFixtures";
export type {
  SemanticComparisonCase,
  SemanticComparisonCategory,
  SemanticComparisonMemoryInput,
} from "./semanticEvaluationFixtures";
