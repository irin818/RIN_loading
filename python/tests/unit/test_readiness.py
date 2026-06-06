from __future__ import annotations

from rin.diagnostics.readiness import (
    build_python_readiness_report,
    format_python_readiness_report,
)


def test_readiness_is_provider_free_and_safe() -> None:
    report = build_python_readiness_report()
    output = format_python_readiness_report(report)

    assert report.ok is True
    assert report.provider_call_count == 0
    assert report.external_network_used is False
    assert report.production_data_protected is True
    assert "providerCallCount: 0" in output
    assert "/Users/irin/Documents/RIN_loading/.rin-data" not in output
