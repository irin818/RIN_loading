from __future__ import annotations

from rin.cutover import format_preflight_report, run_real_data_preflight


def main() -> None:
    print(format_preflight_report(run_real_data_preflight()))


if __name__ == "__main__":
    main()
