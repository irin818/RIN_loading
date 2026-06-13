"""Deterministic local RIN Mind Core v1 rules."""

from __future__ import annotations

import hashlib
import math
import re
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from rin.memory import build_retrieval_token_profile

from .schemas import (
    ArousalLevel,
    ContextPlan,
    EnergyLevel,
    ExcludedContextItem,
    FocusState,
    MemoryCandidate,
    MemoryCandidateType,
    MemoryRetrievalItem,
    MemoryRetrievalPlan,
    MemorySignalType,
    MessageMode,
    MessageUnderstanding,
    MoodValence,
    MotivationState,
    OwnerStateSnapshot,
    PrivacyRisk,
    ResponsePlan,
    RinMindSnapshot,
    RiskLevel,
    StateLevel,
    SupportNeed,
)

SECRET_PATTERNS = (
    re.compile(r"\bsk-[A-Za-z0-9_-]{12,}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{12,}\b"),
    re.compile(r"\b(api[_ -]?key|token|secret|password|密码|密钥)\b", re.I),
)

MODE_RULES: tuple[tuple[MessageMode, tuple[str, ...], tuple[str, ...]], ...] = (
    (
        "preference_expression",
        (
            r"\bI prefer\b",
            r"\bI like\b",
            r"\bmy preference\b",
            "我喜欢",
            "我更喜欢",
            "我偏好",
            "我希望",
        ),
        ("preference",),
    ),
    (
        "memory_correction",
        (
            "不对",
            "不是这个意思",
            "你记错了",
            "忘掉",
            "别记",
            r"\bforget\b",
            r"\bnot what I meant\b",
        ),
        ("correction",),
    ),
    (
        "rin_relationship",
        ("和RIN", "你以后", "你的性格", "陪我", "你对我", "关系", "relationship"),
        ("rin", "relationship"),
    ),
    (
        "rin_development",
        ("RIN应该", "RIN 应该", "RIN开发", "RIN 的开发", "mind core", "你的开发"),
        ("rin", "development"),
    ),
    (
        "emotional_state",
        ("焦虑", "累", "兴奋", "低落", "烦", "难过", "开心", "anxious", "tired"),
        ("emotion",),
    ),
    (
        "motivation_support",
        ("没动力", "有动力", "拖延", "停不下来", "沉浸", "卡住", "motivation"),
        ("motivation", "focus"),
    ),
    ("life_routine", ("作息", "睡觉", "吃饭", "routine", "daily"), ("routine",)),
    ("learning_support", ("学习", "学会", "复习", "课程", "learn"), ("learning",)),
    ("game", ("游戏", "game", "玩法", "角色"), ("game",)),
    (
        "aesthetic",
        ("审美", "颜色", "风格", "好看", "aesthetic", "style"),
        ("aesthetic",),
    ),
    ("meta_discussion", ("规则", "系统", "架构", "策略", "meta"), ("meta",)),
    (
        "practical_assist",
        ("怎么做", "如何", "帮我", "修复", "install", "fix"),
        ("practical",),
    ),
    ("entertainment", ("电影", "音乐", "玩", "娱乐", "anime"), ("entertainment",)),
    (
        "self_reflection",
        ("我发现", "我觉得自己", "反思", "self reflection"),
        ("reflection",),
    ),
)


