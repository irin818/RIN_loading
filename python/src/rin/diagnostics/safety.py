"""Safety helpers for the Python RIN runtime."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from tempfile import mkdtemp

PRODUCTION_RIN_DATA_DIR = Path("/Users/irin/Documents/RIN_loading/.rin-data")
TEMP_DATA_PREFIX = "rin-python-"
TEMP_ROOT = Path("/tmp")


class UnsafeDataPathError(ValueError):
    """Raised when a path could target production or non-temporary local data."""


@dataclass(frozen=True)
class TempDataDirectory:
    """A verified temporary data directory for migration tests."""

    path: Path


def resolve_path(path: str | Path) -> Path:
    """Resolve a filesystem path without requiring it to already exist."""
    return Path(path).expanduser().resolve(strict=False)


def is_production_data_path(path: str | Path) -> bool:
    """Return whether a path is the owner's real `.rin-data` or a child of it."""
    resolved = resolve_path(path)
    production = resolve_path(PRODUCTION_RIN_DATA_DIR)
    return resolved == production or production in resolved.parents


def assert_not_production_data_path(path: str | Path) -> Path:
    """Reject the protected production `.rin-data` path and descendants."""
    resolved = resolve_path(path)
    if is_production_data_path(resolved):
        msg = "Python migration commands must not target production .rin-data."
        raise UnsafeDataPathError(msg)
    return resolved


def assert_safe_temp_data_dir(path: str | Path) -> Path:
    """Require write test data to live under `/tmp/rin-python-*`."""
    resolved = assert_not_production_data_path(path)
    temp_root = resolve_path(TEMP_ROOT)

    if temp_root not in (resolved, *resolved.parents):
        msg = "Python migration test data must live under /tmp."
        raise UnsafeDataPathError(msg)

    relative = resolved.relative_to(temp_root)
    if not relative.parts or not relative.parts[0].startswith(TEMP_DATA_PREFIX):
        msg = "Python migration test data must use a /tmp/rin-python-* path."
        raise UnsafeDataPathError(msg)

    return resolved


def assert_safe_python_production_data_dir(path: str | Path) -> Path:
    """Allow production writes to the production .rin-data root."""
    resolved = resolve_path(path)
    production = resolve_path(PRODUCTION_RIN_DATA_DIR)
    if resolved != production:
        msg = "Python production writes must target the production .rin-data root."
        raise UnsafeDataPathError(msg)
    return resolved


def assert_safe_python_write_data_dir(path: str | Path) -> Path:
    """Allow Python writes in temp fixtures or the production data dir."""
    try:
        return assert_safe_temp_data_dir(path)
    except UnsafeDataPathError:
        return assert_safe_python_production_data_dir(path)


def create_temp_data_dir(prefix: str = TEMP_DATA_PREFIX) -> TempDataDirectory:
    """Create and verify an isolated temporary data directory."""
    if not prefix.startswith(TEMP_DATA_PREFIX):
        msg = f"Temporary data prefix must start with {TEMP_DATA_PREFIX!r}."
        raise UnsafeDataPathError(msg)

    path = Path(mkdtemp(prefix=prefix, dir=TEMP_ROOT))
    return TempDataDirectory(path=assert_safe_temp_data_dir(path))
