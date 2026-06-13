"""Assistant-output sanitizer shared by model adapters and conversation runtime."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class SanitizedAssistantContent:
    """Result of sanitizing raw model output."""

    content: str
    removed: bool
    thinkingTagRemoved: bool
    thinkingLikePrefixRemoved: bool
    extractedFinalAnswer: bool
    rejected: bool
    rejectionReason: str | None
    rulesApplied: list[str]


THINKING_PREFIX_PATTERNS = (
    re.compile(r"^\s*(首先[，,]\s*)?用户(问|询问|想知道)", re.I),
    re.compile(r"^\s*我需要(分析|判断|考虑|先)", re.I),
    re.compile(r"^\s*我们需要(分析|判断|考虑|先|检查)", re.I),
    re.compile(r"^\s*根据(系统|上下文|用户)", re.I),
    re.compile(
        r"^\s*(响应策略|最终响应思路|完整响应草稿|分析|思路|检查是否|为什么这样)\s*[:：]?",
        re.I,
    ),
    re.compile(
        r"^\s*(okay,?\s*)?(first,\s*)?(the user|user) "
        r"(is )?(asking|asks|asked|wants)",
        re.I,
    ),
    re.compile(r"^\s*i need to (analy[sz]e|consider|determine)", re.I),
    re.compile(r"^\s*let me (check|think|analy[sz]e|look)", re.I),
)

FINAL_ANSWER_MARKER_PATTERN = re.compile(
    (
        r"(?:最终答案|最终回答|最终响应|直接回答|答案|Final answer|Final response)"
        r"\s*[:：]\s*"
    ),
    re.I,
)


def sanitize_assistant_content(content: str) -> tuple[str, bool]:
    """Return (sanitized_text, was_anything_removed)."""
    sanitized = sanitize_assistant_content_details(content)
    return "" if sanitized.rejected else sanitized.content, sanitized.removed


def sanitize_assistant_content_details(content: str) -> SanitizedAssistantContent:
    """Apply the full hidden-reasoning sanitizer pipeline."""
    rules = [
        "remove paired <think> blocks",
        "keep content after final </think>",
        "extract explicit final answer section",
        "reject thinking-like preface without safe final answer",
        "reject remaining unsafe thinking markers",
    ]
    working = content.strip()
    thinking_tag_removed = False
    thinking_prefix_removed = False
    extracted_final_answer = False

    if has_unclosed_thinking_tag(working):
        return SanitizedAssistantContent(
            content="",
            removed=False,
            thinkingTagRemoved=False,
            thinkingLikePrefixRemoved=False,
            extractedFinalAnswer=False,
            rejected=True,
            rejectionReason="unclosed_thinking_tag",
            rulesApplied=rules,
        )

    without_pairs = re.sub(r"<think>.*?</think>", "", working, flags=re.DOTALL | re.I)
    if without_pairs != working:
        working = without_pairs.strip()
        thinking_tag_removed = True

    lower = working.lower()
    marker = "</think>"
    if marker in lower:
        index = lower.rfind(marker)
        working = working[index + len(marker) :].strip()
        thinking_tag_removed = True

    marker_match = list(FINAL_ANSWER_MARKER_PATTERN.finditer(working))
    if marker_match:
        working = working[marker_match[-1].end() :].strip()
        extracted_final_answer = True

    thinking_like_prefix = has_thinking_like_prefix_text(working)
    if thinking_like_prefix and not extracted_final_answer:
        return SanitizedAssistantContent(
            content="",
            removed=thinking_tag_removed,
            thinkingTagRemoved=thinking_tag_removed,
            thinkingLikePrefixRemoved=False,
            extractedFinalAnswer=False,
            rejected=True,
            rejectionReason="thinking_like_prefix_without_final_answer",
            rulesApplied=rules,
        )
    if thinking_like_prefix:
        thinking_prefix_removed = True

    unsafe = has_unsafe_thinking_leak(working)
    return SanitizedAssistantContent(
        content=working,
        removed=(
            thinking_tag_removed
            or thinking_prefix_removed
            or extracted_final_answer
            or working != content.strip()
        ),
        thinkingTagRemoved=thinking_tag_removed,
        thinkingLikePrefixRemoved=thinking_prefix_removed,
        extractedFinalAnswer=extracted_final_answer,
        rejected=unsafe,
        rejectionReason="unsafe_thinking_marker_remaining" if unsafe else None,
        rulesApplied=rules,
    )


def has_thinking_like_prefix_text(content: str) -> bool:
    """Check whether the text starts with a known thinking-like preface pattern."""
    return any(pattern.search(content) for pattern in THINKING_PREFIX_PATTERNS)


def has_unclosed_thinking_tag(content: str) -> bool:
    """Check whether the last opening <think> tag has no later closing tag."""
    lowered = content.lower()
    last_open = lowered.rfind("<think>")
    if last_open == -1:
        return False
    last_close = lowered.rfind("</think>")
    return last_close < last_open


def has_unsafe_thinking_leak(content: str) -> bool:
    """Check for known unsafe thinking markers in user-facing output."""
    lowered = content.lower()
    markers = (
        "<think>",
        "</think>",
        "internal analysis",
        "hidden reasoning",
        "reasoning process",
        "首先，用户问",
        "用户问",
        "我需要分析",
        "根据系统",
        "我们需要",
        "响应策略",
        "最终响应思路",
        "完整响应草稿",
        "检查是否",
        "the user is asking",
        "let me check",
        "let me think",
    )
    return any(
        marker in lowered for marker in markers
    ) or has_thinking_like_prefix_text(content)


def has_thinking_tag_text(content: str) -> bool:
    """Check whether the text contains <think> or </think> tags."""
    lowered = content.lower()
    return "<think>" in lowered or "</think>" in lowered