def build_rin_mind_snapshot(
    *,
    owner_message_id: str,
    owner_content: str,
    created_at: str,
    prior_messages: Sequence[Any],
    memory_traces: Sequence[Any],
    profile_sections: Sequence[str],
    budget: int,
) -> RinMindSnapshot:
    """Build the full safe mind snapshot for one owner turn."""
    understanding = understand_owner_message(owner_content)
    owner_state = infer_owner_state(
        owner_content,
        owner_message_id=owner_message_id,
        now=created_at,
    )
    selected_messages, excluded_messages = select_recent_messages_for_mind(
        prior_messages,
        owner_content=owner_content,
        understanding=understanding,
    )
    memory_retrieval = retrieve_relevant_memory_traces(
        owner_content=owner_content,
        understanding=understanding,
        traces=memory_traces,
        now=created_at,
    )
    candidates = generate_memory_candidates(
        owner_message_id=owner_message_id,
        owner_content=owner_content,
        understanding=understanding,
    )
    response_plan = plan_response(understanding, owner_state, memory_retrieval)
    context_plan = build_context_plan(
        understanding=understanding,
        owner_state=owner_state,
        selected_recent_message_ids=[str(item.id) for item in selected_messages],
        selected_memory_trace_ids=[item.traceId for item in memory_retrieval.selected],
        selected_profile_sections=list(profile_sections),
        excluded_items=[
            ExcludedContextItem(
                id=str(item.id),
                kind="recent_message",
                reason=reason,
            )
            for item, reason in excluded_messages
        ]
        + [
            ExcludedContextItem(
                id=item.traceId,
                kind="memory_v2_trace",
                reason="; ".join(item.reasons) or "not_selected",
            )
            for item in memory_retrieval.excluded
        ],
        budget=budget,
    )
    return RinMindSnapshot(
        messageUnderstanding=understanding,
        ownerState=owner_state,
        contextPlan=context_plan,
        memoryRetrieval=memory_retrieval,
        memoryCandidates=candidates,
        responsePlan=response_plan,
        createdAt=created_at,
        safeForUi=True,
        rawTextIncluded=False,
        secretValuesIncluded=False,
    )


def understand_owner_message(content: str) -> MessageUnderstanding:
    """Classify an owner message with transparent local rules."""
    normalized = content.lower()
    scores: dict[MessageMode, float] = {}
    reasons_by_mode: dict[MessageMode, list[str]] = {}
    topic_tags: set[str] = set()
    for mode, patterns, tags in MODE_RULES:
        for pattern in patterns:
            matched = (
                re.search(pattern, normalized, re.I) is not None
                if pattern.startswith(r"\b")
                else pattern.lower() in normalized
            )
            if matched:
                scores[mode] = scores.get(mode, 0.0) + 1.0
                reasons_by_mode.setdefault(mode, []).append(f"matched:{mode}")
                topic_tags.update(tags)

    if "rin" in normalized:
        topic_tags.add("rin")
    if "api" in normalized:
        topic_tags.add("api")
    if "memory" in normalized or "记忆" in normalized:
        topic_tags.add("memory")
    if "成本" in normalized or "token" in normalized:
        topic_tags.add("cost")

    privacy_risk = privacy_risk_for(content)
    if privacy_risk == "blocked":
        scores["memory_correction"] = max(scores.get("memory_correction", 0.0), 0.5)
        topic_tags.add("secret")

    if not scores:
        fallback: MessageMode = (
            "companionship"
            if any(item in normalized for item in ("陪", "聊聊", "陪我"))
            else "daily_chat"
        )
        scores[fallback] = 0.35
        reasons_by_mode[fallback] = ["fallback:no_specific_rule"]

    ordered_modes = sorted(scores, key=lambda mode: (-scores[mode], mode))
    mode = ordered_modes[0]
    secondary = [item for item in ordered_modes[1:4] if item != mode]
    confidence = min(0.95, 0.35 + scores[mode] * 0.18)
    if privacy_risk == "blocked":
        confidence = max(confidence, 0.85)
    return MessageUnderstanding(
        mode=mode,
        secondaryModes=secondary,
        intentSummary=intent_summary_for(mode),
        topicTags=sorted(topic_tags) or ["general"],
        emotionalTone=emotional_tone_for(normalized),
        urgency=urgency_for(normalized),
        relationshipRelevance="high"
        if mode in {"rin_relationship", "rin_development"}
        else "medium"
        if "rin" in topic_tags
        else "low",
        memorySignalType=memory_signal_for(mode, normalized, privacy_risk),
        privacyRisk=privacy_risk,
        confidence=round(confidence, 2),
        reasons=unique_reasons(
            [
                reason
                for item in ordered_modes
                for reason in reasons_by_mode.get(item, [])
            ]
        ),
    )


