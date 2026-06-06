from __future__ import annotations

from rin.cutover import format_backup_report, run_real_data_backup


def main() -> None:
    print(format_backup_report(run_real_data_backup()))


if __name__ == "__main__":
    main()
