from types import SimpleNamespace

import pytest

from rin.mind import (
    MindPolicy,
    build_conversation_summary,
    build_embedding_entry_for_candidate,
    build_rin_mind_snapshot,
    cosine_similarity,
    embedding_allowed_for_candidate,
    embedding_provider_for_policy,
    embedding_text_for_candidate,
    generate_memory_candidates,
    infer_owner_state,
    load_mind_policy,
    memory_trace_signal_summary_from_candidate,
    mind_owner_state_context,
    plan_response,
    response_plan_context,
    retrieve_relevant_memory_sources,
    retrieve_relevant_memory_traces,
    select_recent_messages_for_mind,
    understand_owner_message,
)

NOW = "2026-06-05T00:00:00.000Z"


@pytest.mark.parametrize(
    ("content", "expected_mode", "expected_tag"),
    [
        ("我更喜欢安静一点。", "preference_expression", "preference"),
        ("你记错了，不是这个意思。", "memory_correction", "correction"),
        ("以后请多陪我聊聊。", "rin_relationship", "relationship"),
        ("RIN 应该继续开发 mind core。", "rin_development", "development"),
        ("我今天很焦虑而且低落。", "emotional_state", "emotion"),
        ("我没动力，卡住了。", "motivation_support", "motivation"),
        ("我的作息和睡觉时间需要稳定。", "life_routine", "routine"),
        ("帮我学习这门课程。", "learning_support", "learning"),
        ("这个游戏角色玩法不错。", "game", "game"),
        ("这个界面审美和颜色更好看。", "aesthetic", "aesthetic"),
        ("我们讨论一下系统规则和架构。", "meta_discussion", "meta"),
        ("请帮我修复 install 问题。", "practical_assist", "practical"),
        ("今晚想听音乐娱乐一下。", "entertainment", "entertainment"),
        ("我发现自己最近在反思。", "self_reflection", "reflection"),
    ],
)
def test_understanding_classifies_modes_and_tags(
    content: str,
    expected_mode: str,
    expected_tag: str,
) -> None:
    understanding = understand_owner_message(content)

    assert understanding.mode == expected_mode
    assert expected_tag in understanding.topicTags
    assert understanding.privacyRisk == "low"
    assert understanding.confidence > 0.5
    assert understanding.reasons


def test_owner_state_infers_current_interaction_needs() -> None:
    state = infer_owner_state(
        "我很焦虑而且卡住了，急着要结果。",
        owner_message_id="msg-owner",
        now=NOW,
    )

    assert state.moodValence == "negative"
    assert state.arousalLevel == "stressed"
    assert state.focusState == "blocked"
    assert state.interruptionRisk == "high"
    assert state.resultUrgency == "high"
    assert state.supportNeed == "comfort"
    assert state.evidenceMessageIds == ["msg-owner"]
    assert state.expiresAt > NOW


def test_memory_candidates_apply_risk_and_review_policy() -> None:
    secret = generate_memory_candidates(
        owner_message_id="msg-secret",
        owner_content="记住我的 api key sk-testsecret123456789",
        understanding=understand_owner_message(
            "记住我的 api key sk-testsecret123456789"
        ),
    )[0]
    preference = generate_memory_candidates(
        owner_message_id="msg-preference",
        owner_content="I prefer concise RIN progress reports.",
        understanding=understand_owner_message(
            "I prefer concise RIN progress reports."
        ),
    )[0]
    correction = generate_memory_candidates(
        owner_message_id="msg-correction",
        owner_content="忘掉这个结论。",
        understanding=understand_owner_message("忘掉这个结论。"),
    )[0]
    rin_boundary = generate_memory_candidates(
        owner_message_id="msg-rin",
        owner_content="RIN 应该保持本地优先。",
        understanding=understand_owner_message("RIN 应该保持本地优先。"),
    )[0]

    assert secret.riskLevel == "blocked"
    assert secret.reviewStatus == "rejected"
    assert secret.autoPromote is False
    assert (
        secret.safeSummary == "Blocked secret-like content was detected and redacted."
    )
    assert secret.normalizedValue is None
    assert secret.rawTextIncluded is False
    assert secret.redacted is True
    assert "sk-testsecret" not in secret.summary
    assert "sk-testsecret" not in secret.safeSummary

    assert preference.riskLevel == "low"
    assert preference.reviewStatus == "auto_promoted"
    assert preference.autoPromote is True
    assert preference.active is True
    assert preference.safeSummary == "Owner prefers concise RIN progress reports."
    assert preference.normalizedValue == "concise RIN progress reports"
    assert preference.rawTextIncluded is False
    summary = memory_trace_signal_summary_from_candidate(preference)
    assert summary["rawTextIncluded"] is False
    assert summary["decision"] == "auto_promoted"
    assert "I prefer" not in str(summary)

    assert correction.reviewStatus == "review_required"
    assert correction.active is False
    assert rin_boundary.riskLevel == "high"
    assert rin_boundary.reviewStatus == "review_required"
    assert rin_boundary.autoPromote is False