def infer_owner_state(
    content: str,
    *,
    owner_message_id: str,
    now: str,
) -> OwnerStateSnapshot:
    """Infer a local interaction-state snapshot, not a diagnosis."""
    normalized = content.lower()
    energy: EnergyLevel = (
        "low" if has_any(normalized, ("累", "疲惫", "困", "tired")) else "unknown"
    )
    if has_any(normalized, ("兴奋", "energized", "有精神")):
        energy = "high"

    mood: MoodValence = "unknown"
    if has_any(normalized, ("焦虑", "低落", "烦", "难过", "anxious", "sad")):
        mood = "negative"
    elif has_any(normalized, ("开心", "兴奋", "高兴", "happy")):
        mood = "positive"
    elif content.strip():
        mood = "neutral"

    arousal: ArousalLevel = "unknown"
    if has_any(normalized, ("焦虑", "急", "烦", "stressed")):
        arousal = "stressed"
    elif has_any(normalized, ("兴奋", "停不下来", "activated")):
        arousal = "activated"
    elif has_any(normalized, ("平静", "calm")):
        arousal = "calm"

    focus: FocusState = "stable"
    if has_any(normalized, ("混乱", "乱", "scattered")):
        focus = "scattered"
    if has_any(normalized, ("卡住", "blocked", "stuck")):
        focus = "blocked"
    if has_any(normalized, ("沉浸", "停不下来", "immersed")):
        focus = "immersed"

    motivation: MotivationState = "normal"
    if has_any(normalized, ("没动力", "拖延", "low motivation")):
        motivation = "low"
    elif has_any(normalized, ("很有动力", "想马上", "high motivation")):
        motivation = "high"
    elif has_any(normalized, ("一会儿", "不稳定", "unstable")):
        motivation = "unstable"

    urgency = urgency_for(normalized)
    support_need = support_need_for(focus, mood, motivation, normalized)
    confidence = (
        0.72 if any(value != "unknown" for value in (energy, arousal)) else 0.55
    )
    return OwnerStateSnapshot(
        energyLevel=energy,
        moodValence=mood,
        arousalLevel=arousal,
        focusState=focus,
        motivationState=motivation,
        immersionInertia="high"
        if focus == "immersed"
        else "medium"
        if has_any(normalized, ("沉浸", "停不下来"))
        else "low",
        interruptionRisk="high"
        if focus in {"immersed", "blocked"} or arousal == "stressed"
        else "medium"
        if energy == "low"
        else "low",
        resultUrgency=urgency,
        supportNeed=support_need,
        confidence=confidence,
        evidenceMessageIds=[owner_message_id],
        ttlHours=6,
        expiresAt=expiry_from(now, hours=6),
    )


def select_recent_messages_for_mind(
    messages: Sequence[Any],
    *,
    owner_content: str,
    understanding: MessageUnderstanding,
    limit: int = 6,
) -> tuple[list[Any], list[tuple[Any, str]]]:
    """Select recent history by adjacency plus relevance, not fixed last-N only."""
    if not messages:
        return [], []
    query_profile = build_retrieval_token_profile(
        owner_content,
        " ".join(understanding.topicTags + [understanding.mode]),
    )
    scored: list[tuple[float, int, Any, list[str]]] = []
    total = len(messages)
    for index, message in enumerate(messages):
        profile = build_retrieval_token_profile(str(message.content))
        overlap = len(query_profile.latinTokens & profile.latinTokens) + len(
            query_profile.cjkBigrams & profile.cjkBigrams
        )
        recency = (index + 1) / max(total, 1)
        adjacency_bonus = 0.45 if index >= total - 2 else 0.0
        score = adjacency_bonus + min(0.35, overlap * 0.08) + recency * 0.2
        reasons = ["adjacent_recent"] if adjacency_bonus else []
        if overlap:
            reasons.append("query_overlap")
        scored.append((round(score, 4), index, message, reasons or ["low_relevance"]))
    selected_rows = sorted(scored, key=lambda row: (-row[0], -row[1]))[:limit]
    selected_indexes = {row[1] for row in selected_rows}
    selected = [
        message for _, _, message, _ in sorted(selected_rows, key=lambda row: row[1])
    ]
    excluded = [
        (message, "not_selected_by_mind_relevance")
        for _, index, message, _ in scored
        if index not in selected_indexes
    ]
    return selected, excluded


