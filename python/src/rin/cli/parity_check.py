"""Run Python parity tests against the TypeScript reference fixtures."""

from __future__ import annotations

import sys

from rin.cli._runner import run_steps


def main() -> int:
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
