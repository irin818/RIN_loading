"""CLI entry point: start the production FastAPI server on 127.0.0.1:8765."""

from __future__ import annotations

import os
from typing import cast

import uvicorn

from rin.conversation import ModelAdapterProtocol
from rin.diagnostics.safety import PRODUCTION_RIN_DATA_DIR
from rin.model import OLLAMA_ADAPTER_ID, create_ollama_adapter_from_env
from rin.server import create_app
from rin.storage import create_data_layout

_HOST = "127.0.0.1"
_PORT = 8765


def _local_url(host: str = _HOST, port: int = _PORT) -> str:
    """Return the local server URL string."""
    return f"http://{host}:{port}"


def main() -> None:
    """
    Start the production FastAPI server on 127.0.0.1:8765 with the configured model
    adapter.
    """
    layout = create_data_layout(str(PRODUCTION_RIN_DATA_DIR), cwd="/")
    adapter: ModelAdapterProtocol | None = None
    if os.environ.get("RIN_MODEL_ADAPTER") == OLLAMA_ADAPTER_ID:
        adapter = cast(ModelAdapterProtocol, create_ollama_adapter_from_env())
    print("RIN Python Production Server")
    print(f"Data directory: {layout.rootDir}")
    print(f"URL: {_local_url()}")
    print(f"Adapter: {os.environ.get('RIN_MODEL_ADAPTER', 'rin-mock-local')}")
    uvicorn.run(
        create_app(layout, adapter=adapter),
        host=_HOST,
        port=_PORT,
        log_level="info",
    )


if __name__ == "__main__":
    main()