def retrieve_relevant_memory_traces(
    *,
    owner_content: str,
    understanding: MessageUnderstanding,
    traces: Sequence[Any],
    now: str,
    limit: int = 5,
) -> MemoryRetrievalPlan:
    """Score safe Memory V2 traces by query/tag/mode overlap, salience, and recency."""
    query_tags = sorted(set(understanding.topicTags + [understanding.mode]))
    query_profile = build_retrieval_token_profile(owner_content, " ".join(query_tags))
    rows: list[MemoryRetrievalItem] = []
    for trace in traces:
        signal_summary = getattr(trace, "signalSummary", {})
        safe_text = memory_trace_safe_text(trace, signal_summary)
        profile = build_retrieval_token_profile(safe_text)
        latin_overlap = len(query_profile.latinTokens & profile.latinTokens)
        cjk_overlap = len(query_profile.cjkBigrams & profile.cjkBigrams)
        trace_tags = trace_tags_from(signal_summary)
        tag_overlap = sorted(set(query_tags) & set(trace_tags))
        salience = float(getattr(trace, "salienceScore", 0.0))
        risk = risk_from_signal_summary(signal_summary)
        recency_bonus = recency_score(str(getattr(trace, "updatedAt", "")), now)
        score = (
            latin_overlap * 0.14
            + cjk_overlap * 0.1
            + len(tag_overlap) * 0.22
            + min(0.2, salience * 0.2)
            + recency_bonus
        )
        reasons: list[str] = []
        if latin_overlap or cjk_overlap:
            reasons.append("token_overlap")
        if tag_overlap:
            reasons.append("tag_overlap")
        if salience >= 0.65:
            reasons.append("salience_bonus")
        if risk in {"high", "blocked"}:
            reasons.append(f"excluded_risk_{risk}")
            score = 0.0
        elif not (latin_overlap or cjk_overlap or tag_overlap):
            reasons.append("no_query_overlap")
            score = 0.0
        elif score < 0.12:
            reasons.append("low_query_relevance")
        rows.append(
            MemoryRetrievalItem(
                traceId=str(getattr(trace, "id", "n/a")),
                score=round(score, 4),
                selected=False,
                reasons=unique_reasons(reasons),
                matchedTags=tag_overlap,
                salienceScore=salience,
                riskLevel=risk,
                rawTextIncluded=False,
            )
        )
    ranked = [
        item
        for item in sorted(
            rows, key=lambda item: (-item.score, -item.salienceScore, item.traceId)
        )
        if item.score >= 0.12 and item.riskLevel not in {"high", "blocked"}
    ]
    selected_ids = {item.traceId for item in ranked[:limit]}
    selected = [
        item.model_copy(update={"selected": True})
        for item in rows
        if item.traceId in selected_ids
    ]
    excluded = [item for item in rows if item.traceId not in selected_ids]
    selected = sorted(
        selected, key=lambda item: (-item.score, -item.salienceScore, item.traceId)
    )[:limit]
    return MemoryRetrievalPlan(
        selected=selected,
        excluded=excluded,
        queryTags=query_tags,
        maxSelected=limit,
        selectionPolicy="token+cjk_bigram+tag+mode+salience+recency",
        rawMemoryIncluded=False,
    )


