import shutil
from pathlib import Path

from rin.database import (
    append_message,
    create_conversation,
    create_temp_layout_database,
    database_path_for,
)
from rin.diagnostics.safety import create_temp_data_dir
from rin.shadow import file_hash, run_copy_data_shadow_report


def test_shadow_report_copies_source_and_preserves_source_hash() -> None:
    source_root = create_temp_data_dir("rin-python-source-").path
    layout = create_temp_layout_database(source_root)
    try:
        conversation = create_conversation(
            layout,
            "private title should not appear",
            "2026-06-06T00:00:00.000Z",
        )
        append_message(
            layout,
            conversation.id,
            "owner",
            "private owner text should not appear",
            "2026-06-06T00:00:00.000Z",
        )
        source_hash_before = file_hash(database_path_for(layout))

        report = run_copy_data_shadow_report(source=source_root)

        assert report.status == "passed"
        assert report.sourceDbHashUnchanged is True
        assert file_hash(database_path_for(layout)) == source_hash_before
        assert report.conversationCount == 1
        assert report.messageCount == 1
        assert report.readCompatibility == "passed"
        assert report.writeSimulation == "passed_on_copy"
        assert report.privateTextIncluded is False
        assert report.fullProfileIncluded is False
        assert report.copyPath is not None
        assert not Path(report.copyPath).exists()
    finally:
        shutil.rmtree(source_root, ignore_errors=True)


def test_shadow_report_can_skip_missing_source() -> None:
    missing = Path("/tmp/rin-python-missing-shadow-source")

    report = run_copy_data_shadow_report(source=missing)

    assert report.status == "skipped_missing_source"
    assert report.sourceDbHashUnchanged is True
    assert report.copyPath is None
    assert report.privateTextIncluded is False
