"""Pydantic data contracts for the RIN Python runtime.

These models contain no database access, provider calls, or side effects.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ---- Domain type aliases ----
StorageDirectoryName = Literal["config", "databases", "logs", "attachments"]
ConversationRole = Literal["owner", "rin", "system"]
ConversationTurnStatus = Literal["started", "completed", "failed"]
MemoryType = Literal[
    "raw_log",
    "episodic",
    "semantic",
    "preference",
    "procedural",
    "goal",
    "project",
    "reflection",
    "identity",
]
MemorySkipReason = Literal[
    "not_relevant",
    "empty_snippet",
    "max_count_exceeded",
    "memory_budget_exceeded",
]
MemoryContextSource = Literal["deterministic", "semantic"]
ContextV2SegmentType = Literal[
    "system",
    "rin_profile",
    "owner_profile",
    "current_owner_message",
    "short_term_window",
    "memory_v2_trace",
    "older_reference",
]
ModelProvider = Literal["mock", "openai-compatible", "local", "custom"]
ModelErrorCode = Literal[
    "LOCAL_MODEL_TIMEOUT",
    "LOCAL_MODEL_UNAVAILABLE",
    "LOCAL_MODEL_MISSING",
    "MODEL_PROVIDER_ERROR",
    "MODEL_RESPONSE_INVALID",
]
ConversationErrorCode = ModelErrorCode | Literal["CONVERSATION_RUNTIME_ERROR"]
ReadinessStatus = Literal["pass", "warn", "fail"]


class RinBaseModel(BaseModel):
    """Shared strict model config for compatibility contracts."""

    model_config = ConfigDict(extra="forbid")


class RinDataManifest(RinBaseModel):
    project: Literal["RIN"]
    schemaVersion: Literal[1]
    ownerId: str
    deviceId: str
    createdAt: str
    updatedAt: str
    directories: dict[StorageDirectoryName, str]


class ModelRuntimeNote(RinBaseModel):
    """Bilingual note attached to the model runtime config."""

    english: str
    chinese: str


class ModelAdapterConfig(RinBaseModel):
    """Descriptor for one model adapter (Ollama, mock, or future external provider)."""

    id: str
    displayName: str
    provider: ModelProvider
    enabled: bool
    model: str | None
    baseUrl: str | None
    apiKeyEnv: str | None
    timeoutMs: int


class ModelRuntimeConfig(RinBaseModel):
    """Top-level model config: active adapter selection and adapter list."""

    schemaVersion: Literal[1]
    kind: Literal["model_config"]
    updatedAt: str
    activeAdapter: str
    adapters: list[ModelAdapterConfig]
    apiKeysStoredHere: bool
    note: ModelRuntimeNote


class RinProfile(RinBaseModel):
    """Manually editable local RIN profile: display name, communication style, boundaries."""

    schemaVersion: Literal[1]
    kind: Literal["rin_profile"]
    updatedAt: str
    displayName: str
    role: str
    communicationStyle: list[str]
    behaviorBoundaries: list[str]
    contextNotes: list[str]


class OwnerProfile(RinBaseModel):
    """Manually editable local owner profile: preferences, projects, context notes."""

    schemaVersion: Literal[1]
    kind: Literal["owner_profile"]
    ownerId: str
    updatedAt: str
    displayName: str
    communicationPreferences: list[str]
    stablePreferences: list[str]
    activeProjects: list[str]
    contextNotes: list[str]


class ProfileValidationIssue(RinBaseModel):
    file: Literal["rin_profile.json", "owner_profile.json"]
    code: str
    message: str


class ProfileFileStatus(RinBaseModel):
    file: Literal["rin_profile.json", "owner_profile.json"]
    exists: bool
    valid: bool
    issueCount: int
    summaryCounts: dict[str, int]


class ProfileReport(RinBaseModel):
    mode: Literal["profile-report"]
    status: Literal["valid", "invalid"]
    files: list[ProfileFileStatus]
    issueCount: int
    issues: list[ProfileValidationIssue]
    contextCharacterCount: int
    providerCallCount: Literal[0]
    fullTextIncluded: Literal[False]


class MemoryInjectionExplanation(RinBaseModel):
    memoryId: str
    memoryType: MemoryType
    matchedKeywords: list[str]
    overlapCount: int
    latinTokenMatchCount: int
    cjkBigramMatchCount: int
    normalizedQueryTokenCount: int
    typeMatchBonus: float
    matchedTypeSignals: list[str]
    matchedTags: list[str]
    tagMatchBonus: float
    importanceBonus: float
    confidenceAdjustment: float
    metadataBonus: float
    metadataSignals: list[str]
    contextSource: MemoryContextSource | None = None
    wasInjected: bool
    skippedReason: MemorySkipReason | None
    snippetLength: int


class MemoryInjectionTrace(RinBaseModel):
    """Trace of which memories were injected into a message's context and why."""

    injectedMemoryCount: int
    injectedMemoryIds: list[str]
    deterministicInjectedMemoryIds: list[str]
    semanticInjectedMemoryIds: list[str]
    semanticCandidateIds: list[str]
    semanticContextExpansionEnabled: bool
    memoryContextCharacterCount: int
    skippedByBudgetCount: int
    skippedByRelevanceCount: int
    skippedByMaxCountCount: int
    items: list[MemoryInjectionExplanation]


class ConversationRecord(RinBaseModel):
    id: str
    title: str
    createdAt: str
    updatedAt: str


class ConversationMessageRecord(RinBaseModel):
    id: str
    conversationId: str
    role: ConversationRole
    content: str
    modelAdapter: str | None
    createdAt: str
    memoryContext: MemoryInjectionTrace | None


