"""CLI entry point: optional external API chat smoke test."""

from __future__ import annotations

import asyncio

from rin.model.api_chat_smoke import (
    format_api_chat_smoke_report,
    run_api_chat_smoke,
)


def main() -> None:
    """Run the optional API chat smoke test and print a safe report."""
    print(format_api_chat_smoke_report(asyncio.run(run_api_chat_smoke())))


if __name__ == "__main__":
    main()
