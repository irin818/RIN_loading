from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

from rin.database import (
    append_audit_event,
    create_conversation,
    database_path_for,
    inspect_database,
)
from rin.diagnostics.safety import (
    PRODUCTION_RIN_DATA_DIR,
    assert_not_production_data_path,
    assert_safe_temp_data_dir,
)
from rin.profiles import build_profile_report
from rin.storage import (
    RinDataLayout,
    build_storage_report,
    create_data_layout,
    load_manifest,
)

REPO_ROOT = Path("/Users/irin/Documents/RIN_loading")
CUTOVER_STATE_DIR = REPO_ROOT / ".rin-python-cutover-state"
BACKUP_ROOT = REPO_ROOT / ".rin-python-backups"
PREFLIGHT_ARTIFACT = CUTOVER_STATE_DIR / "preflight-latest.json"
BACKUP_ARTIFACT = CUTOVER_STATE_DIR / "backup-latest.json"
DRY_RUN_ARTIFACT = CUTOVER_STATE_DIR / "dry-run-latest.json"


@dataclass(frozen=True)
class RealDataPreflightReport:
    mode: str
    status: str
    dataDir: str
    manifestValid: bool
    databaseReadable: bool
    profileValid: bool
    pythonReadable: bool
    typescriptFallbackReadable: bool
    schemaVersion: int
    conversations: int
    messages: int
    memoryV2Traces: int
    profileFilesPresent: int
    databaseHash: str
    artifactPath: str
    fullTextIncluded: bool


@dataclass(frozen=True)
class RealDataBackupReport:
    mode: str
    status: str
    sourceDir: str
    backupDir: str
    sourceDatabaseHash: str
    backupDatabaseHash: str
    backupVerified: bool
    dryRunRestoreInspectable: bool
    artifactPath: str
    fullTextIncluded: bool


@dataclass(frozen=True)
class RealDataMigrationDryRunReport:
    mode: str
    status: str
    sourceDir: str
    copyDir: str
    sourceHashBefore: str
    sourceHashAfter: str
    sourceHashUnchanged: bool
    pythonReadableAfterSimulation: bool
    typescriptFallbackReadableAfterSimulation: bool
    plannedWrites: list[str]
    rollbackPath: str
    productionApplyAvailable: bool
    artifactPath: str
    fullTextIncluded: bool


def run_real_data_preflight() -> RealDataPreflightReport:
    layout = production_layout()
    manifest_valid = True
    try:
        load_manifest(layout)
    except Exception:
        manifest_valid = False
    storage = build_storage_report(layout)
    profile = build_profile_report(layout)
    status = inspect_database(layout)
    database_hash = file_hash(database_path_for(layout))
    profile_files_present = sum(1 for item in profile.files if item.exists)
    report_status = (
        "passed"
        if all(
            [
                manifest_valid,
                status.schemaVersion >= 6,
                profile.status == "valid",
                storage.status == "ready",
            ]
        )
        else "failed"
    )
    report = RealDataPreflightReport(
        mode="real-data-preflight",
        status=report_status,
        dataDir=str(layout.rootDir),
        manifestValid=manifest_valid,
        databaseReadable=status.schemaVersion >= 1,
        profileValid=profile.status == "valid",
        pythonReadable=status.schemaVersion >= 6,
        typescriptFallbackReadable=typescript_readable_schema(status.schemaVersion),
        schemaVersion=status.schemaVersion,
        conversations=status.counts.conversations,
        messages=status.counts.messages,
        memoryV2Traces=status.counts.memoryV2Traces,
        profileFilesPresent=profile_files_present,
        databaseHash=database_hash,
        artifactPath=str(PREFLIGHT_ARTIFACT),
        fullTextIncluded=False,
    )
    write_artifact(PREFLIGHT_ARTIFACT, asdict(report))
    return report


def run_real_data_backup() -> RealDataBackupReport:
    preflight = run_real_data_preflight()
    if preflight.status != "passed":
        raise RuntimeError("Real-data preflight must pass before backup.")
    source = PRODUCTION_RIN_DATA_DIR.resolve()
    BACKUP_ROOT.mkdir(parents=True, exist_ok=True)
    backup_dir = BACKUP_ROOT / f"rin-data-backup-{timestamp_slug()}"
    if backup_dir.exists():
        raise FileExistsError(f"Backup already exists: {backup_dir}")
    shutil.copytree(source, backup_dir)
    source_db_hash = file_hash(database_path_for(production_layout()))
    backup_layout = create_data_layout(str(backup_dir), cwd="/")
    backup_db_hash = file_hash(database_path_for(backup_layout))
    backup_status = inspect_database(backup_layout)
    report = RealDataBackupReport(
        mode="real-data-backup",
        status="passed"
        if source_db_hash == backup_db_hash and backup_status.schemaVersion >= 6
        else "failed",
        sourceDir=str(source),
        backupDir=str(backup_dir),
        sourceDatabaseHash=source_db_hash,
        backupDatabaseHash=backup_db_hash,
        backupVerified=source_db_hash == backup_db_hash,
        dryRunRestoreInspectable=backup_status.schemaVersion >= 6,
        artifactPath=str(BACKUP_ARTIFACT),
        fullTextIncluded=False,
    )
    write_artifact(BACKUP_ARTIFACT, asdict(report))
    return report


