from __future__ import annotations

import asyncio

from rin.model.local_chat_smoke import (
    format_local_chat_smoke_report,
    run_local_chat_smoke,
)


def main() -> None:
    print(format_local_chat_smoke_report(asyncio.run(run_local_chat_smoke())))


if __name__ == "__main__":
    main()