def test_private_preference_requires_review_instead_of_auto_promote() -> None:
    private_preference = generate_memory_candidates(
        owner_message_id="msg-private-preference",
        owner_content="I prefer private diagnostic notes.",
        understanding=understand_owner_message("I prefer private diagnostic notes."),
    )[0]
    high_risk_preference = generate_memory_candidates(
        owner_message_id="msg-high-risk-preference",
        owner_content="我喜欢把手机号相关信息放在记录里。",
        understanding=understand_owner_message("我喜欢把手机号相关信息放在记录里。"),
    )[0]

    assert private_preference.riskLevel == "medium"
    assert private_preference.reviewStatus == "review_required"
    assert private_preference.autoPromote is False
    assert "privacy_risk_requires_review" in private_preference.reasons

    assert high_risk_preference.riskLevel == "high"
    assert high_risk_preference.reviewStatus == "review_required"
    assert high_risk_preference.autoPromote is False


def test_direct_aesthetic_preference_becomes_safe_semantic_candidate() -> None:
    content = "我喜欢黑绿色简洁风格"
    understanding = understand_owner_message(content)
    candidates = generate_memory_candidates(
        owner_message_id="msg-aesthetic",
        owner_content=content,
        understanding=understanding,
    )

    assert understanding.mode == "preference_expression"
    assert understanding.secondaryModes == ["aesthetic"]
    assert candidates[0].type == "aesthetic_preference"
    assert candidates[0].safeSummary == "Owner prefers 黑绿色简洁风格 visual style."
    assert candidates[0].normalizedValue == "黑绿色简洁风格"
    assert candidates[0].language == "zh"
    assert candidates[0].rawTextIncluded is False
    assert "我喜欢" not in candidates[0].safeSummary
    assert "我喜欢" not in str(candidates[0].model_dump())


def test_preference_semantics_do_not_swallow_following_sentence() -> None:
    content = "I prefer concise RIN progress reports. RIN 应该保持本地优先。"
    understanding = understand_owner_message(content)
    candidate_item = generate_memory_candidates(
        owner_message_id="msg-mixed-preference",
        owner_content=content,
        understanding=understanding,
    )[0]

    assert candidate_item.safeSummary == "Owner prefers concise RIN progress reports."
    assert candidate_item.normalizedValue == "concise RIN progress reports"
    assert "RIN 应该" not in candidate_item.safeSummary
    assert "RIN 应该" not in str(candidate_item.model_dump())


def test_memory_retrieval_is_query_aware_and_safe() -> None:
    understanding = understand_owner_message(
        "What RIN progress report context matters?"
    )
    traces = [
        trace(
            "trace-relevant",
            0.3,
            ["rin", "progress", "report"],
            ["owner_preference"],
        ),
        trace("trace-irrelevant-high", 0.95, ["dinner"], ["life_routine"]),
        trace("trace-high-risk", 0.9, ["rin", "progress"], ["owner_identity"], "high"),
    ]

    plan = retrieve_relevant_memory_traces(
        owner_content="What RIN progress report context matters?",
        understanding=understanding,
        traces=traces,
        now=NOW,
    )

    assert [item.traceId for item in plan.selected] == ["trace-relevant"]
    excluded = {item.traceId: item for item in plan.excluded}
    assert "no_query_overlap" in excluded["trace-irrelevant-high"].reasons
    assert "excluded_risk_high" in excluded["trace-high-risk"].reasons
    assert plan.rawMemoryIncluded is False

    allowed = retrieve_relevant_memory_traces(
        owner_content="What RIN progress report context matters?",
        understanding=understanding,
        traces=traces,
        now=NOW,
        policy=MindPolicy(allowHighRiskMemoryExport=True),
    )
    assert "trace-high-risk" in [item.traceId for item in allowed.selected]


