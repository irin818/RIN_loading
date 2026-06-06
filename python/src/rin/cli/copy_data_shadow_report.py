from __future__ import annotations

import os
from pathlib import Path

from rin.diagnostics.safety import PRODUCTION_RIN_DATA_DIR
from rin.shadow import format_shadow_validation_report, run_copy_data_shadow_report


def main() -> None:
    source = Path(os.environ.get("RIN_SHADOW_SOURCE", str(PRODUCTION_RIN_DATA_DIR)))
    retain = os.environ.get("RIN_SHADOW_RETAIN_COPY") == "1"
    print(
        format_shadow_validation_report(
            run_copy_data_shadow_report(source=source, retain_copy=retain)
        )
    )


if __name__ == "__main__":
    main()
