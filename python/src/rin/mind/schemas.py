"""Safe schemas for RIN Mind Core v1.

These models are deterministic local-state artifacts. They do not contain raw
prompts, secret values, hidden reasoning, or direct model output.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MessageMode = Literal[
    "daily_chat",
    "companionship",
    "emotional_state",
    "self_reflection",
    "preference_expression",
    "memory_correction",
    "rin_relationship",
    "rin_development",
    "learning_support",
    "life_routine",
    "motivation_support",
    "entertainment",
    "game",
    "aesthetic",
    "meta_discussion",
    "practical_assist",
]
EnergyLevel = Literal["low", "medium", "high", "unknown"]
MoodValence = Literal["negative", "neutral", "positive", "unknown"]
ArousalLevel = Literal["calm", "activated", "stressed", "unknown"]
FocusState = Literal["scattered", "stable", "immersed", "blocked", "unknown"]
MotivationState = Literal["low", "normal", "high", "unstable", "unknown"]
StateLevel = Literal["low", "medium", "high", "unknown"]
SupportNeed = Literal["answer", "structure", "comfort", "push", "quiet_company"]
MemorySignalType = Literal[
    "none",
    "preference",
    "correction",
    "relationship",
    "emotional_pattern",
    "routine",
    "goal",
    "temporary",
    "secret_like",
]
PrivacyRisk = Literal["low", "medium", "high", "blocked"]
MemoryCandidateType = Literal[
    "owner_identity",
    "owner_preference",
    "aesthetic_preference",
    "game_preference",
    "tool_preference",
    "research_interest",
    "behavior_pattern",
    "motivation_pattern",
    "emotional_trigger",
    "long_term_goal",
    "learning_progress",
    "life_routine",
    "relationship_memory",
    "rin_identity",
    "rin_preference",
    "rin_boundary",
    "conversation_correction",
    "temporary_context",
]
RiskLevel = Literal["low", "medium", "high", "blocked"]
ReviewStatus = Literal[
    "auto_promoted",
    "candidate",
    "review_required",
    "rejected",
    "inactive",
]


class MindBaseModel(BaseModel):
    """Shared strict config for RIN Mind schemas."""

    model_config = ConfigDict(extra="forbid")


class MessageUnderstanding(MindBaseModel):
    mode: MessageMode
    secondaryModes: list[MessageMode]
    intentSummary: str
    topicTags: list[str]
    emotionalTone: str
    urgency: StateLevel
    relationshipRelevance: StateLevel
    memorySignalType: MemorySignalType
    privacyRisk: PrivacyRisk
    confidence: float = Field(ge=0.0, le=1.0)
    reasons: list[str]


class OwnerStateSnapshot(MindBaseModel):
    energyLevel: EnergyLevel
    moodValence: MoodValence
    arousalLevel: ArousalLevel
    focusState: FocusState
    motivationState: MotivationState
    immersionInertia: StateLevel
    interruptionRisk: StateLevel
    resultUrgency: StateLevel
    supportNeed: SupportNeed
    confidence: float = Field(ge=0.0, le=1.0)
    evidenceMessageIds: list[str]
    ttlHours: int = Field(ge=1)
    expiresAt: str


class ExcludedContextItem(MindBaseModel):
    id: str
    kind: str
    reason: str


class ContextPlan(MindBaseModel):
    mode: MessageMode
    ownerStateIncluded: bool
    selectedRecentMessageIds: list[str]
    selectedMemoryTraceIds: list[str]
    selectedProfileSections: list[str]
    selectedSummaryIds: list[str]
    excludedItems: list[ExcludedContextItem]
    budget: int
    estimatedTokens: int
    privacyFlags: dict[str, bool]
    exportAllowed: bool
    reasons: list[str]


class MemoryRetrievalItem(MindBaseModel):
    traceId: str
    score: float
    selected: bool
    reasons: list[str]
    matchedTags: list[str]
    salienceScore: float
    riskLevel: RiskLevel
    rawTextIncluded: Literal[False]


class MemoryRetrievalPlan(MindBaseModel):
    selected: list[MemoryRetrievalItem]
    excluded: list[MemoryRetrievalItem]
    queryTags: list[str]
    maxSelected: int
    selectionPolicy: str
    rawMemoryIncluded: Literal[False]


class MemoryCandidate(MindBaseModel):
    id: str
    type: MemoryCandidateType
    summary: str
    sourceMessageIds: list[str]
    confidence: float = Field(ge=0.0, le=1.0)
    salience: float = Field(ge=0.0, le=1.0)
    stability: str
    decayPolicy: str
    riskLevel: RiskLevel
    reviewStatus: ReviewStatus
    active: bool
    tags: list[str]
    evidenceHashes: list[str]
    contradictionOf: str | None
    supersedes: str | None
    ownerConfirmed: bool
    autoPromote: bool
    reasons: list[str]


class ResponsePlan(MindBaseModel):
    tone: str
    length: str
    directness: str
    warmth: str
    initiativeLevel: str
    askFollowup: bool
    referenceMemory: bool
    provideStructure: bool
    provideComfort: bool
    challengeOwner: bool
    avoidOverexplaining: bool
    rinCharacterExpression: str
    emotionalMirroring: str
    nextActionStyle: str
    reasons: list[str]


class RinMindSnapshot(MindBaseModel):
    messageUnderstanding: MessageUnderstanding
    ownerState: OwnerStateSnapshot
    contextPlan: ContextPlan
    memoryRetrieval: MemoryRetrievalPlan
    memoryCandidates: list[MemoryCandidate]
    responsePlan: ResponsePlan
    createdAt: str
    safeForUi: Literal[True]
    rawTextIncluded: Literal[False]
    secretValuesIncluded: Literal[False]
