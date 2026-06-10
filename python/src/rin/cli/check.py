"""Aggregate provider-free Python quality check."""

from __future__ import annotations

import sys

from rin.cli._runner import run_steps


def main() -> int:
    """Run the provider-free quality pipeline: pytest → ruff → mypy."""
    return run_steps(
        [
            ("pytest", [sys.executable, "-m", "pytest"]),
            ("ruff check", [sys.executable, "-m", "ruff", "check", "."]),
            (
                "ruff format --check",
                [sys.executable, "-m", "ruff", "format", "--check", "."],
            ),
            ("mypy", [sys.executable, "-m", "mypy", "src"]),
        ],
    )


if __name__ == "__main__":
    raise SystemExit(main())
