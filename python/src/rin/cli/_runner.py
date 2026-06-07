"""Shared subprocess helpers for Python CLI checks."""

from __future__ import annotations

import subprocess
import sys
from collections.abc import Sequence
from pathlib import Path


def python_project_root() -> Path:
    """Return the `python/` project root from an installed or source checkout."""

    return Path(__file__).resolve().parents[3]


def run_command(args: Sequence[str], *, cwd: Path | None = None) -> int:
    """Run a command, streaming output and returning its exit code."""

    completed = subprocess.run(  # noqa: S603
        list(args),
        cwd=cwd if cwd is not None else python_project_root(),
        check=False,
    )
    return completed.returncode


def run_python_module(module: str, *args: str) -> int:
    """Run a Python module with the current interpreter."""

    return run_command([sys.executable, "-m", module, *args])


def run_steps(steps: Sequence[tuple[str, Sequence[str]]]) -> int:
    """Run named command steps in order, stopping on first failure."""

    root = python_project_root()
    for label, args in steps:
        print(f"\n== {label} ==")
        exit_code = run_command(args, cwd=root)
        if exit_code != 0:
            return exit_code
    return 0
