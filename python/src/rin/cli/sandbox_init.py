from __future__ import annotations

from rin.sandbox import format_sandbox_init_report, initialize_sandbox


def main() -> None:
    print(format_sandbox_init_report(initialize_sandbox()))


if __name__ == "__main__":
    main()
