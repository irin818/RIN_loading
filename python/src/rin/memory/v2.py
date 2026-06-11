"""Memory V2 signal extraction and trace analysis.

Analyzes owner messages for preference, project, contradiction, daily, and low signals.
Computes retention scores with exponential decay and decides whether to promote,
reinforce, weaken, or ignore a memory trace.
"""

from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from rin.contracts import MemoryV2Signal, MemoryV2SignalEvidence, MemoryV2TraceAnalysis

# Possible outcomes of trace analysis.
MemoryV2Decision = Literal["promoted", "reinforced", "weakened", "ignored"]

# ---- Tuning constants ----
PROMOTION_THRESHOLD = 0.45  # retention score must reach this to promote/reinforce
LOW_SIGNAL_MAX_CHARACTERS = (
    18  # messages shorter than this get "low_signal" if no other signal fires
)
DEFAULT_NOW = (
    "2026-06-05T12:00:00.000Z"  # fixed reference timestamp for deterministic tests
)

# Stopwords excluded during token extraction (English and Chinese).
EN_STOPWORDS = {
    "the",
    "a",
    "an",
    "is",
    "are",
    "to",
    "of",
    "and",
    "or",
    "in",
    "on",
    "for",
    "with",
    "this",
    "that",
}
ZH_STOPWORDS = {"的", "了", "是", "我", "你", "他", "她", "它", "和", "与", "在", "对"}
# Domain tokens that are never treated as stopwords regardless of language.
PROTECTED_TOKENS = {
    "api",
    "model",
    "local",
    "memory",
    "ollama",
    "qwen3",
    "rin",
    "agent",
    "system",
    "semantic",
    "sqlite",
}
# Known plural→singular mappings for Latin token normalization.
EXPLICIT_PLURALS = {
    "models": "model",
    "memories": "memory",
    "systems": "system",
    "agents": "agent",
    "apis": "api",
}


@dataclass(frozen=True)
class MemoryV2SourceMessage:
    """
    Minimal message representation passed to Memory V2 analysis (id, role, content,
    timestamps).
    """

    messageId: str
    conversationId: str
    role: str
    content: str
    createdAt: str


@dataclass(frozen=True)
class RetrievalTokenProfile:
    """Token profile for retrieval matching: Latin tokens, CJK bigrams, total count."""

    latinTokens: frozenset[str]
    cjkBigrams: frozenset[str]
    normalizedTokenCount: int


def analyze_memory_v2_source(
    message: MemoryV2SourceMessage,
    now: str = DEFAULT_NOW,
    existing_trace: bool = False,
) -> MemoryV2TraceAnalysis:
    """
    Extract signals, compute retention score, and decide trace fate.

    Returns a MemoryV2TraceAnalysis with the decision
    (promoted/reinforced/weakened/ignored).
    """
    content_character_count = len(message.content)
    age_hours = age_in_hours(message.createdAt, now)
    reasons, signals = extract_signals(message.content, content_character_count)
    base_score = score_base_signals(reasons)
    stability_hours = stability_for_reasons(reasons)
    retention_score = round_score(base_score * math.exp(-age_hours / stability_hours))
    next_reasons = list(reasons)

    if retention_score < base_score and base_score >= PROMOTION_THRESHOLD:
        next_reasons.append("decay_signal")
        signals.append(
            signal(
                "decay",
                "age_decay",
                -0.2,
                content_character_count,
                "exp(-age/stability)",
            )
        )

    if existing_trace and retention_score >= PROMOTION_THRESHOLD:
        next_reasons.append("reinforcement_signal")
        signals.append(
            signal(
                "reinforcement",
                "existing_trace",
                0.25,
                content_character_count,
                "existing-shadow-trace",
            )
        )

    return MemoryV2TraceAnalysis(
        sourceMessageId=message.messageId,
        sourceCreatedAt=message.createdAt,
        conversationId=message.conversationId,
        role=message.role,  # type: ignore[arg-type]
        contentCharacterCount=content_character_count,
        ageHours=age_hours,
        baseScore=base_score,
        stabilityHours=stability_hours,
        retentionScore=retention_score,
        decision=decide_trace(base_score, retention_score, existing_trace),
        reasons=unique_reasons(next_reasons),  # type: ignore[arg-type]
        signals=signals,
    )


def build_retrieval_token_profile(
    text: str,
    extra: str | None = None,
) -> RetrievalTokenProfile:
    """
    Build a token profile from text for later retrieval matching (Latin tokens + CJK
    bigrams).
    """
    source = f"{text} {extra}" if extra else text
    prepared = preprocess_text(source)
    latin_tokens = frozenset(extract_latin_tokens(prepared))
    cjk_bigrams = frozenset(extract_cjk_bigrams(prepared))
    return RetrievalTokenProfile(
        latinTokens=latin_tokens,
        cjkBigrams=cjk_bigrams,
        normalizedTokenCount=len(latin_tokens) + len(cjk_bigrams),
    )


def extract_signals(
    content: str,
    content_character_count: int,
) -> tuple[list[str], list[MemoryV2Signal]]:
    """
    Scan message content for preference, project, contradiction, daily, and low signals.
    """
    normalized = content.lower()
    reasons: list[str] = []
    signals: list[MemoryV2Signal] = []

    if has_preference_signal(normalized):
        reasons.append("preference_signal")
        signals.append(
            signal(
                "preference",
                "owner_preference",
                0.65,
                content_character_count,
                "preference",
            )
        )
    if has_project_signal(normalized):
        reasons.append("project_signal")
        signals.append(
            signal(
                "project",
                "active_project",
                0.6,
                content_character_count,
                "project",
            )
        )
    if has_contradiction_signal(normalized):
        reasons.append("contradiction_signal")
        signals.append(
            signal(
                "conflict",
                "contradiction",
                0.7,
                content_character_count,
                "contradiction",
            )
        )
    if not reasons and len(content.strip()) > LOW_SIGNAL_MAX_CHARACTERS:
        reasons.append("daily_signal")
        signals.append(
            signal("salience", "daily_event", 0.4, content_character_count, "daily")
        )
    if not reasons:
        reasons.append("low_signal")
        signals.append(
            signal(
                "low_signal",
                "short_acknowledgement",
                0.05,
                content_character_count,
                "low-signal",
            )
        )

    signals.append(
        signal("recency", "message_age", 0.1, content_character_count, "created_at")
    )
    return unique_reasons(reasons), signals


