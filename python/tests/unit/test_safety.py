from __future__ import annotations

from pathlib import Path

import pytest

from rin.diagnostics.safety import (
    PERSISTENT_SANDBOX_DATA_DIR,
    PRODUCTION_RIN_DATA_DIR,
    TEMP_ROOT,
    UnsafeDataPathError,
    assert_not_production_data_path,
    assert_safe_persistent_sandbox_data_dir,
    assert_safe_python_write_data_dir,
    assert_safe_temp_data_dir,
    create_temp_data_dir,
    resolve_path,
)


def test_rejects_real_owner_rin_data_path() -> None:
    with pytest.raises(UnsafeDataPathError):
        assert_not_production_data_path(PRODUCTION_RIN_DATA_DIR)


def test_rejects_real_owner_rin_data_child_path() -> None:
    with pytest.raises(UnsafeDataPathError):
        assert_not_production_data_path(PRODUCTION_RIN_DATA_DIR / "rin.db")


def test_temp_data_helper_uses_safe_tmp_prefix() -> None:
    temp_dir = create_temp_data_dir()

    assert temp_dir.path.is_dir()
    assert temp_dir.path.name.startswith("rin-python-")
    assert resolve_path(TEMP_ROOT) in temp_dir.path.parents
    assert assert_safe_temp_data_dir(temp_dir.path) == temp_dir.path


def test_rejects_non_tmp_write_test_path() -> None:
    with pytest.raises(UnsafeDataPathError):
        assert_safe_temp_data_dir(Path("/Users/irin/Documents/RIN_loading_python/tmp"))


def test_allows_only_named_persistent_sandbox() -> None:
    assert (
        assert_safe_persistent_sandbox_data_dir(PERSISTENT_SANDBOX_DATA_DIR)
        == PERSISTENT_SANDBOX_DATA_DIR.resolve()
    )

    with pytest.raises(UnsafeDataPathError):
        assert_safe_persistent_sandbox_data_dir(
            Path("/Users/irin/Documents/RIN_loading/.rin-python-other-data")
        )


def test_python_write_guard_allows_temp_or_sandbox_only() -> None:
    temp_dir = create_temp_data_dir()

    assert assert_safe_python_write_data_dir(temp_dir.path) == temp_dir.path
    assert (
        assert_safe_python_write_data_dir(PERSISTENT_SANDBOX_DATA_DIR)
        == PERSISTENT_SANDBOX_DATA_DIR.resolve()
    )
    with pytest.raises(UnsafeDataPathError):
        assert_safe_python_write_data_dir(PRODUCTION_RIN_DATA_DIR)