def generate_memory_candidates(
    *,
    owner_message_id: str,
    owner_content: str,
    understanding: MessageUnderstanding,
) -> list[MemoryCandidate]:
    """Generate safe, reviewable memory candidates from local owner-message rules."""
    evidence_hash = short_hash(owner_content)
    if understanding.privacyRisk == "blocked":
        return [
            candidate(
                owner_message_id,
                "temporary_context",
                "Blocked secret-like content was detected and omitted.",
                confidence=0.95,
                salience=0.1,
                risk="blocked",
                review_status="rejected",
                active=False,
                tags=["secret_like"],
                evidence_hash=evidence_hash,
                auto_promote=False,
                reasons=["secret_like_content_blocked"],
            )
        ]

    mode = understanding.mode
    if mode == "preference_expression":
        candidate_type = preference_candidate_type(understanding.topicTags)
        confidence = 0.9 if has_any(owner_content, ("记住", "remember")) else 0.82
        candidate_risk: RiskLevel = (
            "high"
            if understanding.privacyRisk == "high"
            else "medium"
            if understanding.privacyRisk == "medium"
            else "low"
        )
        auto_promote = candidate_risk == "low" and confidence >= 0.8
        return [
            candidate(
                owner_message_id,
                candidate_type,
                f"Owner expressed a stable {candidate_type.replace('_', ' ')}.",
                confidence=confidence,
                salience=0.78,
                risk=candidate_risk,
                review_status="auto_promoted"
                if auto_promote
                else "review_required"
                if candidate_risk in {"medium", "high"}
                else "candidate",
                active=True,
                tags=understanding.topicTags,
                evidence_hash=evidence_hash,
                auto_promote=auto_promote,
                reasons=[
                    "low_risk_preference"
                    if candidate_risk == "low"
                    else "privacy_risk_requires_review",
                    "local_rule_auto_promote"
                    if auto_promote
                    else "review_before_memory_change",
                ],
            )
        ]
    if mode == "memory_correction":
        forgetting = has_any(owner_content.lower(), ("忘掉", "forget", "别记"))
        return [
            candidate(
                owner_message_id,
                "conversation_correction",
                "Owner corrected or superseded prior conversation context.",
                confidence=0.86,
                salience=0.72,
                risk="medium",
                review_status="review_required" if forgetting else "candidate",
                active=not forgetting,
                tags=["correction"],
                evidence_hash=evidence_hash,
                auto_promote=False,
                reasons=["owner_correction", "review_before_memory_change"],
            )
        ]
    if mode in {"rin_relationship", "rin_development"}:
        return [
            candidate(
                owner_message_id,
                "rin_boundary" if mode == "rin_development" else "relationship_memory",
                "Owner provided RIN relationship or identity guidance.",
                confidence=0.78,
                salience=0.74,
                risk="high",
                review_status="review_required",
                active=True,
                tags=understanding.topicTags,
                evidence_hash=evidence_hash,
                auto_promote=False,
                reasons=["rin_identity_or_relationship_change_requires_review"],
            )
        ]
    if mode == "life_routine":
        return [
            candidate(
                owner_message_id,
                "life_routine",
                "Owner mentioned a routine-related pattern.",
                confidence=0.68,
                salience=0.58,
                risk="medium",
                review_status="candidate",
                active=True,
                tags=understanding.topicTags,
                evidence_hash=evidence_hash,
                auto_promote=False,
                reasons=["routine_signal_requires_review"],
            )
        ]
    if mode in {"emotional_state", "motivation_support"} and has_any(
        owner_content.lower(),
        ("总是", "经常", "一直", "always", "often"),
    ):
        return [
            candidate(
                owner_message_id,
                "emotional_trigger"
                if mode == "emotional_state"
                else "motivation_pattern",
                "Owner described a repeated state pattern.",
                confidence=0.7,
                salience=0.62,
                risk="medium",
                review_status="candidate",
                active=True,
                tags=understanding.topicTags,
                evidence_hash=evidence_hash,
                auto_promote=False,
                reasons=["repeated_state_pattern"],
            )
        ]
    return []