def test_unified_retrieval_uses_only_approved_active_memory_candidates() -> None:
    understanding = understand_owner_message("I prefer concise RIN progress reports.")
    approved = generate_memory_candidates(
        owner_message_id="msg-approved",
        owner_content="I prefer concise RIN progress reports.",
        understanding=understanding,
    )[0].model_copy(
        update={
            "id": "candidate-owner-approved",
            "reviewStatus": "owner_approved",
            "ownerConfirmed": True,
        }
    )
    auto_promoted = generate_memory_candidates(
        owner_message_id="msg-auto",
        owner_content="I prefer direct RIN progress reports.",
        understanding=understanding,
    )[0].model_copy(update={"id": "candidate-auto-promoted"})
    rejected = approved.model_copy(
        update={
            "id": "candidate-rejected",
            "reviewStatus": "rejected",
            "active": False,
            "ownerConfirmed": False,
        }
    )
    inactive = approved.model_copy(
        update={
            "id": "candidate-inactive",
            "reviewStatus": "inactive",
            "active": False,
            "ownerConfirmed": False,
        }
    )
    blocked = generate_memory_candidates(
        owner_message_id="msg-secret",
        owner_content="记住我的 api key sk-testsecret123456789",
        understanding=understand_owner_message(
            "记住我的 api key sk-testsecret123456789"
        ),
    )[0].model_copy(update={"id": "candidate-blocked"})
    high_risk_approved = approved.model_copy(
        update={
            "id": "candidate-high-risk",
            "riskLevel": "high",
            "reviewStatus": "owner_approved",
            "active": True,
            "ownerConfirmed": True,
        }
    )

    plan = retrieve_relevant_memory_sources(
        owner_content="I prefer concise direct RIN progress reports.",
        understanding=understanding,
        traces=[],
        candidates=[
            approved,
            auto_promoted,
            rejected,
            inactive,
            blocked,
            high_risk_approved,
        ],
        now=NOW,
        limit=5,
    )

    selected_ids = [item.sourceId for item in plan.selected]
    excluded = {item.sourceId: item for item in plan.excluded}

    assert set(selected_ids) == {"candidate-owner-approved", "candidate-auto-promoted"}
    assert all(item.sourceKind == "memory_candidate" for item in plan.selected)
    assert all(item.rawTextIncluded is False for item in plan.selected)
    approved_item = next(
        item for item in plan.selected if item.sourceId == "candidate-owner-approved"
    )
    assert approved_item.safeSummary == "Owner prefers concise RIN progress reports."
    assert approved_item.normalizedValue == "concise RIN progress reports"
    assert "approved_candidate_source" in approved_item.reasons
    assert "candidate_not_retrievable" in excluded["candidate-rejected"].reasons
    assert "candidate_not_retrievable" in excluded["candidate-inactive"].reasons
    assert "candidate_not_retrievable" in excluded["candidate-blocked"].reasons
    assert "candidate_not_retrievable" in excluded["candidate-high-risk"].reasons
    assert "I prefer" not in plan.model_dump_json()
    assert "sk-testsecret" not in plan.model_dump_json()

    high_risk_allowed = retrieve_relevant_memory_sources(
        owner_content="I prefer concise direct RIN progress reports.",
        understanding=understanding,
        traces=[],
        candidates=[high_risk_approved],
        now=NOW,
        limit=5,
        policy=MindPolicy(allowHighRiskMemoryExport=True),
    )
    assert [item.sourceId for item in high_risk_allowed.selected] == [
        "candidate-high-risk"
    ]


