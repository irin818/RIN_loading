from __future__ import annotations

import os
from typing import cast

import uvicorn

from rin.conversation import ModelAdapterProtocol
from rin.model import OLLAMA_ADAPTER_ID, create_ollama_adapter_from_env
from rin.preview import PREVIEW_HOST, PREVIEW_PORT, preview_url
from rin.sandbox import create_sandbox_layout, initialize_sandbox
from rin.server import create_app


def main() -> None:
    initialize_sandbox()
    layout = create_sandbox_layout()
    adapter: ModelAdapterProtocol | None = None
    if os.environ.get("RIN_MODEL_ADAPTER") == OLLAMA_ADAPTER_ID:
        adapter = cast(ModelAdapterProtocol, create_ollama_adapter_from_env())
    print("RIN Python Persistent Sandbox Mode")
    print("This is not production .rin-data.")
    print("TypeScript fallback remains available.")
    print(f"Data directory: {layout.rootDir}")
    print(f"URL: {preview_url()}")
    if adapter is None:
        print("Adapter: rin-mock-local")
    else:
        print("Adapter: rin-ollama-local")
        print("Local model target: qwen3:4b unless overridden by environment.")
    uvicorn.run(
        create_app(layout, adapter=adapter),
        host=PREVIEW_HOST,
        port=PREVIEW_PORT,
    )


if __name__ == "__main__":
    main()
