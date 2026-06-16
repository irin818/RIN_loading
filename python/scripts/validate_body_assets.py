#!/usr/bin/env python3
"""Validate the RIN simple body state-image manifest and assets."""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
BODY_ROOT = REPO_ROOT / "public" / "body" / "rin"
MANIFEST_PATH = BODY_ROOT / "manifest.json"
REQUIRED_STATES = {"默认", "生气", "惊讶", "难受"}


def fail(message: str) -> None:
    print(f"[rin-body] ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def read_manifest() -> dict[str, Any]:
    if not MANIFEST_PATH.is_file():
        fail(f"manifest not found: {MANIFEST_PATH}")
    try:
        payload = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"manifest JSON is invalid: {exc}")
    if not isinstance(payload, dict):
        fail("manifest root must be a JSON object")
    return payload


def png_dimensions(path: Path) -> tuple[int, int] | None:
    if path.suffix.lower() != ".png":
        return None
    with path.open("rb") as handle:
        header = handle.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        fail(f"invalid PNG signature: {path.relative_to(REPO_ROOT)}")
    width, height = struct.unpack(">II", header[16:24])
    return width, height


def validate_manifest(payload: dict[str, Any]) -> list[Path]:
    if not isinstance(payload.get("name"), str):
        fail("manifest must have a string name")
    if payload.get("version") != 1:
        fail("manifest version must be 1")

    states = payload.get("states")
    if not isinstance(states, dict):
        fail("states must be an object")
    missing = sorted(REQUIRED_STATES - set(states))
    if missing:
        fail(f"missing required states: {', '.join(missing)}")

    default_state = payload.get("defaultState")
    if default_state not in states:
        fail("defaultState must reference an existing state")

    referenced: list[Path] = []
    for state_name, state_payload in states.items():
        if not isinstance(state_payload, dict):
            fail(f"state {state_name} must be an object")
        image_path = state_payload.get("image")
        if not isinstance(image_path, str) or not image_path.strip():
            fail(f"states.{state_name}.image must be a non-empty string")
        target = (BODY_ROOT / image_path).resolve()
        try:
            target.relative_to(BODY_ROOT.resolve())
        except ValueError:
            fail(f"states.{state_name}.image escapes body root: {image_path}")
        if not target.is_file():
            fail(f"states.{state_name}.image asset missing: {image_path}")
        referenced.append(target)

    return referenced


def main() -> int:
    if not BODY_ROOT.is_dir():
        fail(f"body asset root does not exist: {BODY_ROOT}")
    manifest = read_manifest()
    referenced = validate_manifest(manifest)
    dimensions = []
    for path in sorted(set(referenced)):
        size = png_dimensions(path)
        if size is not None:
            dimensions.append(f"{path.relative_to(REPO_ROOT)}={size[0]}x{size[1]}")
    print("[rin-body] OK")
    print(f"[rin-body] manifest={MANIFEST_PATH.relative_to(REPO_ROOT)}")
    print(f"[rin-body] states={len(manifest['states'])}")
    print(f"[rin-body] referenced_assets={len(set(referenced))}")
    if dimensions:
        print("[rin-body] dimensions=" + ", ".join(dimensions))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