def build_context_plan(
    *,
    understanding: MessageUnderstanding,
    owner_state: OwnerStateSnapshot,
    selected_recent_message_ids: list[str],
    selected_memory_trace_ids: list[str],
    selected_profile_sections: list[str],
    excluded_items: list[ExcludedContextItem],
    budget: int,
) -> ContextPlan:
    estimated_tokens = max(1, math.ceil(budget / 4))
    return ContextPlan(
        mode=understanding.mode,
        ownerStateIncluded=True,
        selectedRecentMessageIds=selected_recent_message_ids,
        selectedMemoryTraceIds=selected_memory_trace_ids,
        selectedProfileSections=selected_profile_sections,
        selectedSummaryIds=[],
        excludedItems=excluded_items,
        budget=budget,
        estimatedTokens=estimated_tokens,
        privacyFlags={
            "rawPromptIncluded": False,
            "hiddenReasoningIncluded": False,
            "fullProfileIncluded": False,
            "rawMemoryIncluded": False,
            "secretValuesIncluded": False,
        },
        exportAllowed=understanding.privacyRisk != "blocked",
        reasons=[
            "latest_owner_message_protected_last",
            "owner_state_compact_summary_allowed",
            "query_aware_memory_retrieval",
        ],
    )


def plan_response(
    understanding: MessageUnderstanding,
    owner_state: OwnerStateSnapshot,
    retrieval: MemoryRetrievalPlan,
) -> ResponsePlan:
    provide_structure = owner_state.focusState in {"scattered", "blocked"}
    provide_comfort = owner_state.supportNeed == "comfort"
    direct = "high" if understanding.urgency == "high" else "medium"
    return ResponsePlan(
        tone="calm"
        if owner_state.arousalLevel == "stressed"
        else "warm"
        if understanding.mode in {"companionship", "emotional_state"}
        else "clear",
        length="short" if understanding.urgency == "high" else "medium",
        directness=direct,
        warmth="high"
        if understanding.mode
        in {"companionship", "emotional_state", "rin_relationship"}
        else "medium",
        initiativeLevel="low" if owner_state.interruptionRisk == "high" else "medium",
        askFollowup=understanding.confidence < 0.65,
        referenceMemory=bool(retrieval.selected),
        provideStructure=provide_structure,
        provideComfort=provide_comfort,
        challengeOwner=False,
        avoidOverexplaining=understanding.urgency == "high",
        rinCharacterExpression="steady",
        emotionalMirroring="light" if provide_comfort else "minimal",
        nextActionStyle="one_next_step" if provide_structure else "direct_answer",
        reasons=[
            f"mode:{understanding.mode}",
            f"support_need:{owner_state.supportNeed}",
        ],
    )


def mind_owner_state_context(owner_state: OwnerStateSnapshot) -> str:
    """Render owner state as compact safe context."""
    return "\n".join(
        [
            "Local owner interaction state (short-lived, non-diagnostic):",
            f"energy: {owner_state.energyLevel}",
            f"moodValence: {owner_state.moodValence}",
            f"focusState: {owner_state.focusState}",
            f"motivationState: {owner_state.motivationState}",
            f"supportNeed: {owner_state.supportNeed}",
            f"resultUrgency: {owner_state.resultUrgency}",
        ]
    )


def response_plan_context(response_plan: ResponsePlan) -> str:
    """Render response plan as compact safe context."""
    return "\n".join(
        [
            "Local response plan:",
            f"tone: {response_plan.tone}",
            f"length: {response_plan.length}",
            f"directness: {response_plan.directness}",
            f"warmth: {response_plan.warmth}",
            f"provideStructure: {response_plan.provideStructure}",
            f"provideComfort: {response_plan.provideComfort}",
            f"avoidOverexplaining: {response_plan.avoidOverexplaining}",
            f"nextActionStyle: {response_plan.nextActionStyle}",
        ]
    )


