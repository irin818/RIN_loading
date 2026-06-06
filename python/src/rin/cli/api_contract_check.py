from __future__ import annotations

from rin.api_contract import (
    format_api_contract_check_report,
    run_api_contract_check,
)


def main() -> None:
    print(format_api_contract_check_report(run_api_contract_check()))


if __name__ == "__main__":
    main()
