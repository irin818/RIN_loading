from rin.memory import (
    MemoryV2SourceMessage,
    analyze_memory_v2_source,
    build_retrieval_token_profile,
    normalize_latin_token,
    preprocess_text,
)

DEFAULT_NOW = "2026-06-05T12:00:00.000Z"


def message(message_id: str, content: str, created_at: str) -> MemoryV2SourceMessage:
    return MemoryV2SourceMessage(
        messageId=message_id,
        conversationId="fixture-conversation",
        role="owner",
        content=content,
        createdAt=created_at,
    )


def test_builtin_memory_v2_decisions_match_typescript_fixtures() -> None:
    cases = [
        (
            "preference-promoted",
            "I prefer concise RIN progress reports.",
            "2026-06-05T10:00:00.000Z",
            "promoted",
            ["preference_signal", "decay_signal"],
        ),
        (
            "project-promoted",
            "For the RIN_loading project, continue Package 5 memory work.",
            "2026-06-05T09:30:00.000Z",
            "promoted",
            ["project_signal", "decay_signal"],
        ),
        (
            "contradiction-promoted",
            "Actually, I no longer want that old notification behavior.",
            "2026-06-05T08:00:00.000Z",
            "promoted",
            ["preference_signal", "contradiction_signal", "decay_signal"],
        ),
        (
            "daily-weakened",
            "Today I cooked noodles and checked the weather.",
            "2026-05-30T12:00:00.000Z",
            "weakened",
            ["daily_signal", "decay_signal"],
        ),
        (
            "low-signal-ignored",
            "ok thanks",
            "2026-06-05T11:55:00.000Z",
            "ignored",
            ["low_signal"],
        ),
    ]

    for case_id, text, created_at, decision, reasons in cases:
        analysis = analyze_memory_v2_source(
            message(case_id, text, created_at),
            DEFAULT_NOW,
        )

        assert analysis.decision == decision
        assert analysis.reasons == reasons
        assert analysis.signals[-1].evidence.rawTextIncluded is False


def test_existing_trace_reinforces_when_retained() -> None:
    analysis = analyze_memory_v2_source(
        message(
            "preference-reinforced",
            "I prefer concise RIN progress reports.",
            "2026-06-05T10:00:00.000Z",
        ),
        DEFAULT_NOW,
        existing_trace=True,
    )

    assert analysis.decision == "reinforced"
    assert "reinforcement_signal" in analysis.reasons


def test_chinese_preference_project_and_contradiction_signals_are_detected() -> None:
    cases = [
        ("我喜欢本地模型回答。", "preference_signal"),
        ("继续推进这个项目。", "project_signal"),
        ("不要再使用旧行为，改为新的方式。", "contradiction_signal"),
    ]

    for index, (content, reason) in enumerate(cases):
        analysis = analyze_memory_v2_source(
            message(f"zh-signal-{index}", content, DEFAULT_NOW),
            DEFAULT_NOW,
        )

        assert analysis.decision == "promoted"
        assert reason in analysis.reasons


def test_analysis_is_deterministic() -> None:
    source = message(
        "project-deterministic",
        "For the RIN_loading project, continue Package 5 memory work.",
        "2026-06-05T09:30:00.000Z",
    )

    first = analyze_memory_v2_source(source, DEFAULT_NOW)
    second = analyze_memory_v2_source(source, DEFAULT_NOW)

    assert first == second


def test_tokenization_matches_typescript_normalization_rules() -> None:
    assert normalize_latin_token("memories") == "memory"
    assert normalize_latin_token("models") == "model"
    assert preprocess_text("RIN-loading/API") == "rin loading api"

    profile = build_retrieval_token_profile(
        "Owner prefers local Ollama models.",
        "RIN memory",
    )

    assert profile.latinTokens == frozenset(
        {"owner", "prefer", "local", "ollama", "model", "rin", "memory"}
    )
    assert profile.normalizedTokenCount == len(profile.latinTokens)


def test_cjk_bigrams_are_deterministic_and_skip_stopwords() -> None:
    profile = build_retrieval_token_profile("我喜欢本地模型和记忆")

    assert "喜欢" in profile.cjkBigrams
    assert "本地" in profile.cjkBigrams
    assert "和" not in profile.cjkBigrams
