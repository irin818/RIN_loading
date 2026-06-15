#!/usr/bin/env python3
"""Validate the RIN Live2D runtime asset contract."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_validator() -> Callable[[Path], dict[str, object]]:
    src = repo_root() / "python" / "src"
    sys.path.insert(0, str(src))
    from rin.body import build_body_asset_diagnostics_payload

    return build_body_asset_diagnostics_payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate public/live2d/rin/rin.model3.json and related assets."
    )
    parser.add_argument(
        "--root",
        default=str(repo_root() / "public" / "live2d"),
        help="Live2D public root. Defaults to public/live2d.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print the full safe diagnostics payload as JSON.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    build_payload = load_validator()
    payload = build_payload(Path(args.root))
    model = payload["model"]
    status = str(model["status"])

    if args.json:
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print(f"RIN Live2D asset status: {status}")
        print(f"expected: {model['expectedPath']}")
        print(f"standard model installed: {model['standardModelInstalled']}")
        print(f"moc present: {model['mocPresent']}")
        print(f"textures present: {model['texturesPresent']}")
        print(f"motions present: {model['motionsPresent']}")
        print(f"expressions present: {model['expressionsPresent']}")
        print(f"physics present: {model['physicsPresent']}")
        print(f"pose present: {model['posePresent']}")
        print(f"runtime package ready: {model['runtimePackageReady']}")
        print(f"cubism core present: {model['runtimeCoreScriptPresent']}")
        print(f"cubism shaders present: {model['runtimeShaderFilesPresent']}")
        print(f"browser renderer: {model['browserRendererStatus']}")
        print(f"runtime ready: {model['runtimeReady']}")
        print(f"fallback active: {model['fallbackActive']}")
        if model["browserRendererBlocker"]:
            print(f"browser renderer blocker: {model['browserRendererBlocker']}")
        if model["missingRequiredFiles"]:
            print("missing required:")
            for item in model["missingRequiredFiles"]:
                print(f"  - {item}")
        if model["missingReferencedFiles"]:
            print("missing referenced:")
            for item in model["missingReferencedFiles"]:
                print(f"  - {item}")
        if model["runtimeShaderMissingFiles"]:
            print("missing runtime shaders:")
            for item in model["runtimeShaderMissingFiles"]:
                print(f"  - {item}")
        if model["partialCubismExports"]:
            print("partial Cubism exports:")
            for item in model["partialCubismExports"]:
                print(f"  - {item['model3Path']} ({item['status']})")

    if status == "available":
        return 0
    if status == "invalid":
        return 1
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
