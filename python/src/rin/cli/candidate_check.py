"""Candidate check for the current Python migration stage."""

from __future__ import annotations

import sys

from rin.cli._runner import run_steps


def main() -> int:
    return run_steps(
        [
            ("python check", [sys.executable, "-m", "rin.cli.check"]),
            ("python parity check", [sys.executable, "-m", "rin.cli.parity_check"]),
            ("python readiness", [sys.executable, "-m", "rin.cli.readiness"]),
        ],
    )


if __name__ == "__main__":
    raise SystemExit(main())
