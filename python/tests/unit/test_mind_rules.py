from types import SimpleNamespace

import pytest

from rin.mind import (
    build_rin_mind_snapshot,
    generate_memory_candidates,
    infer_owner_state,
    memory_trace_signal_summary_from_candidate,
    mind_owner_state_context,
    plan_response,
    response_plan_context,
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
    assert "sk-testsecret" not in secret.summary

    assert preference.riskLevel == "low"
    assert preference.reviewStatus == "auto_promoted"
    assert preference.autoPromote is True
    assert preference.active is True
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
