"""Provider-free readiness report for the Python RIN runtime."""

from __future__ import annotations

import platform
import sys
from dataclasses import asdict, dataclass

from rin.diagnostics.safety import assert_safe_temp_data_dir
from rin.version import __version__


@dataclass(frozen=True)
class PythonReadinessReport:
    """Safe readiness summary for the Python runtime foundation."""

    ok: bool
    package: str
    python_version: str
    production_data_protected: bool
    temp_data_prefix: str
    provider_call_count: int
    external_network_used: bool

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def build_python_readiness_report() -> PythonReadinessReport:
    """Build a readiness report without touching real owner data."""

    assert_safe_temp_data_dir("/tmp/rin-python-readiness-probe")

    return PythonReadinessReport(
        ok=True,
        package=f"rin-core {__version__}",
        python_version=f"{platform.python_implementation()} {sys.version_info.major}."
        f"{sys.version_info.minor}.{sys.version_info.micro}",
        production_data_protected=True,
        temp_data_prefix="/tmp/rin-python-*",
        provider_call_count=0,
        external_network_used=False,
    )


def format_python_readiness_report(report: PythonReadinessReport) -> str:
    """Format readiness output without local private paths."""

    return "\n".join(
        [
            "RIN Python readiness report.",
            f"Ready: {'yes' if report.ok else 'no'}",
            f"Package: {report.package}",
            f"Python: {report.python_version}",
            "Production data protected: "
            f"{'yes' if report.production_data_protected else 'no'}",
            f"Temp data prefix: {report.temp_data_prefix}",
            f"providerCallCount: {report.provider_call_count}",
            f"External network used: {'yes' if report.external_network_used else 'no'}",
        ],
    )
