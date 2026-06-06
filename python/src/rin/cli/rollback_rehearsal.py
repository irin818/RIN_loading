from __future__ import annotations

from rin.migration_dry_run import (
    format_rollback_rehearsal_report,
    run_rollback_rehearsal,
)


def main() -> None:
    print(format_rollback_rehearsal_report(run_rollback_rehearsal()))


if __name__ == "__main__":
    main()
