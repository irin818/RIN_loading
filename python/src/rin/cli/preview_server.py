from __future__ import annotations

import os

import uvicorn

from rin.preview import PREVIEW_HOST, PREVIEW_PORT, create_preview_layout, preview_url
from rin.server import create_app


def main() -> None:
    data_dir = os.environ.get("RIN_PYTHON_PREVIEW_DATA_DIR")
    layout = create_preview_layout(data_dir)
    app = create_app(layout)
    print("RIN Python Preview Candidate Mode")
    print("This is not the production backend.")
    print(f"Data directory: {layout.rootDir}")
    print(f"URL: {preview_url()}")
    uvicorn.run(app, host=PREVIEW_HOST, port=PREVIEW_PORT, log_level="info")


if __name__ == "__main__":
    main()