def memory_trace_signal_summary_from_candidate(
    candidate_item: MemoryCandidate,
) -> dict[str, object]:
    """Build safe Memory V2 summary for locally auto-promoted candidates."""
    return {
        "schemaVersion": 1,
        "rawTextIncluded": False,
        "sourceMessageId": candidate_item.sourceMessageIds[0],
        "candidateId": candidate_item.id,
        "candidateType": candidate_item.type,
        "decision": "auto_promoted",
        "reasons": candidate_item.reasons,
        "signalKeys": candidate_item.tags,
        "signalTypes": ["mind_candidate"],
        "contentCharacterCount": 0,
        "riskLevel": candidate_item.riskLevel,
        "reviewStatus": candidate_item.reviewStatus,
        "summary": candidate_item.summary,
    }


def candidate(
    owner_message_id: str,
    candidate_type: MemoryCandidateType,
    summary: str,
    *,
    confidence: float,
    salience: float,
    risk: RiskLevel,
    review_status: str,
    active: bool,
    tags: list[str],
    evidence_hash: str,
    auto_promote: bool,
    reasons: list[str],
) -> MemoryCandidate:
    stable_tags = sorted(set(tags))
    return MemoryCandidate(
        id=f"mind-candidate-{short_hash(owner_message_id + summary)}",
        type=candidate_type,
        summary=summary,
        sourceMessageIds=[owner_message_id],
        confidence=confidence,
        salience=salience,
        stability="stable" if risk == "low" else "needs_review",
        decayPolicy="long" if risk == "low" else "review_before_retention",
        riskLevel=risk,
        reviewStatus=review_status,  # type: ignore[arg-type]
        active=active,
        tags=stable_tags,
        evidenceHashes=[evidence_hash],
        contradictionOf=None,
        supersedes=None,
        ownerConfirmed=False,
        autoPromote=auto_promote,
        reasons=reasons,
    )


def privacy_risk_for(content: str) -> PrivacyRisk:
    if any(pattern.search(content) for pattern in SECRET_PATTERNS):
        return "blocked"
    lowered = content.lower()
    if has_any(lowered, ("身份证", "手机号", "住址", "private key")):
        return "high"
    if has_any(lowered, ("隐私", "秘密", "private")):
        return "medium"
    return "low"


def memory_signal_for(
    mode: MessageMode,
    normalized: str,
    privacy_risk: PrivacyRisk,
) -> MemorySignalType:
    if privacy_risk == "blocked":
        return "secret_like"
    if mode == "preference_expression":
        return "preference"
    if mode == "memory_correction":
        return "correction"
    if mode in {"rin_relationship", "rin_development"}:
        return "relationship"
    if mode in {"emotional_state", "motivation_support"}:
        return (
            "emotional_pattern"
            if has_any(normalized, ("总是", "经常", "always", "often"))
            else "temporary"
        )
    if mode == "life_routine":
        return "routine"
    return "none"


def preference_candidate_type(tags: list[str]) -> MemoryCandidateType:
    if "aesthetic" in tags:
        return "aesthetic_preference"
    if "game" in tags:
        return "game_preference"
    if "practical" in tags or "api" in tags:
        return "tool_preference"
    if "learning" in tags or "research" in tags:
        return "research_interest"
    return "owner_preference"


