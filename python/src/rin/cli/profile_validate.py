"""CLI entry point: validate profiles and exit non-zero if invalid."""

from __future__ import annotations

import os
import sys

from rin.profiles import build_profile_report, format_profile_report
from rin.storage import create_data_layout


def main() -> None:
    """Load profiles, print a report, and exit with code 1 if validation fails."""
    data_dir = os.environ.get("RIN_DATA_DIR", ".rin-data")
    report = build_profile_report(create_data_layout(data_dir))
    print(format_profile_report(report))
    if report.status != "valid":
        sys.exit(1)


if __name__ == "__main__":
    main()