def test_mind_policy_defaults_overrides_and_invalid_fallbacks() -> None:
    defaults = load_mind_policy({})
    assert defaults.contextMaxCharacters == 8000
    assert defaults.recentHistorySelectedLimit == 8
    assert defaults.memoryMaxSelected == 5
    assert defaults.autopromoteConfidence == 0.8
    assert defaults.ownerStateTtlHours == 6
    assert defaults.enableEmbeddings is False
    assert defaults.embeddingProvider == "disabled"
    assert defaults.enableAgentTools is False
    assert defaults.allowHighRiskMemoryExport is False
    assert defaults.metadata().dangerousDefaultsDisabled is True
    assert defaults.metadata().secretValuesIncluded is False

    override = load_mind_policy(
        {
            "RIN_MIND_CONTEXT_MAX_CHARACTERS": "12000",
            "RIN_MIND_RECENT_HISTORY_LIMIT": "5",
            "RIN_MIND_RECENT_HISTORY_CANDIDATE_LIMIT": "30",
            "RIN_MIND_MEMORY_RETRIEVAL_LIMIT": "42",
            "RIN_MIND_MEMORY_MAX_SELECTED": "3",
            "RIN_MIND_AUTOPROMOTE_CONFIDENCE": "0.9",
            "RIN_MIND_OWNER_STATE_TTL_HOURS": "12",
            "RIN_MIND_ENABLE_EMBEDDINGS": "true",
            "RIN_MIND_EMBEDDING_PROVIDER": "deterministic",
            "RIN_MIND_ENABLE_AGENT_TOOLS": "yes",
            "RIN_MIND_ALLOW_HIGH_RISK_MEMORY_EXPORT": "on",
            "RIN_MIND_SELF_MODEL_AUTO_APPLY": "1",
        }
    )
    assert override.contextMaxCharacters == 12000
    assert override.recentHistorySelectedLimit == 5
    assert override.recentHistoryCandidateLimit == 30
    assert override.memoryRetrievalCandidateLimit == 42
    assert override.memoryMaxSelected == 3
    assert override.autopromoteConfidence == 0.9
    assert override.ownerStateTtlHours == 12
    assert override.enableEmbeddings is True
    assert override.embeddingProvider == "deterministic"
    assert override.enableAgentTools is True
    assert override.allowHighRiskMemoryExport is True
    assert override.selfModelAutoApply is True
    assert override.metadata().dangerousDefaultsDisabled is False

    invalid = load_mind_policy(
        {
            "RIN_MIND_CONTEXT_MAX_CHARACTERS": "10",
            "RIN_MIND_AUTOPROMOTE_CONFIDENCE": "never",
            "RIN_MIND_ENABLE_AGENT_TOOLS": "maybe",
            "RIN_MIND_EMBEDDING_PROVIDER": "",
        }
    )
    assert invalid.contextMaxCharacters == 8000
    assert invalid.autopromoteConfidence == 0.8
    assert invalid.enableAgentTools is False
    assert invalid.embeddingProvider == "disabled"
    assert len(invalid.warnings) == 4


def test_embedding_framework_is_explicit_and_uses_safe_candidate_text() -> None:
    candidate_item = generate_memory_candidates(
        owner_message_id="msg-embedding",
        owner_content="I prefer concise RIN progress reports.",
        understanding=understand_owner_message(
            "I prefer concise RIN progress reports."
        ),
    )[0]
    disabled_policy = MindPolicy()
    enabled_policy = MindPolicy(
        enableEmbeddings=True,
        embeddingProvider="deterministic",
    )
    provider = embedding_provider_for_policy(enabled_policy)

    assert embedding_provider_for_policy(disabled_policy) is None
    assert provider is not None
    assert embedding_allowed_for_candidate(candidate_item, disabled_policy) is False
    assert embedding_allowed_for_candidate(candidate_item, enabled_policy) is True
    assert embedding_text_for_candidate(candidate_item) == (
        "Owner prefers concise RIN progress reports. concise RIN progress reports"
    )
    assert "I prefer" not in embedding_text_for_candidate(candidate_item)

    entry = build_embedding_entry_for_candidate(
        candidate_item,
        provider=provider,
        created_at=NOW,
    )
    assert entry.sourceKind == "memory_candidate"
    assert entry.sourceId == candidate_item.id
    assert entry.dimensions == 8
    assert entry.rawTextIncluded is False
    assert cosine_similarity(entry.vector, entry.vector) == 1.0

    blocked = generate_memory_candidates(
        owner_message_id="msg-blocked-embedding",
        owner_content="记住我的 api key sk-testsecret123456789",
        understanding=understand_owner_message(
            "记住我的 api key sk-testsecret123456789"
        ),
    )[0]
    assert embedding_allowed_for_candidate(blocked, enabled_policy) is False


