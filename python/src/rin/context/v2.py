"""
Context V2 assembly: order segments by priority, apply budget, and produce a
ContextV2Report.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

from rin.contracts import ContextV2Report, ContextV2ReportSegment, ContextV2SegmentType

DEFAULT_CONTEXT_V2_MAX_CHARACTERS = 2400


class ContextV2InputSegment(BaseModel):
    """
    One piece of context to consider for injection (system prompt, profile, history,
    memory trace, etc.).
    """

    model_config = ConfigDict(extra="forbid")

    id: str
    type: ContextV2SegmentType
    content: str
    sourceId: str
    provenance: str
    protected: bool


ContextV2SkipReason = Literal[
    "included",
    "duplicate_source",
    "budget_exceeded",
    "missing_source",
]


def build_context_v2_report(
    segments: list[ContextV2InputSegment],
    max_characters: int = DEFAULT_CONTEXT_V2_MAX_CHARACTERS,
) -> ContextV2Report:
    """Order segments by priority, apply the character budget, and produce a report.

    Protected segments always pass. Non-protected segments are skipped if they duplicate
    a source that was already included or if they would exceed the budget.
    """
    max_chars = max(1, max_characters)
    ordered = order_segments(segments)
    seen_sources: set[str] = set()
    report_segments: list[ContextV2ReportSegment] = []
    character_count = 0

    for item in ordered:
        duplicate = item.sourceId in seen_sources and not item.protected
        would_fit = character_count + len(item.content) <= max_chars
        included = item.protected or (not duplicate and would_fit)
        if included:
            skip_reason: ContextV2SkipReason = "included"
        elif duplicate:
            skip_reason = "duplicate_source"
        else:
            skip_reason = "budget_exceeded"

        if included:
            character_count += len(item.content)
            seen_sources.add(item.sourceId)

        report_segments.append(
            ContextV2ReportSegment(
                id=item.id,
                type=item.type,
                sourceId=item.sourceId,
                provenance=item.provenance,
                included=included,
                protected=item.protected,
                characterCount=len(item.content),
                skipReason=skip_reason,
            )
        )

    included_segments = [item for item in report_segments if item.included]
    latest_owner = next(
        (item for item in report_segments if item.type == "current_owner_message"),
        None,
    )
    return ContextV2Report(
        mode="context-v2-report",
        status="ready",
        shadowOnly=True,
        productionContextChanged=False,
        providerCallCount=0,
        fullTextIncluded=False,
        maxCharacters=max_chars,
        totalInputSegments=len(report_segments),
        includedSegments=len(included_segments),
        skippedSegments=len(report_segments) - len(included_segments),
        characterCount=character_count,
        budgetExceeded=character_count > max_chars,
        latestOwnerMessagePreserved=latest_owner.included if latest_owner else False,
        order=[item.type for item in included_segments],
        segments=report_segments,
    )


def order_segments(
    segments: list[ContextV2InputSegment],
) -> list[ContextV2InputSegment]:
    """Sort segments by type priority, then by id for deterministic ordering."""
    return sorted(segments, key=lambda item: (priority_for(item.type), item.id))


def priority_for(segment_type: ContextV2SegmentType) -> int:
    """
    Return the ordering priority for a context segment type (lower = earlier in the
    prompt).
    """
    priorities: dict[ContextV2SegmentType, int] = {
        "system": 0,
        "rin_profile": 1,
        "owner_profile": 2,
        "current_owner_message": 3,
        "short_term_window": 4,
        "memory_v2_trace": 5,
        "older_reference": 6,
    }
    return priorities[segment_type]


def segment(
    segment_type: ContextV2SegmentType,
    segment_id: str,
    source_id: str,
    content: str,
    protected: bool,
) -> ContextV2InputSegment:
    """Convenience constructor that auto-generates the provenance string."""
    return ContextV2InputSegment(
        id=segment_id,
        type=segment_type,
        sourceId=source_id,
        content=content,
        protected=protected,
        provenance=f"{segment_type}:{source_id}",
    )