def run_real_data_migration_dry_run() -> RealDataMigrationDryRunReport:
    preflight = run_real_data_preflight()
    if preflight.status != "passed":
        raise RuntimeError("Real-data preflight must pass before migration dry-run.")
    source_layout = production_layout()
    source_hash_before = file_hash(database_path_for(source_layout))
    copy_root = Path(
        tempfile.mkdtemp(prefix="rin-python-cutover-dry-run-", dir="/tmp")
    ).resolve()
    assert_safe_temp_data_dir(copy_root)
    shutil.copytree(source_layout.rootDir, copy_root, dirs_exist_ok=True)
    copy_layout = create_data_layout(str(copy_root), cwd="/")
    now = utc_now()
    create_conversation(copy_layout, "Python cutover dry-run synthetic check", now)
    append_audit_event(
        copy_layout,
        "python.cutover.dry_run",
        {"rawTextIncluded": False, "productionApply": False},
        now,
    )
    copy_status = inspect_database(copy_layout)
    source_hash_after = file_hash(database_path_for(source_layout))
    source_unchanged = source_hash_before == source_hash_after
    report = RealDataMigrationDryRunReport(
        mode="real-data-migration-dry-run",
        status="passed"
        if source_unchanged and copy_status.schemaVersion >= 6
        else "failed",
        sourceDir=str(source_layout.rootDir),
        copyDir=str(copy_root),
        sourceHashBefore=source_hash_before,
        sourceHashAfter=source_hash_after,
        sourceHashUnchanged=source_unchanged,
        pythonReadableAfterSimulation=copy_status.schemaVersion >= 6,
        typescriptFallbackReadableAfterSimulation=typescript_readable_schema(
            copy_status.schemaVersion
        ),
        plannedWrites=[
            "verify preflight artifact",
            "verify backup artifact",
            "verify dry-run artifact",
            "write production migration audit marker only after explicit allow flag",
        ],
        rollbackPath=(
            "Use verified backup or TypeScript fallback; no production apply ran."
        ),
        productionApplyAvailable=False,
        artifactPath=str(DRY_RUN_ARTIFACT),
        fullTextIncluded=False,
    )
    write_artifact(DRY_RUN_ARTIFACT, asdict(report))
    return report


def format_preflight_report(report: RealDataPreflightReport) -> str:
    return "\n".join(
        [
            "RIN Python real-data preflight report.",
            f"Mode: {report.mode}",
            f"Status: {report.status}",
            f"Data dir: {report.dataDir}",
            f"Manifest valid: {'yes' if report.manifestValid else 'no'}",
            f"Database readable: {'yes' if report.databaseReadable else 'no'}",
            f"Profile valid: {'yes' if report.profileValid else 'no'}",
            f"Python readable: {'yes' if report.pythonReadable else 'no'}",
            "TypeScript fallback readable: "
            f"{'yes' if report.typescriptFallbackReadable else 'no'}",
            f"Schema version: {report.schemaVersion}",
            f"Conversations: {report.conversations}",
            f"Messages: {report.messages}",
            f"Memory V2 traces: {report.memoryV2Traces}",
            f"Profile files present: {report.profileFilesPresent}",
            f"Database hash: {report.databaseHash}",
            f"Artifact: {report.artifactPath}",
            f"Full text included: {'yes' if report.fullTextIncluded else 'no'}",
        ]
    )


def format_backup_report(report: RealDataBackupReport) -> str:
    return "\n".join(
        [
            "RIN Python real-data backup report.",
            f"Mode: {report.mode}",
            f"Status: {report.status}",
            f"Source dir: {report.sourceDir}",
            f"Backup dir: {report.backupDir}",
            f"Source DB hash: {report.sourceDatabaseHash}",
            f"Backup DB hash: {report.backupDatabaseHash}",
            f"Backup verified: {'yes' if report.backupVerified else 'no'}",
            "Dry-run restore inspectable: "
            f"{'yes' if report.dryRunRestoreInspectable else 'no'}",
            f"Artifact: {report.artifactPath}",
            f"Full text included: {'yes' if report.fullTextIncluded else 'no'}",
        ]
    )


def format_migration_dry_run_report(
    report: RealDataMigrationDryRunReport,
) -> str:
    return "\n".join(
        [
            "RIN Python real-data migration dry-run report.",
            f"Mode: {report.mode}",
            f"Status: {report.status}",
            f"Source dir: {report.sourceDir}",
            f"Copy dir: {report.copyDir}",
            f"Source hash before: {report.sourceHashBefore}",
            f"Source hash after: {report.sourceHashAfter}",
            f"Source hash unchanged: {'yes' if report.sourceHashUnchanged else 'no'}",
            "Python readable after simulation: "
            f"{'yes' if report.pythonReadableAfterSimulation else 'no'}",
            "TypeScript fallback readable after simulation: "
            f"{'yes' if report.typescriptFallbackReadableAfterSimulation else 'no'}",
            "Planned writes:",
            *[f"- {item}" for item in report.plannedWrites],
            f"Rollback path: {report.rollbackPath}",
            "Production apply available: "
            f"{'yes' if report.productionApplyAvailable else 'no'}",
            f"Artifact: {report.artifactPath}",
            f"Full text included: {'yes' if report.fullTextIncluded else 'no'}",
        ]
    )


def production_layout() -> RinDataLayout:
    return create_data_layout(str(PRODUCTION_RIN_DATA_DIR), cwd="/")


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def timestamp_slug() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def write_artifact(path: Path, payload: dict[str, object]) -> None:
    assert_not_production_data_path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f"{json.dumps(payload, indent=2, sort_keys=True)}\n",
        encoding="utf-8",
    )


def typescript_readable_schema(schema_version: int) -> bool:
    return schema_version >= 6