def test_summary_growth_tool_and_lifecycle_are_review_gated() -> None:
    rin_snapshot = build_rin_mind_snapshot(
        owner_message_id="msg-rin",
        owner_content="RIN 应该保持本地优先。",
        created_at=NOW,
        prior_messages=[],
        memory_traces=[],
        profile_sections=["rin_profile"],
        budget=6000,
        turn_id="turn-rin",
        conversation_id="conv-rin",
    )
    assert rin_snapshot.growthEvents
    assert rin_snapshot.growthEvents[0].reviewStatus == "review_required"
    assert rin_snapshot.growthEvents[0].rawTextIncluded is False
    assert rin_snapshot.lifecycle.awaitingReview is True
    assert rin_snapshot.policy.selfModelAutoApply is False

    tool_default = build_rin_mind_snapshot(
        owner_message_id="msg-tool-default",
        owner_content="请帮我修复 install 问题。",
        created_at=NOW,
        prior_messages=[],
        memory_traces=[],
        profile_sections=["rin_profile"],
        budget=6000,
        turn_id="turn-tool-default",
        conversation_id="conv-tool",
    )
    tool_enabled = build_rin_mind_snapshot(
        owner_message_id="msg-tool-enabled",
        owner_content="请帮我修复 install 问题。",
        created_at=NOW,
        prior_messages=[],
        memory_traces=[],
        profile_sections=["rin_profile"],
        budget=6000,
        policy=MindPolicy(enableAgentTools=True),
        turn_id="turn-tool-enabled",
        conversation_id="conv-tool",
    )

    assert tool_default.toolInvocationRequests == []
    assert tool_enabled.toolInvocationRequests[0].status == "proposed"
    assert tool_enabled.toolInvocationRequests[0].requiresOwnerApproval is True
    assert tool_enabled.toolInvocationRequests[0].rawInputIncluded is False
    assert tool_enabled.toolInvocationRequests[0].secretValuesIncluded is False

    preference_snapshot = build_rin_mind_snapshot(
        owner_message_id="msg-preference-summary",
        owner_content="I prefer concise RIN progress reports.",
        created_at=NOW,
        prior_messages=[],
        memory_traces=[],
        profile_sections=["rin_profile"],
        budget=6000,
        turn_id="turn-preference-summary",
        conversation_id="conv-summary",
    )
    summary = build_conversation_summary(
        conversation_id="conv-summary",
        turn_id="turn-preference-summary",
        messages=[message("msg-preference-summary", "owner", "raw owner text")],
        snapshot=preference_snapshot,
        now=NOW,
    )
    assert summary.preferenceHints == ["Owner prefers concise RIN progress reports."]
    assert summary.modelGenerated is False
    assert summary.rawTextIncluded is False
    assert "I prefer" not in summary.model_dump_json()


def test_recent_selection_and_response_plan_use_mind_context() -> None:
    understanding = understand_owner_message("我没动力，卡住了，帮我拆下一步。")
    owner_state = infer_owner_state(
        "我没动力，卡住了，帮我拆下一步。",
        owner_message_id="msg-current",
        now=NOW,
    )
    messages = [
        message("msg-1", "owner", "unrelated dinner"),
        message("msg-2", "rin", "old reply"),
        message("msg-3", "owner", "我刚才说 RIN progress 卡住了"),
    ]

    selected, excluded = select_recent_messages_for_mind(
        messages,
        owner_content="我没动力，卡住了，帮我拆下一步。",
        understanding=understanding,
        limit=2,
    )
    response_plan = plan_response(
        understanding,
        owner_state,
        retrieve_relevant_memory_traces(
            owner_content="我没动力，卡住了，帮我拆下一步。",
            understanding=understanding,
            traces=[],
            now=NOW,
        ),
    )

    assert [item.id for item in selected] == ["msg-2", "msg-3"]
    assert [item.id for item, _ in excluded] == ["msg-1"]
    assert response_plan.provideStructure is True
    assert response_plan.nextActionStyle == "one_next_step"
    assert "supportNeed: structure" in mind_owner_state_context(owner_state)
    assert "provideStructure: True" in response_plan_context(response_plan)


def test_full_mind_snapshot_excludes_raw_text_and_secrets() -> None:
    snapshot = build_rin_mind_snapshot(
        owner_message_id="msg-owner",
        owner_content="我更喜欢安静一点。",
        created_at=NOW,
        prior_messages=[message("msg-prev", "owner", "之前聊过绿色界面。")],
        memory_traces=[
            trace(
                "trace-style",
                0.6,
                ["aesthetic", "绿色", "风格"],
                ["owner_preference"],
            )
        ],
        profile_sections=["rin_profile", "owner_profile"],
        budget=6000,
    )

    assert snapshot.safeForUi is True
    assert snapshot.rawTextIncluded is False
    assert snapshot.secretValuesIncluded is False
    assert snapshot.contextPlan.ownerStateIncluded is True
    assert snapshot.contextPlan.selectedProfileSections == [
        "rin_profile",
        "owner_profile",
    ]
    assert snapshot.memoryCandidates[0].autoPromote is True
    assert snapshot.memoryRetrieval.rawMemoryIncluded is False


def trace(
    trace_id: str,
    salience: float,
    signal_keys: list[str],
    reasons: list[str],
    risk: str = "low",
) -> SimpleNamespace:
    return SimpleNamespace(
        id=trace_id,
        traceType="mind_candidate",
        signalSummary={
            "rawTextIncluded": False,
            "decision": "auto_promoted",
            "reasons": reasons,
            "signalKeys": signal_keys,
            "signalTypes": ["mind_candidate"],
            "riskLevel": risk,
            "contentCharacterCount": 42,
        },
        salienceScore=salience,
        updatedAt=NOW,
    )


def message(message_id: str, role: str, content: str) -> SimpleNamespace:
    return SimpleNamespace(id=message_id, role=role, content=content)
