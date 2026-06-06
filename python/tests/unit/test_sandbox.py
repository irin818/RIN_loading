from __future__ import annotations

from pathlib import Path

import pytest

import rin.diagnostics.safety as safety
import rin.sandbox as sandbox


@pytest.fixture()
def sandbox_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / ".rin-python-preview-data"
    monkeypatch.setattr(safety, "PERSISTENT_SANDBOX_DATA_DIR", root)
    monkeypatch.setattr(sandbox, "PERSISTENT_SANDBOX_DATA_DIR", root)
    return root


def test_initialize_sandbox_creates_persistent_layout(sandbox_root: Path) -> None:
    report = sandbox.initialize_sandbox()

    assert report.status == "ready"
    assert report.dataDir == str(sandbox_root.resolve())
    assert report.productionRejected is True
    assert report.manifestReady is True
    assert report.databaseReady is True
    assert report.profileReady is True
    assert report.persistent is True
    assert report.fullTextIncluded is False
    assert sandbox_root.exists()
    assert (sandbox_root / "databases/rin.sqlite").is_file()


def test_sandbox_smoke_retains_data_without_private_text(sandbox_root: Path) -> None:
    report = sandbox.run_sandbox_smoke()

    assert report.status == "passed"
    assert report.dataDir == str(sandbox_root.resolve())
    assert report.cleanup == "retained"
    assert report.providerCallCount == 0
    assert report.externalProviderCallCount == 0
    assert report.fullTextIncluded is False
    assert (sandbox_root / "databases/rin.sqlite").is_file()


def test_sandbox_reset_is_dry_run_only(sandbox_root: Path) -> None:
    sandbox.initialize_sandbox()
    report = sandbox.run_sandbox_reset_dry_run()

    assert report.status == "dry_run_only"
    assert report.wouldRemove is True
    assert report.wouldRemoveDatabase is True
    assert report.destructiveApplyAvailable is False
    assert report.fullTextIncluded is False
    assert sandbox_root.exists()
