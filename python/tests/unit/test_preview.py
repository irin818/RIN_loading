from pathlib import Path

import pytest

from rin.diagnostics.safety import PRODUCTION_RIN_DATA_DIR
from rin.preview import create_preview_layout, run_preview_smoke


def test_preview_layout_uses_tmp_preview_prefix() -> None:
    layout = create_preview_layout()
    try:
        resolved = layout.rootDir.resolve()
        assert any(part.startswith("rin-python-preview-") for part in resolved.parts)
        assert PRODUCTION_RIN_DATA_DIR.resolve() != resolved
    finally:
        remove_tree(layout.rootDir)


def test_preview_layout_rejects_production_data() -> None:
    with pytest.raises(ValueError):
        create_preview_layout(str(PRODUCTION_RIN_DATA_DIR))


def test_preview_smoke_is_provider_free_and_cleans_up() -> None:
    report = run_preview_smoke()

    assert report.status == "passed"
    assert report.readinessOk is True
    assert report.stateOk is True
    assert report.conversationOk is True
    assert report.historyOk is True
    assert report.traceOk is True
    assert report.productionWriteRejected is True
    assert report.providerCallCount == 0
    assert report.externalProviderCallCount == 0
    assert report.fullTextIncluded is False
    assert report.cleanup == "removed"
    assert not Path(report.dataDir).exists()


def remove_tree(path: Path) -> None:
    import shutil

    shutil.rmtree(path, ignore_errors=True)
