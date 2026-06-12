#!/usr/bin/env python3
"""Check focused per-file coverage thresholds from coverage.py JSON output."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

THRESHOLDS = {
    "src/rin/context/v2.py": 90.0,
    "src/rin/memory/v2.py": 90.0,
    "src/rin/conversation/runtime.py": 90.0,
}


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    coverage_path = Path(args[0]) if args else Path("coverage.json")
    if not coverage_path.is_file():
        print(f"Coverage JSON not found: {coverage_path}", file=sys.stderr)
        return 2

    payload = json.loads(coverage_path.read_text(encoding="utf-8"))
    files = payload.get("files", {})
    if not isinstance(files, dict):
        print("Coverage JSON does not contain a files object.", file=sys.stderr)
        return 2

    failures: list[str] = []
    for target, threshold in THRESHOLDS.items():
        entry = find_file_entry(files, target)
        if entry is None:
            failures.append(f"{target}: missing from coverage report")
            continue
        percent = coverage_percent(entry)
        status = "ok" if percent >= threshold else "failed"
        print(f"{target}: {percent:.2f}% >= {threshold:.2f}% [{status}]")
        if percent < threshold:
            failures.append(f"{target}: {percent:.2f}% < {threshold:.2f}%")

    if failures:
        print("Coverage threshold failures:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1
    return 0


def find_file_entry(files: dict[str, Any], target: str) -> dict[str, Any] | None:
    direct = files.get(target)
    if isinstance(direct, dict):
        return direct
    for path, entry in files.items():
        if str(path).endswith(target) and isinstance(entry, dict):
            return entry
    return None


def coverage_percent(entry: dict[str, Any]) -> float:
    summary = entry.get("summary", {})
    if not isinstance(summary, dict):
        return 0.0
    value = summary.get("percent_covered", 0.0)
    return float(value)


if __name__ == "__main__":
    raise SystemExit(main())
