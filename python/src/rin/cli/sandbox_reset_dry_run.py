from __future__ import annotations

from rin.sandbox import (
    format_sandbox_reset_dry_run_report,
    run_sandbox_reset_dry_run,
)


def main() -> None:
    print(format_sandbox_reset_dry_run_report(run_sandbox_reset_dry_run()))


if __name__ == "__main__":
    main()