def score_base_signals(reasons: list[str]) -> float:
    if "contradiction_signal" in reasons:
        return 0.8
    if "preference_signal" in reasons:
        return 0.75
    if "project_signal" in reasons:
        return 0.7
    if "daily_signal" in reasons:
        return 0.5
    return 0.1


def stability_for_reasons(reasons: list[str]) -> float:
    if "preference_signal" in reasons:
        return 720
    if "project_signal" in reasons:
        return 336
    if "contradiction_signal" in reasons:
        return 168
    if "daily_signal" in reasons:
        return 72
    return 24


def decide_trace(
    base_score: float,
    retention_score: float,
    existing_trace: bool,
) -> MemoryV2Decision:
    """
    Decide trace fate: promoted (new), reinforced (existing), weakened (decayed), or
    ignored.
    """
    if retention_score >= PROMOTION_THRESHOLD:
        return "reinforced" if existing_trace else "promoted"
    if base_score >= PROMOTION_THRESHOLD:
        return "weakened"
    return "ignored"


def signal(
    signal_type: str,
    signal_key: str,
    signal_weight: float,
    content_character_count: int,
    matched_pattern: str,
) -> MemoryV2Signal:
    return MemoryV2Signal(
        signalType=signal_type,  # type: ignore[arg-type]
        signalKey=signal_key,
        signalWeight=signal_weight,
        evidence=MemoryV2SignalEvidence(
            rawTextIncluded=False,
            contentCharacterCount=content_character_count,
            matchedPattern=matched_pattern,
        ),
    )


def preprocess_text(text: str) -> str:
    prepared = unicodedata.normalize("NFKC", text).lower()
    prepared = re.sub(r"[/\\|]+", " ", prepared)
    prepared = re.sub(r"[-_]+", " ", prepared)
    prepared = re.sub(r"[^\w\s]+", " ", prepared, flags=re.UNICODE)
    return re.sub(r"\s+", " ", prepared).strip()


def normalize_latin_token(raw: str) -> str:
    lower = raw.lower().strip()
    if not lower:
        return lower
    explicit = EXPLICIT_PLURALS.get(lower)
    if explicit:
        return explicit
    if lower.endswith("ies") and len(lower) > 4:
        singular = f"{lower[:-3]}y"
        if len(singular) >= 3:
            return singular
    if (
        lower.endswith("s")
        and len(lower) >= 5
        and not lower.endswith(("ss", "us", "is"))
    ):
        singular = lower[:-1]
        if len(singular) >= 3:
            return singular
    return lower


def is_stopword(token: str) -> bool:
    if token in PROTECTED_TOKENS:
        return False
    if token in EN_STOPWORDS:
        return True
    if token in ZH_STOPWORDS:
        return True
    return len(token) == 1 and token in ZH_STOPWORDS


def extract_latin_tokens(prepared: str) -> set[str]:
    tokens: set[str] = set()
    for raw in re.findall(r"[a-z0-9]+", prepared, flags=re.IGNORECASE):
        normalized = normalize_latin_token(raw)
        if normalized and not is_stopword(normalized):
            tokens.add(normalized)
    return tokens


def extract_cjk_bigrams(prepared: str) -> set[str]:
    bigrams: set[str] = set()
    for run in re.findall(r"[\u3400-\u9fff\u3040-\u30ff]+", prepared):
        if len(run) == 1:
            if run not in ZH_STOPWORDS:
                bigrams.add(run)
            continue
        for index in range(len(run) - 1):
            bigram = run[index : index + 2]
            if not is_cjk_bigram_stopword(bigram):
                bigrams.add(bigram)
    return bigrams


def is_cjk_bigram_stopword(bigram: str) -> bool:
    return all(char in ZH_STOPWORDS for char in bigram)


def has_preference_signal(content: str) -> bool:
    """Check for owner preference keywords (English and Chinese)."""
    return bool(re.search(r"\b(prefer|preference|like|want)\b", content)) or any(
        term in content for term in ("希望", "偏好", "喜欢")
    )


def has_project_signal(content: str) -> bool:
    """Check for active-project keywords (English and Chinese)."""
    return bool(re.search(r"\b(project|package|rin_loading|memory v2)\b", content)) or (
        "计划" in content or "项目" in content
    )


def has_contradiction_signal(content: str) -> bool:
    """Check for contradiction/change-of-mind keywords (English and Chinese)."""
    return bool(
        re.search(r"\b(actually|no longer|not anymore|instead)\b", content)
    ) or ("不要" in content or "不再" in content or "改为" in content)


def age_in_hours(created_at: str, now: str) -> float:
    """Compute the age of a message in hours from its ISO 8601 timestamp."""
    created = parse_iso(created_at)
    current = parse_iso(now)
    return max(0, (current - created).total_seconds() / 3600)


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def round_score(value: float) -> float:
    return round(value * 1000) / 1000


def unique_reasons(reasons: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for reason in reasons:
        if reason not in seen:
            output.append(reason)
            seen.add(reason)
    return output
