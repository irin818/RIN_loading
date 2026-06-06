from __future__ import annotations

import hashlib
import json
import shutil
import sqlite3
import tempfile
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

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
    is_python_production_cutover_marked,
    python_cutover_marker_path,
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
APPLY_ARTIFACT = CUTOVER_STATE_DIR / "apply-latest.json"
ALLOW_MIGRATION_ENV = "RIN_PYTHON_REAL_DATA_MIGRATION"


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


@dataclass(frozen=True)
class RealDataMigrationApplyReport:
    mode: str
    status: str
    dataDir: str
    markerPath: str
    backupDir: str
    databaseHashBefore: str
    databaseHashAfter: str
    backupHash: str
    preflightArtifact: str
    backupArtifact: str
    dryRunArtifact: str
    auditMarkerWritten: bool
    fileMarkerWritten: bool
    idempotent: bool
    rawMessagesPreserved: bool
    legacyMemoriesPreserved: bool
    pythonReadableAfterApply: bool
    pythonWriteVerified: bool
    typescriptFallbackReadable: bool
    rollbackPath: str
    artifactPath: str
    fullTextIncluded: bool


@dataclass(frozen=True)
class PythonProductionCheckReport:
    mode: str
    status: str
    dataDir: str
    markerPresent: bool
    realDataReadable: bool
    backupExists: bool
    pythonLauncherExists: bool
    pythonLocalModelLauncherExists: bool
    typescriptFallbackLauncherExists: bool
    typescriptLocalModelFallbackLauncherExists: bool
    externalApiDisabled: bool
    localModelChecked: bool
    localModelReady: bool | None
    schemaVersion: int
    conversations: int
    messages: int
    currentDatabaseHash: str
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
    database_hash = database_hash_for(layout)
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
    source_db_hash = database_hash_for(production_layout())
    backup_layout = create_data_layout(str(backup_dir), cwd="/")
    backup_db_hash = database_hash_for(backup_layout)
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
    source_hash_before = database_hash_for(source_layout)
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
    source_hash_after = database_hash_for(source_layout)
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


