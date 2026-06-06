from __future__ import annotations

import os

from rin.preview import format_preview_smoke_report, run_preview_smoke


def main() -> None:
    retain = os.environ.get("RIN_PYTHON_PREVIEW_RETAIN_DATA") == "1"
    print(format_preview_smoke_report(run_preview_smoke(retain_data=retain)))


if __name__ == "__main__":
    main()
