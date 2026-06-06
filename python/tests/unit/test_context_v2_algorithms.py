from typing import Any

from rin.context import build_context_v2_report, segment


def included_ids(report: Any) -> list[str]:
    return [item.id for item in report.segments if item.included]


def skipped_ids(report: Any) -> list[str]:
    return [item.id for item in report.segments if not item.included]


def fixture_segments() -> list[Any]:
    return [
        segment("memory_v2_trace", "trace-1", "trace:1", "trace", False),
        segment(
            "current_owner_message",
            "owner-latest",
            "message:latest",
            "owner",
            True,
        ),
        segment("rin_profile", "rin-profile", "config:rin", "rin profile", True),
        segment("older_reference", "older-1", "older:1", "older", False),
        segment("system", "system", "system", "system", True),
        segment("short_term_window", "short-1", "message:short", "short", False),
        segment(
            "owner_profile",
            "owner-profile",
            "config:owner",
            "owner profile",
            True,
        ),
    ]


def test_orders_core_segments_like_typescript_fixture() -> None:
    report = build_context_v2_report(fixture_segments())

    assert report.order == [
        "system",
        "rin_profile",
        "owner_profile",
        "current_owner_message",
        "short_term_window",
        "memory_v2_trace",
        "older_reference",
    ]
    assert included_ids(report) == [
        "system",
        "rin-profile",
        "owner-profile",
        "owner-latest",
        "short-1",
        "trace-1",
        "older-1",
    ]
    assert report.providerCallCount == 0
    assert report.fullTextIncluded is False


def test_preserves_owner_under_budget_pressure() -> None:
    report = build_context_v2_report(
        [
            segment("system", "system", "system", "sys" * 100, True),
            segment(
                "current_owner_message",
                "owner-latest",
                "message:latest",
                "latest owner must stay",
                True,
            ),
            segment("memory_v2_trace", "trace-large", "trace:large", "x" * 600, False),
        ],
        max_characters=180,
    )

    assert report.order == ["system", "current_owner_message"]
    assert included_ids(report) == ["system", "owner-latest"]
    assert skipped_ids(report) == ["trace-large"]
    assert report.latestOwnerMessagePreserved is True
    assert report.segments[-1].skipReason == "budget_exceeded"


def test_deduplicates_shared_sources() -> None:
    report = build_context_v2_report(
        [
            segment("system", "system", "system", "system", True),
            segment(
                "current_owner_message",
                "owner-latest",
                "message:latest",
                "latest",
                True,
            ),
            segment("short_term_window", "short-dup", "message:dup", "short", False),
            segment("memory_v2_trace", "trace-dup", "message:dup", "trace", False),
        ]
    )

    assert report.order == ["system", "current_owner_message", "short_term_window"]
    assert included_ids(report) == ["system", "owner-latest", "short-dup"]
    assert skipped_ids(report) == ["trace-dup"]
    assert report.segments[-1].skipReason == "duplicate_source"


def test_report_is_deterministic() -> None:
    first = build_context_v2_report(fixture_segments())
    second = build_context_v2_report(fixture_segments())

    assert first == second


def test_protected_segments_can_exceed_budget_like_typescript() -> None:
    report = build_context_v2_report(
        [
            segment("system", "system", "system", "system" * 100, True),
            segment(
                "current_owner_message",
                "owner",
                "message:owner",
                "owner" * 100,
                True,
            ),
        ],
        max_characters=1,
    )

    assert included_ids(report) == ["system", "owner"]
    assert report.budgetExceeded is True
    assert report.latestOwnerMessagePreserved is True
