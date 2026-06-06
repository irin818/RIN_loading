from __future__ import annotations

from rin.migration_dry_run import (
    format_migration_dry_run_report,
    run_production_migration_dry_run,
)


def main() -> None:
    print(format_migration_dry_run_report(run_production_migration_dry_run()))


if __name__ == "__main__":
    main()