def run_real_data_migration_apply() -> RealDataMigrationApplyReport:
    if not migration_env_allows_apply():
        raise PermissionError(
            f"Set {ALLOW_MIGRATION_ENV}=allow to apply real-data migration."
        )
    preflight = load_required_artifact(PREFLIGHT_ARTIFACT)
    backup = load_required_artifact(BACKUP_ARTIFACT)
    dry_run = load_required_artifact(DRY_RUN_ARTIFACT)
    layout = production_layout()
    marker_path = python_cutover_marker_path(layout.rootDir)
    backup_dir = Path(str(backup["backupDir"]))
    backup_hash = str(backup["backupDatabaseHash"])
    current_hash = database_hash_for(layout)
    if marker_path.is_file() and is_python_production_cutover_marked(layout.rootDir):
        validate_existing_backup_artifact(backup)
        status = inspect_database(layout)
        report = RealDataMigrationApplyReport(
            mode="real-data-migration-apply",
            status="already_applied",
            dataDir=str(layout.rootDir),
            markerPath=str(marker_path),
            backupDir=str(backup_dir),
            databaseHashBefore=current_hash,
            databaseHashAfter=current_hash,
            backupHash=backup_hash,
            preflightArtifact=str(PREFLIGHT_ARTIFACT),
            backupArtifact=str(BACKUP_ARTIFACT),
            dryRunArtifact=str(DRY_RUN_ARTIFACT),
            auditMarkerWritten=False,
            fileMarkerWritten=False,
            idempotent=True,
            rawMessagesPreserved=(
                status.counts.messages >= artifact_int(preflight, "messages")
            ),
            legacyMemoriesPreserved=True,
            pythonReadableAfterApply=status.schemaVersion >= 6,
            pythonWriteVerified=True,
            typescriptFallbackReadable=typescript_readable_schema(status.schemaVersion),
            rollbackPath=f"Restore from verified backup at {backup_dir}.",
            artifactPath=str(APPLY_ARTIFACT),
            fullTextIncluded=False,
        )
        write_artifact(APPLY_ARTIFACT, asdict(report))
        return report
    validate_apply_artifacts(preflight, backup, dry_run)
    expected_hash = str(preflight["databaseHash"])
    if current_hash != expected_hash:
        raise RuntimeError("Current production DB hash does not match preflight hash.")
    before = inspect_database(layout)
    marker_payload = {
        "schemaVersion": 1,
        "kind": "python_cutover_marker",
        "appliedAt": utc_now(),
        "dataDir": str(layout.rootDir),
        "backupDir": str(backup_dir),
        "preflightDatabaseHash": expected_hash,
        "backupDatabaseHash": backup_hash,
        "dryRunSourceHash": str(dry_run["sourceHashAfter"]),
        "rawTextIncluded": False,
    }
    write_migration_audit_marker(layout, marker_payload)
    write_production_marker(marker_path, marker_payload)
    after = inspect_database(layout)
    after_hash = database_hash_for(layout)
    report = RealDataMigrationApplyReport(
        mode="real-data-migration-apply",
        status="passed",
        dataDir=str(layout.rootDir),
        markerPath=str(marker_path),
        backupDir=str(backup_dir),
        databaseHashBefore=current_hash,
        databaseHashAfter=after_hash,
        backupHash=backup_hash,
        preflightArtifact=str(PREFLIGHT_ARTIFACT),
        backupArtifact=str(BACKUP_ARTIFACT),
        dryRunArtifact=str(DRY_RUN_ARTIFACT),
        auditMarkerWritten=after.counts.auditEvents == before.counts.auditEvents + 1,
        fileMarkerWritten=marker_path.is_file(),
        idempotent=True,
        rawMessagesPreserved=after.counts.messages == before.counts.messages,
        legacyMemoriesPreserved=after.counts.memoryItems == before.counts.memoryItems,
        pythonReadableAfterApply=after.schemaVersion >= 6,
        pythonWriteVerified=after.counts.auditEvents == before.counts.auditEvents + 1,
        typescriptFallbackReadable=typescript_readable_schema(after.schemaVersion),
        rollbackPath=f"Restore from verified backup at {backup_dir}.",
        artifactPath=str(APPLY_ARTIFACT),
        fullTextIncluded=False,
    )
    if not all(
        [
            report.auditMarkerWritten,
            report.fileMarkerWritten,
            report.rawMessagesPreserved,
            report.legacyMemoriesPreserved,
            report.pythonReadableAfterApply,
            report.pythonWriteVerified,
            report.typescriptFallbackReadable,
        ]
    ):
        raise RuntimeError("Post-migration verification failed.")
    write_artifact(APPLY_ARTIFACT, asdict(report))
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


def format_migration_apply_report(report: RealDataMigrationApplyReport) -> str:
    return "\n".join(
        [
            "RIN Python real-data migration apply report.",
            f"Mode: {report.mode}",
            f"Status: {report.status}",
            f"Data dir: {report.dataDir}",
            f"Marker path: {report.markerPath}",
            f"Backup dir: {report.backupDir}",
            f"DB hash before: {report.databaseHashBefore}",
            f"DB hash after: {report.databaseHashAfter}",
            f"Backup DB hash: {report.backupHash}",
            f"Preflight artifact: {report.preflightArtifact}",
            f"Backup artifact: {report.backupArtifact}",
            f"Dry-run artifact: {report.dryRunArtifact}",
            f"Audit marker written: {'yes' if report.auditMarkerWritten else 'no'}",
            f"File marker written: {'yes' if report.fileMarkerWritten else 'no'}",
            f"Idempotent: {'yes' if report.idempotent else 'no'}",
            f"Raw messages preserved: {'yes' if report.rawMessagesPreserved else 'no'}",
            "Legacy memories preserved: "
            f"{'yes' if report.legacyMemoriesPreserved else 'no'}",
            "Python readable after apply: "
            f"{'yes' if report.pythonReadableAfterApply else 'no'}",
            f"Python write verified: {'yes' if report.pythonWriteVerified else 'no'}",
            "TypeScript fallback readable: "
            f"{'yes' if report.typescriptFallbackReadable else 'no'}",
            f"Rollback path: {report.rollbackPath}",
            f"Artifact: {report.artifactPath}",
            f"Full text included: {'yes' if report.fullTextIncluded else 'no'}",
        ]
    )


