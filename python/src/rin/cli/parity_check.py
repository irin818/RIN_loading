"""Run Python foundation parity tests."""

from __future__ import annotations

import sys

from rin.cli._runner import run_steps


def main() -> int:
    """Run the parity test suite (tests/parity) via pytest."""
    return run_steps(
        [
            (
                "pytest parity",
                [sys.executable, "-m", "pytest", "tests/parity"],
            ),
        ],
    )


if __name__ == "__main__":
    raise SystemExit(main())
