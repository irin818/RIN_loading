from __future__ import annotations

from rin.cutover import (
    format_migration_apply_report,
    run_real_data_migration_apply,
)


def main() -> None:
    print(format_migration_apply_report(run_real_data_migration_apply()))


if __name__ == "__main__":
    main()
