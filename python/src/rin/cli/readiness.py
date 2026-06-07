"""CLI entry point for Python runtime readiness."""

from __future__ import annotations

from rin.diagnostics.readiness import (
    build_python_readiness_report,
    format_python_readiness_report,
)


def main() -> int:
    report = build_python_readiness_report()
    print(format_python_readiness_report(report))
    return 0 if report.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
