from __future__ import annotations

from rin.preview import format_preview_smoke_report
from rin.sandbox import run_sandbox_smoke


def main() -> None:
    print(format_preview_smoke_report(run_sandbox_smoke()))


if __name__ == "__main__":
    main()