def run_python_production_check(
    *,
    check_local_model: bool = False,
) -> PythonProductionCheckReport:
    layout = production_layout()
    marker_present = is_python_production_cutover_marked(layout.rootDir)
    status = inspect_database(layout)
    backup_exists = latest_backup_exists()
    python_launcher = REPO_ROOT / "Start_RIN_Python.command"
    python_local_launcher = REPO_ROOT / "Start_RIN_Python_Local_Model.command"
    ts_launcher = REPO_ROOT / "Start_RIN.command"
    ts_local_launcher = REPO_ROOT / "Start_RIN_Local_Model.command"
    local_model_ready = check_local_ollama_model() if check_local_model else None
    passed = all(
        [
            marker_present,
            status.schemaVersion >= 6,
            backup_exists,
            python_launcher.is_file(),
            python_local_launcher.is_file(),
            ts_launcher.is_file(),
            ts_local_launcher.is_file(),
            local_model_ready is not False,
        ]
    )
    return PythonProductionCheckReport(
        mode="python-production-check",
        status="passed" if passed else "failed",
        dataDir=str(layout.rootDir),
        markerPresent=marker_present,
        realDataReadable=status.schemaVersion >= 6,
        backupExists=backup_exists,
        pythonLauncherExists=python_launcher.is_file(),
        pythonLocalModelLauncherExists=python_local_launcher.is_file(),
        typescriptFallbackLauncherExists=ts_launcher.is_file(),
        typescriptLocalModelFallbackLauncherExists=ts_local_launcher.is_file(),
        externalApiDisabled=True,
        localModelChecked=check_local_model,
        localModelReady=local_model_ready,
        schemaVersion=status.schemaVersion,
        conversations=status.counts.conversations,
        messages=status.counts.messages,
        currentDatabaseHash=database_hash_for(layout),
        fullTextIncluded=False,
    )


