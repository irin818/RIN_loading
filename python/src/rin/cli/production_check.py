from __future__ import annotations

import os

from rin.cutover import (
    format_python_production_check_report,
    run_python_production_check,
)


def main() -> None:
    check_local_model = os.environ.get("RIN_PYTHON_CHECK_LOCAL_MODEL") == "1"
    print(
        format_python_production_check_report(
            run_python_production_check(check_local_model=check_local_model)
        )
    )


if __name__ == "__main__":
    main()
