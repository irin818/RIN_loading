from __future__ import annotations

import os
from typing import cast

import uvicorn

from rin.conversation import ModelAdapterProtocol
from rin.diagnostics.safety import (
    PRODUCTION_RIN_DATA_DIR,
    is_python_production_cutover_marked,
    python_cutover_marker_path,
)
from rin.model import OLLAMA_ADAPTER_ID, create_ollama_adapter_from_env
from rin.preview import PREVIEW_HOST, PREVIEW_PORT, preview_url
from rin.server import create_app
from rin.storage import create_data_layout


def main() -> None:
    if not is_python_production_cutover_marked(PRODUCTION_RIN_DATA_DIR):
        marker = python_cutover_marker_path(PRODUCTION_RIN_DATA_DIR)
        raise SystemExit(
            "Python production server refuses to start without migration marker: "
            f"{marker}"
        )
    layout = create_data_layout(str(PRODUCTION_RIN_DATA_DIR), cwd="/")
    adapter: ModelAdapterProtocol | None = None
    if os.environ.get("RIN_MODEL_ADAPTER") == OLLAMA_ADAPTER_ID:
        adapter = cast(ModelAdapterProtocol, create_ollama_adapter_from_env())
    print("RIN Python Primary Launcher")
    print("TypeScript fallback: scripts/typescript-fallback/")
    print(f"Data directory: {layout.rootDir}")
    print(f"Migration marker: {python_cutover_marker_path(layout.rootDir)}")
    print(f"URL: {preview_url()}")
    print(f"Adapter: {os.environ.get('RIN_MODEL_ADAPTER', 'rin-mock-local')}")
    uvicorn.run(
        create_app(layout, adapter=adapter),
        host=PREVIEW_HOST,
        port=PREVIEW_PORT,
        log_level="info",
    )


if __name__ == "__main__":
    main()