class ConversationTurnRecord(RinBaseModel):
    id: str
    conversationId: str
    ownerMessageId: str
    rinMessageId: str | None
    status: ConversationTurnStatus
    attemptCount: int
    errorCode: str | None
    createdAt: str
    updatedAt: str
    completedAt: str | None
    failedAt: str | None


class MemoryV2TableStatus(RinBaseModel):
    name: Literal[
        "memory_v2_trace_sources",
        "memory_v2_traces",
        "memory_v2_trace_signals",
        "memory_v2_retrieval_events",
    ]
    exists: bool
    rowCount: int


class MemoryV2SchemaReport(RinBaseModel):
    mode: Literal["memory-v2-schema-report"]
    status: Literal["ready", "missing_tables"]
    migrationVersion: Literal[6]
    shadowOnly: Literal[False]
    productionRetrievalChanged: Literal[True]
    legacyMigrationSupported: Literal[True]
    productionRetrievalPath: Literal["memory-v2-legacy-traces-after-migration"]
    providerCallCount: Literal[0]
    fullTextIncluded: Literal[False]
    tables: list[MemoryV2TableStatus]


class MemoryV2SignalEvidence(RinBaseModel):
    rawTextIncluded: Literal[False]
    contentCharacterCount: int
    matchedPattern: str


class MemoryV2Signal(RinBaseModel):
    signalType: Literal[
        "recency",
        "preference",
        "project",
        "salience",
        "reinforcement",
        "decay",
        "conflict",
        "low_signal",
    ]
    signalKey: str
    signalWeight: float
    evidence: MemoryV2SignalEvidence


class MemoryV2TraceAnalysis(RinBaseModel):
    """Result of analyzing a message for Memory V2 trace promotion, reinforcement, or decay."""

    sourceMessageId: str
    sourceCreatedAt: str
    conversationId: str
    role: ConversationRole
    contentCharacterCount: int
    ageHours: float
    baseScore: float
    stabilityHours: float
    retentionScore: float
    decision: Literal["promoted", "reinforced", "weakened", "ignored"]
    reasons: list[
        Literal[
            "preference_signal",
            "project_signal",
            "daily_signal",
            "contradiction_signal",
            "low_signal",
            "reinforcement_signal",
            "decay_signal",
        ]
    ]
    signals: list[MemoryV2Signal]


class ContextV2ReportSegment(RinBaseModel):
    id: str
    type: ContextV2SegmentType
    sourceId: str
    provenance: str
    included: bool
    protected: bool
    characterCount: int
    skipReason: Literal[
        "included",
        "duplicate_source",
        "budget_exceeded",
        "missing_source",
    ]


class ContextV2Report(RinBaseModel):
    """Report produced by the Context V2 assembler: what was included, skipped, and why."""

    mode: Literal["context-v2-report"]
    status: Literal["ready"]
    shadowOnly: Literal[True]
    productionContextChanged: Literal[False]
    providerCallCount: Literal[0]
    fullTextIncluded: Literal[False]
    maxCharacters: int
    totalInputSegments: int
    includedSegments: int
    skippedSegments: int
    characterCount: int
    budgetExceeded: bool
    latestOwnerMessagePreserved: bool
    order: list[ContextV2SegmentType]
    segments: list[ContextV2ReportSegment]


class ModelMessage(RinBaseModel):
    role: Literal["system", "owner", "rin"]
    content: str


class ModelRequest(RinBaseModel):
    messages: list[ModelMessage]
    ownerId: str
    conversationId: str


class ModelResponseMetadata(RinBaseModel):
    """Metadata attached to a model response: raw content stats, sanitization flags, thinking detection."""

    externalProvider: bool
    memoryWriteRequested: bool
    toolCallRequested: bool
    rawContentLength: int | None = Field(default=None, exclude=True)
    rawContentHash: str | None = Field(default=None, exclude=True)
    rawPreview: str | None = Field(default=None, exclude=True)
    rawModelOutputIncluded: bool = Field(default=False, exclude=True)
    thinkingTagDetected: bool | None = Field(default=None, exclude=True)
    thinkingLikePrefixDetected: bool | None = Field(default=None, exclude=True)
    adapterSanitized: bool | None = Field(default=None, exclude=True)
    adapterRemovedCharacterCount: int | None = Field(default=None, exclude=True)
    sanitizedContentLength: int | None = Field(default=None, exclude=True)
    sanitizerRejectionReason: str | None = Field(default=None, exclude=True)


class ModelResponse(RinBaseModel):
    content: str
    adapterId: str
    metadata: ModelResponseMetadata


class ModelErrorDetails(RinBaseModel):
    baseUrl: str | None = None
    model: str | None = None
    emptyContent: bool | None = None
    emptyAfterThinkingRemoval: bool | None = None
    possibleReasoningOnlyOutput: bool | None = None
    thinkingArtifactRemoved: bool | None = None
    unsafeContentIssue: str | None = None
    responseFields: list[str] | None = None


class ConversationErrorDetails(ModelErrorDetails):
    turnId: str | None = None
    conversationId: str | None = None
    ownerMessageId: str | None = None
    turnStatus: ConversationTurnStatus | None = None


class ConversationErrorPayload(RinBaseModel):
    code: ConversationErrorCode
    message: str
    recovery: list[str]
    modelAdapter: str | None
    provider: str
    retryable: bool
    details: ConversationErrorDetails


class ConversationErrorBody(RinBaseModel):
    ok: Literal[False]
    error: ConversationErrorPayload


class ReadinessCheck(RinBaseModel):
    key: str
    status: ReadinessStatus
    english: str
    chinese: str


class RinReadinessReport(RinBaseModel):
    ok: bool
    readyForExternalModel: bool
    readyForLocalModel: bool
    readyForLiveModel: bool
    missingEnvironment: list[str]
    checks: list[ReadinessCheck]
