from __future__ import annotations

import os

from rin.storage import build_storage_report, create_data_layout


def main() -> None:
    data_dir = os.environ.get("RIN_DATA_DIR", ".rin-data")
    report = build_storage_report(create_data_layout(data_dir))
    print(f"RIN Python storage report.\nMode: {report.mode}")
    print(f"Status: {report.status}")
    print(f"Manifest valid: {'yes' if report.manifestValid else 'no'}")
    print(f"Directories: {report.directoryCount}")
    print(f"Missing directories: {', '.join(report.missingDirectories) or 'none'}")
    print(f"providerCallCount: {report.providerCallCount}")
    print(f"Full text included: {'yes' if report.fullTextIncluded else 'no'}")
    print("Core files:")
    for item in report.coreFiles:
        print(
            f"- {item.relativePath} exists={'yes' if item.exists else 'no'} "
            f"created={'yes' if item.created else 'no'}"
        )


if __name__ == "__main__":
    main()
