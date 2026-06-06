from __future__ import annotations

from rin.model.local_chat_smoke import format_local_chat_smoke_report
from rin.preview import run_async_preview_local_model_smoke


def main() -> None:
    print(format_local_chat_smoke_report(run_async_preview_local_model_smoke()))


if __name__ == "__main__":
    main()
