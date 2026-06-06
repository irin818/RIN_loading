from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

import rin.cutover as cutover
from rin.database import create_temp_layout_database, database_path_for
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
    yield root
    shutil.rmtree(root, ignore_errors=True)


def test_real_data_preflight_reports_counts_only(fake_real_data: Path) -> None:
    report = cutover.run_real_data_preflight()
    formatted = cutover.format_preflight_report(report)

    assert report.status == "passed"
    assert report.schemaVersion == 6
    assert report.fullTextIncluded is False
    assert report.databaseHash == cutover.file_hash(
        database_path_for(create_data_layout(str(fake_real_data), cwd="/"))
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
    before = cutover.file_hash(
        database_path_for(create_data_layout(str(fake_real_data), cwd="/"))
    )
    report = cutover.run_real_data_migration_dry_run()
    after = cutover.file_hash(
        database_path_for(create_data_layout(str(fake_real_data), cwd="/"))
    )

    assert report.status == "passed"
    assert report.sourceHashUnchanged is True
    assert before == after
    assert report.pythonReadableAfterSimulation is True
    assert report.typescriptFallbackReadableAfterSimulation is True
    assert report.productionApplyAvailable is False
    assert Path(report.artifactPath).is_file()
