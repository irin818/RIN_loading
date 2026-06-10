"""CLI entry point: load and validate profiles, then print a profile report."""

from __future__ import annotations

import os

from rin.profiles import build_profile_report, format_profile_report
from rin.storage import create_data_layout


def main() -> None:
    """Load profiles from RIN_DATA_DIR (default .rin-data), validate, and print a report."""
    data_dir = os.environ.get("RIN_DATA_DIR", ".rin-data")
    report = build_profile_report(create_data_layout(data_dir))
    print(format_profile_report(report))


if __name__ == "__main__":
    main()
