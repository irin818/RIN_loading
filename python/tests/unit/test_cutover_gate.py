from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

import rin.cutover as cutover
import rin.diagnostics.safety as safety
from rin.database import create_temp_layout_database
from rin.diagnostics.safety import create_temp_data_dir
from rin.sandbox import utc_now, write_core_files
from rin.storage import create_data_layout


@pytest.fixture()
def fake_real_data(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    temp = create_temp_data_dir("rin-python-cutover-test-")
    root = temp.path
    layout = create_data_layout(str(root), cwd="/")
    for directory in layout.directories.values():
        directory.mkdir(parents=True, exist_ok=True)
    now = utc_now()
    layout.manifestPath.write_text(
        json.dumps(
            {
                "project": "RIN",
                "schemaVersion": 1,
                "ownerId": "test-owner",
                "deviceId": "test-device",
                "createdAt": now,
                "updatedAt": now,
                "directories": {
                    key: str(path) for key, path in layout.directories.items()
                },
            }
        ),
        encoding="utf-8",
    )
    write_core_files(layout, now)
    create_temp_layout_database(layout.rootDir)
    monkeypatch.setattr(cutover, "PRODUCTION_RIN_DATA_DIR", root)
    monkeypatch.setattr(safety, "PRODUCTION_RIN_DATA_DIR", root)
    monkeypatch.setattr(cutover, "CUTOVER_STATE_DIR", tmp_path / "state")
    monkeypatch.setattr(cutover, "BACKUP_ROOT", tmp_path / "backups")
    monkeypatch.setattr(
        cutover,
        "PREFLIGHT_ARTIFACT",
        tmp_path / "state/preflight-latest.json",
    )
    monkeypatch.setattr(
        cutover,
        "BACKUP_ARTIFACT",
        tmp_path / "state/backup-latest.json",
    )
    monkeypatch.setattr(
        cutover,
        "DRY_RUN_ARTIFACT",
        tmp_path / "state/dry-run-latest.json",
    )
    monkeypatch.setattr(
        cutover,
        "APPLY_ARTIFACT",
        tmp_path / "state/apply-latest.json",
    )
    yield root
    shutil.rmtree(root, ignore_errors=True)


def test_real_data_preflight_reports_counts_only(fake_real_data: Path) -> None:
    report = cutover.run_real_data_preflight()
    formatted = cutover.format_preflight_report(report)

    assert report.status == "passed"
    assert report.schemaVersion == 6
    assert report.fullTextIncluded is False
    assert report.databaseHash == cutover.database_hash_for(
        create_data_layout(str(fake_real_data), cwd="/")
    )
    assert "Sandbox Owner" not in formatted
    assert Path(report.artifactPath).is_file()


def test_real_data_backup_copies_and_verifies(fake_real_data: Path) -> None:
    report = cutover.run_real_data_backup()

    assert report.status == "passed"
    assert report.backupVerified is True
    assert report.dryRunRestoreInspectable is True
    assert report.sourceDatabaseHash == report.backupDatabaseHash
    assert Path(report.backupDir).is_dir()
    assert Path(report.artifactPath).is_file()


def test_real_data_migration_dry_run_preserves_source_hash(
    fake_real_data: Path,
) -> None:
    before = cutover.database_hash_for(create_data_layout(str(fake_real_data), cwd="/"))
    report = cutover.run_real_data_migration_dry_run()
    after = cutover.database_hash_for(create_data_layout(str(fake_real_data), cwd="/"))

    assert report.status == "passed"
    assert report.sourceHashUnchanged is True
    assert before == after
    assert report.pythonReadableAfterSimulation is True
    assert report.typescriptFallbackReadableAfterSimulation is True
    assert report.productionApplyAvailable is False
    assert Path(report.artifactPath).is_file()


def test_real_data_migration_apply_requires_env(fake_real_data: Path) -> None:
    cutover.run_real_data_backup()
    cutover.run_real_data_migration_dry_run()

    with pytest.raises(PermissionError):
        cutover.run_real_data_migration_apply()


def test_real_data_migration_apply_writes_marker_and_is_idempotent(
    fake_real_data: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cutover.run_real_data_backup()
    cutover.run_real_data_migration_dry_run()
    monkeypatch.setenv(cutover.ALLOW_MIGRATION_ENV, "allow")

    report = cutover.run_real_data_migration_apply()
    second = cutover.run_real_data_migration_apply()

    assert report.status == "passed"
    assert report.auditMarkerWritten is True
    assert report.fileMarkerWritten is True
    assert report.rawMessagesPreserved is True
    assert report.legacyMemoriesPreserved is True
    assert report.pythonReadableAfterApply is True
    assert report.pythonWriteVerified is True
    assert report.typescriptFallbackReadable is True
    assert report.fullTextIncluded is False
    assert Path(report.markerPath).is_file()
    assert Path(report.artifactPath).is_file()
    assert second.status == "already_applied"
    assert second.idempotent is True
    assert safety.assert_safe_python_write_data_dir(fake_real_data) == fake_real_data


def test_python_production_check_passes_after_marker(
    fake_real_data: Path,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cutover.run_real_data_backup()
    cutover.run_real_data_migration_dry_run()
    monkeypatch.setenv(cutover.ALLOW_MIGRATION_ENV, "allow")
    cutover.run_real_data_migration_apply()
    for name in ("Start_RIN_Python.command", "Start_RIN_Python_Local_Model.command"):
        (tmp_path / name).write_text("#!/bin/zsh\n", encoding="utf-8")
    rollback_doc = tmp_path / "docs" / "python-only"
    rollback_doc.mkdir(parents=True)
    (rollback_doc / "TYPESCRIPT_FALLBACK_GUIDE.md").write_text(
        "Fallback tag: typescript-final-fallback\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(cutover, "REPO_ROOT", tmp_path)

    report = cutover.run_python_production_check()

    assert report.status == "passed"
    assert report.markerPresent is True
    assert report.realDataReadable is True
    assert report.backupExists is True
    assert report.pythonLauncherExists is True
    assert report.pythonLocalModelLauncherExists is True
    assert report.typescriptRollbackDocumented is True
    assert report.typescriptFallbackTag == "typescript-final-fallback"
    assert report.externalApiDisabled is True
    assert report.fullTextIncluded is False