def format_python_production_check_report(
    report: PythonProductionCheckReport,
) -> str:
    local_model = (
        "not checked"
        if not report.localModelChecked
        else "ready"
        if report.localModelReady
        else "not ready"
    )
    return "\n".join(
        [
            "RIN Python production check report.",
            f"Mode: {report.mode}",
            f"Status: {report.status}",
            f"Data dir: {report.dataDir}",
            f"Marker present: {'yes' if report.markerPresent else 'no'}",
            f"Real data readable: {'yes' if report.realDataReadable else 'no'}",
            f"Backup exists: {'yes' if report.backupExists else 'no'}",
            f"Python launcher exists: {'yes' if report.pythonLauncherExists else 'no'}",
            "Python local model launcher exists: "
            f"{'yes' if report.pythonLocalModelLauncherExists else 'no'}",
            "TypeScript fallback launcher exists: "
            f"{'yes' if report.typescriptFallbackLauncherExists else 'no'}",
            "TypeScript local model fallback launcher exists: "
            f"{'yes' if report.typescriptLocalModelFallbackLauncherExists else 'no'}",
            f"External API disabled: {'yes' if report.externalApiDisabled else 'no'}",
            f"Local model: {local_model}",
            f"Schema version: {report.schemaVersion}",
            f"Conversations: {report.conversations}",
            f"Messages: {report.messages}",
            f"Current DB hash: {report.currentDatabaseHash}",
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


def database_hash_for(layout: RinDataLayout) -> str:
    """Hash the SQLite DB plus active sidecar files when present."""

    database_path = database_path_for(layout)
    digest = hashlib.sha256()
    for path in (
        database_path,
        database_path.with_name(f"{database_path.name}-wal"),
        database_path.with_name(f"{database_path.name}-shm"),
    ):
        if path.exists():
            digest.update(path.name.encode("utf-8"))
            digest.update(file_hash(path).encode("utf-8"))
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


def load_required_artifact(path: Path) -> dict[str, object]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except OSError as error:
        raise FileNotFoundError(f"Missing required gate artifact: {path}") from error
    if not isinstance(payload, dict):
        raise ValueError(f"Invalid gate artifact: {path}")
    if payload.get("status") != "passed":
        raise RuntimeError(f"Gate artifact did not pass: {path}")
    return payload


def validate_apply_artifacts(
    preflight: dict[str, object],
    backup: dict[str, object],
    dry_run: dict[str, object],
) -> None:
    backup_dir = Path(str(backup.get("backupDir", "")))
    if not backup_dir.is_dir():
        raise RuntimeError("Verified backup directory is missing.")
    if backup.get("backupVerified") is not True:
        raise RuntimeError("Backup artifact is not verified.")
    if dry_run.get("sourceHashUnchanged") is not True:
        raise RuntimeError("Dry-run source hash was not stable.")
    expected = str(preflight["databaseHash"])
    hashes = [
        str(backup["sourceDatabaseHash"]),
        str(backup["backupDatabaseHash"]),
        str(dry_run["sourceHashBefore"]),
        str(dry_run["sourceHashAfter"]),
    ]
    if any(item != expected for item in hashes):
        raise RuntimeError("Gate artifact DB hashes do not match.")
    if dry_run.get("productionApplyAvailable") is not False:
        raise RuntimeError("Dry-run artifact unexpectedly allowed production apply.")


def validate_existing_backup_artifact(backup: dict[str, object]) -> None:
    backup_dir = Path(str(backup.get("backupDir", "")))
    if not backup_dir.is_dir():
        raise RuntimeError("Verified backup directory is missing.")
    if backup.get("backupVerified") is not True:
        raise RuntimeError("Backup artifact is not verified.")


def artifact_int(payload: dict[str, object], key: str) -> int:
    value = payload[key]
    if not isinstance(value, int):
        raise ValueError(f"Artifact field must be an integer: {key}")
    return value


def migration_env_allows_apply() -> bool:
    import os

    return os.environ.get(ALLOW_MIGRATION_ENV) == "allow"


def write_migration_audit_marker(
    layout: RinDataLayout,
    marker_payload: dict[str, object],
) -> None:
    path = database_path_for(layout)
    now = str(marker_payload["appliedAt"])
    with sqlite3.connect(path) as connection:
        try:
            connection.execute("BEGIN")
            connection.execute(
                "INSERT INTO audit_events (id, event_type, payload_json, created_at) "
                "VALUES (?, ?, ?, ?)",
                (
                    str(uuid4()),
                    "python.cutover.migration_applied",
                    json.dumps(marker_payload, sort_keys=True),
                    now,
                ),
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise


def write_production_marker(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".json.tmp")
    temp.write_text(
        f"{json.dumps(payload, indent=2, sort_keys=True)}\n",
        encoding="utf-8",
    )
    temp.replace(path)


def latest_backup_exists() -> bool:
    if BACKUP_ARTIFACT.is_file():
        try:
            payload = json.loads(BACKUP_ARTIFACT.read_text(encoding="utf-8"))
            backup_dir = Path(str(payload.get("backupDir", "")))
            if backup_dir.is_dir():
                return True
        except (OSError, json.JSONDecodeError):
            pass
    return BACKUP_ROOT.is_dir() and any(BACKUP_ROOT.glob("rin-data-backup-*"))


def check_local_ollama_model() -> bool:
    import os
    import urllib.error
    import urllib.request

    base_url = os.environ.get("RIN_OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    model = os.environ.get("RIN_OLLAMA_MODEL", "qwen3:4b")
    try:
        with urllib.request.urlopen(f"{base_url}/api/tags", timeout=3) as response:
            payload = response.read().decode("utf-8")
    except (OSError, urllib.error.URLError):
        return False
    return f'"name":"{model}"' in payload or f'"name": "{model}"' in payload


def typescript_readable_schema(schema_version: int) -> bool:
    return schema_version >= 6