def intent_summary_for(mode: MessageMode) -> str:
    summaries: dict[MessageMode, str] = {
        "daily_chat": "Owner is continuing ordinary conversation.",
        "companionship": "Owner is seeking companionship or presence.",
        "emotional_state": "Owner is expressing a short-term emotional state.",
        "self_reflection": "Owner is reflecting on self or behavior.",
        "preference_expression": "Owner is expressing a preference.",
        "memory_correction": "Owner is correcting or removing remembered context.",
        "rin_relationship": "Owner is discussing relationship with RIN.",
        "rin_development": "Owner is discussing RIN development or identity design.",
        "learning_support": "Owner is asking for learning support.",
        "life_routine": "Owner is discussing routine or daily pattern.",
        "motivation_support": "Owner is asking for motivation or focus support.",
        "entertainment": "Owner is discussing entertainment.",
        "game": "Owner is discussing games.",
        "aesthetic": "Owner is discussing aesthetic preference.",
        "meta_discussion": "Owner is discussing system or meta rules.",
        "practical_assist": "Owner is asking for practical assistance.",
    }
    return summaries[mode]


def emotional_tone_for(normalized: str) -> str:
    if has_any(normalized, ("焦虑", "烦", "低落", "难过", "anxious", "sad")):
        return "negative"
    if has_any(normalized, ("开心", "兴奋", "高兴", "happy", "excited")):
        return "positive"
    return "neutral"


def urgency_for(normalized: str) -> StateLevel:
    if has_any(normalized, ("马上", "立刻", "急", "asap", "urgent", "现在就")):
        return "high"
    if has_any(normalized, ("尽快", "快点", "soon")):
        return "medium"
    return "low"


def support_need_for(
    focus: str,
    mood: str,
    motivation: str,
    normalized: str,
) -> SupportNeed:
    if mood == "negative":
        return "comfort"
    if focus in {"scattered", "blocked"}:
        return "structure"
    if motivation == "low":
        return "push"
    if has_any(normalized, ("陪", "quiet company", "陪我")):
        return "quiet_company"
    return "answer"


def memory_trace_safe_text(trace: Any, signal_summary: object) -> str:
    if not isinstance(signal_summary, dict):
        signal_summary = {}
    values: list[str] = [
        str(getattr(trace, "traceType", "")),
        str(signal_summary.get("decision", "")),
        " ".join(
            str(item)
            for item in signal_summary.get("reasons", [])
            if isinstance(item, str)
        ),
        " ".join(
            str(item)
            for item in signal_summary.get("signalKeys", [])
            if isinstance(item, str)
        ),
        str(signal_summary.get("candidateType", "")),
        str(signal_summary.get("summary", "")),
    ]
    return " ".join(values)


def trace_tags_from(signal_summary: object) -> list[str]:
    if not isinstance(signal_summary, dict):
        return []
    values: list[str] = []
    for key in ("reasons", "signalKeys", "signalTypes", "tags"):
        raw = signal_summary.get(key, [])
        if isinstance(raw, list):
            values.extend(str(item) for item in raw if isinstance(item, str))
    for key in ("candidateType", "decision", "reviewStatus"):
        raw_value = signal_summary.get(key)
        if isinstance(raw_value, str):
            values.append(raw_value)
    return sorted(set(values))


def risk_from_signal_summary(signal_summary: object) -> RiskLevel:
    if not isinstance(signal_summary, dict):
        return "low"
    raw = signal_summary.get("riskLevel", "low")
    return cast(
        RiskLevel, raw if raw in {"low", "medium", "high", "blocked"} else "low"
    )


def recency_score(updated_at: str, now: str) -> float:
    try:
        then = parse_iso(updated_at)
        current = parse_iso(now)
    except ValueError:
        return 0.0
    age_hours = max(0.0, (current - then).total_seconds() / 3600)
    return round(min(0.12, 0.12 * math.exp(-age_hours / 168)), 4)


def expiry_from(now: str, *, hours: int) -> str:
    try:
        current = parse_iso(now)
    except ValueError:
        current = datetime.now(tz=UTC)
    return (
        (current + timedelta(hours=hours))
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def parse_iso(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed


def has_any(value: str, needles: tuple[str, ...]) -> bool:
    lowered = value.lower()
    return any(needle.lower() in lowered for needle in needles)


def short_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def unique_reasons(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        if value and value not in seen:
            output.append(value)
            seen.add(value)
    return output
