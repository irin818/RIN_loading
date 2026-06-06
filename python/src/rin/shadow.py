from __future__ import annotations

import hashlib
import shutil
from dataclasses import dataclass
from pathlib import Path

from rin.database import (
    create_conversation,
    inspect_database,
)
from rin.diagnostics.safety import (
    PRODUCTION_RIN_DATA_DIR,
    assert_not_production_data_path,
    create_temp_data_dir,
)
from rin.profiles import build_profile_report
from rin.storage import create_data_layout


@dataclass(frozen=True)
class ShadowValidationReport:
    mode: str
    status: str
    sourcePath: str
    copyPath: str | None
    retainedCopy: bool
    sourceDbHashUnchanged: bool
    schemaVersion: int | None
    conversationCount: int
    messageCount: int
    memoryTraceCount: int
    profileFilesPresent: int
    readCompatibility: str
    writeSimulation: str
    privateTextIncluded: bool
    fullProfileIncluded: bool
    cleanup: str


def run_copy_data_shadow_report(
    source: Path = PRODUCTION_RIN_DATA_DIR,
    retain_copy: bool = False,
    simulate_write: bool = True,
) -> ShadowValidationReport:
    source = source.resolve()
    source_db = source / "databases" / "rin.sqlite"
    if not source.exists() or not source_db.exists():
        return ShadowValidationReport(
            mode="copy-data-shadow-report",
            status="skipped_missing_source",
            sourcePath=str(source),
            copyPath=None,
            retainedCopy=False,
            sourceDbHashUnchanged=True,
            schemaVersion=None,
            conversationCount=0,
            messageCount=0,
            memoryTraceCount=0,
            profileFilesPresent=0,
            readCompatibility="skipped",
            writeSimulation="skipped",
            privateTextIncluded=False,
            fullProfileIncluded=False,
            cleanup="none",
        )

    source_hash_before = file_hash(source_db)
    copy_root = create_temp_data_dir("rin-python-shadow-").path
    write_status = "skipped"
    try:
        shutil.copytree(source, copy_root, dirs_exist_ok=True)
        copied_layout = create_data_layout(str(copy_root), cwd="/")
        status = inspect_database(copied_layout)
        profile_report = build_profile_report(copied_layout)
        if simulate_write:
            assert_not_production_data_path(copy_root)
            create_conversation(
                copied_layout,
                "Python shadow write simulation",
                "2026-06-06T00:00:00.000Z",
            )
            write_status = "passed_on_copy"
        source_hash_after = file_hash(source_db)
        return ShadowValidationReport(
            mode="copy-data-shadow-report",
            status="passed" if source_hash_before == source_hash_after else "failed",
            sourcePath=str(source),
            copyPath=str(copy_root),
            retainedCopy=retain_copy,
            sourceDbHashUnchanged=source_hash_before == source_hash_after,
            schemaVersion=status.schemaVersion,
            conversationCount=status.counts.conversations,
            messageCount=status.counts.messages,
            memoryTraceCount=status.counts.memoryV2Traces,
            profileFilesPresent=sum(1 for item in profile_report.files if item.exists),
            readCompatibility="passed",
            writeSimulation=write_status,
            privateTextIncluded=False,
            fullProfileIncluded=False,
            cleanup="retained" if retain_copy else "removed",
        )
    finally:
        if not retain_copy:
            shutil.rmtree(copy_root, ignore_errors=True)


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def format_shadow_validation_report(report: ShadowValidationReport) -> str:
    return "\n".join(
        [
            "RIN Python copied-data shadow validation report.",
            f"Mode: {report.mode}",
            f"Status: {report.status}",
            f"Source path: {report.sourcePath}",
            f"Copy path: {report.copyPath or 'none'}",
            f"Retained copy: {'yes' if report.retainedCopy else 'no'}",
            "Source DB hash unchanged: "
            f"{'yes' if report.sourceDbHashUnchanged else 'no'}",
            f"Schema version: {report.schemaVersion or 'none'}",
            f"Conversations: {report.conversationCount}",
            f"Messages: {report.messageCount}",
            f"Memory V2 traces: {report.memoryTraceCount}",
            f"Profile files present: {report.profileFilesPresent}",
            f"Read compatibility: {report.readCompatibility}",
            f"Write simulation: {report.writeSimulation}",
            f"Private text included: {'yes' if report.privateTextIncluded else 'no'}",
            f"Full profile included: {'yes' if report.fullProfileIncluded else 'no'}",
            f"Cleanup: {report.cleanup}",
        ]
    )
