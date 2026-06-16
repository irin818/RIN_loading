#!/usr/bin/env python3
"""Validate the RIN Layered Avatar production asset manifest."""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
BODY_ROOT = REPO_ROOT / "public" / "body" / "rin-layered"
MANIFEST_PATH = BODY_ROOT / "manifest.json"
SUPPORTED_SUFFIXES = {".png", ".webp", ".svg"}
REQUIRED_STATES = {
    "idle",
    "thinking",
    "speaking",
    "memory",
    "warning",
    "error",
    "sleeping",
    "listening",
    "reviewing",
}


def fail(message: str) -> None:
    print(f"[rin-body-assets] ERROR: {message}", file=sys.stderr)
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


def validate_relative_asset(path_value: object, *, field: str) -> Path:
    if not isinstance(path_value, str) or not path_value.strip():
        fail(f"{field} must be a non-empty string")
    if path_value.startswith("/") or "://" in path_value:
        fail(f"{field} must be relative to {BODY_ROOT}: {path_value}")
    lowered = path_value.lower()
    if "public/live2d" in lowered or "live2d" in lowered or "cubism" in lowered:
        fail(f"{field} points at archived Live2D/Cubism content: {path_value}")
    target = (BODY_ROOT / path_value).resolve()
    try:
        target.relative_to(BODY_ROOT.resolve())
    except ValueError:
        fail(f"{field} escapes body root: {path_value}")
    if target.suffix.lower() not in SUPPORTED_SUFFIXES:
        fail(f"{field} uses unsupported asset type: {path_value}")
    if not target.is_file():
        fail(f"{field} asset does not exist: {path_value}")
    return target


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
    if payload.get("type") != "layered-avatar":
        fail("manifest type must be layered-avatar")
    if payload.get("activeRenderer") != "layered":
        fail("activeRenderer must be layered")
    if payload.get("rendererType") != "layered-avatar":
        fail("rendererType must be layered-avatar")
    if payload.get("assetMode") not in {"state-images", "layered-parts"}:
        fail("assetMode must be state-images or layered-parts")
    if payload.get("cubismStatus") not in {
        "disabled",
        "archived",
        "disabled_archived_future_route",
    }:
        fail("cubismStatus must mark Cubism disabled or archived")

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
        referenced.append(
            validate_relative_asset(
                state_payload.get("image"),
                field=f"states.{state_name}.image",
            )
        )

    layers = payload.get("layers")
    if not isinstance(layers, list) or not layers:
        fail("layers must be a non-empty array")
    for index, layer in enumerate(layers):
        if not isinstance(layer, dict):
            fail(f"layers[{index}] must be an object")
        referenced.append(validate_relative_asset(layer.get("src"), field=f"layers[{index}].src"))

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
    print("[rin-body-assets] OK")
    print(f"[rin-body-assets] manifest={MANIFEST_PATH.relative_to(REPO_ROOT)}")
    print(f"[rin-body-assets] referenced_assets={len(set(referenced))}")
    if dimensions:
        print("[rin-body-assets] dimensions=" + ", ".join(dimensions))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
