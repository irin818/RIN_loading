import shutil
from pathlib import Path

from rin.database import create_temp_layout_database, database_path_for
from rin.diagnostics.safety import create_temp_data_dir
from rin.migration_dry_run import (
    run_production_migration_dry_run,
    run_rollback_rehearsal,
)
from rin.shadow import file_hash


def test_migration_dry_run_uses_copy_only_and_has_no_apply() -> None:
    source = create_synthetic_source()
    layout = create_temp_layout_database(source)
    source_hash = file_hash(database_path_for(layout))
    try:
        report = run_production_migration_dry_run(source=source)

        assert report.status == "passed"
        assert report.sourceDbHashUnchanged is True
        assert file_hash(database_path_for(layout)) == source_hash
        assert report.copiedDataResult == "passed"
        assert report.productionApplyAvailable is False
        assert report.privateTextIncluded is False
        assert any("copy production" in item for item in report.plannedOperations)
    finally:
        shutil.rmtree(source, ignore_errors=True)


def test_rollback_rehearsal_documents_guarantees_and_limits() -> None:
    source = create_synthetic_source()
    create_temp_layout_database(source)
    try:
        report = run_rollback_rehearsal(source=source)

        assert report.status == "passed"
        assert report.pythonWriteSession == "passed_on_copy"
        assert report.typescriptReadableState == "compatible_schema_no_launcher_change"
        assert report.productionApplyAvailable is False
        assert report.privateTextIncluded is False
        assert report.guarantees
        assert report.limits
    finally:
        shutil.rmtree(source, ignore_errors=True)


def create_synthetic_source() -> Path:
    return create_temp_data_dir("rin-python-dry-run-source-").path
