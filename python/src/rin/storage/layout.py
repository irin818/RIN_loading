"""Local data layout: directory structure, manifest, core state files, and storage reports."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict, ValidationError

from rin.contracts import RinDataManifest, StorageDirectoryName

STORAGE_DIRECTORIES: tuple[StorageDirectoryName, ...] = (
    "config",
    "databases",
    "logs",
    "attachments",
)
CORE_STATE_FILES: tuple[tuple[str, str, str, str], ...] = (
    (
        "user-model",
        "config/user_model.json",
        "Slow-variable owner model placeholder.",
        "慢变量所有者模型占位文件。",
    ),
    (
        "ai-identity",
        "config/ai_identity.json",
        "Local AI identity model placeholder.",
        "本地 AI 身份模型占位文件。",
    ),
    (
        "ai-state",
        "config/ai_state.json",
        "Local interaction state placeholder for future embodiment.",
        "用于未来具身化的本地交互状态占位文件。",
    ),
    (
        "policy-config",
        "config/policy_config.json",
        "Local policy configuration placeholder.",
        "本地策略配置占位文件。",
    ),
    (
        "model-config",
        "config/model_config.json",
        "Provider-neutral model configuration and adapter selection.",
        "服务商中立的模型配置与 adapter 选择。",
    ),
    (
        "rin-profile",
        "config/rin_profile.json",
        "Manually editable local RIN profile.",
        "可手动编辑的本地 RIN profile。",
    ),
    (
        "owner-profile",
        "config/owner_profile.json",
        "Manually editable local owner profile.",
        "可手动编辑的本地 owner profile。",
    ),
    (
        "audit-log",
        "logs/audit_log.jsonl",
        "Append-only audit log placeholder.",
        "追加式审计日志占位文件。",
    ),
)


class RinDataLayout(BaseModel):
    """Resolved paths for the RIN data directory: root, manifest, and per-purpose subdirectories."""

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    rootDir: Path
    manifestPath: Path
    directories: dict[StorageDirectoryName, Path]


class CoreStateFileStatus(BaseModel):
    """Status of one core state file: whether it exists on disk, with bilingual descriptions."""

    model_config = ConfigDict(extra="forbid")

    key: str
    relativePath: str
    exists: bool
    created: bool
    english: str
    chinese: str


class StorageReport(BaseModel):
    """Full storage health report: manifest validity, directory existence, and core file statuses."""

    model_config = ConfigDict(extra="forbid")

    mode: str
    status: str
    rootDir: str
    manifestPath: str
    manifestValid: bool
    manifestIssue: str | None
    directoryCount: int
    missingDirectories: list[StorageDirectoryName]
    coreFiles: list[CoreStateFileStatus]
    providerCallCount: int
    fullTextIncluded: bool


def create_data_layout(
    data_dir: str = ".rin-data",
    cwd: Path | str | None = None,
) -> RinDataLayout:
    """Resolve the RIN data directory and build a RinDataLayout with standard subdirectories."""
    base = Path.cwd() if cwd is None else Path(cwd)
    root_dir = (base / data_dir).resolve()
    directories = {name: root_dir / name for name in STORAGE_DIRECTORIES}
    return RinDataLayout(
        rootDir=root_dir,
        manifestPath=root_dir / "manifest.json",
        directories=directories,
    )


def load_manifest(layout: RinDataLayout) -> RinDataManifest:
    """Load and validate the RIN data manifest JSON file. Raises ValueError on any failure."""
    try:
        raw = layout.manifestPath.read_text(encoding="utf-8")
        return RinDataManifest.model_validate(json.loads(raw))
    except (OSError, json.JSONDecodeError, ValidationError) as error:
        raise ValueError("Invalid RIN data manifest.") from error


def inspect_core_state_files(layout: RinDataLayout) -> list[CoreStateFileStatus]:
    """Check which core state files exist on disk (does not create them)."""
    return [
        CoreStateFileStatus(
            key=key,
            relativePath=relative_path,
            exists=(layout.rootDir / relative_path).exists(),
            created=False,
            english=english,
            chinese=chinese,
        )
        for key, relative_path, english, chinese in CORE_STATE_FILES
    ]


def build_storage_report(layout: RinDataLayout) -> StorageReport:
    """Validate manifest, check directories, inspect core files, and return a StorageReport."""
    manifest_issue: str | None = None
    manifest_valid = True
    try:
        load_manifest(layout)
    except ValueError as error:
        manifest_valid = False
        manifest_issue = str(error)

    missing_directories = [
        name for name, path in layout.directories.items() if not path.is_dir()
    ]
    core_files = inspect_core_state_files(layout)
    status = (
        "ready"
        if manifest_valid
        and not missing_directories
        and all(item.exists for item in core_files)
        else "incomplete"
    )

    return StorageReport(
        mode="python-storage-report",
        status=status,
        rootDir=str(layout.rootDir),
        manifestPath=str(layout.manifestPath),
        manifestValid=manifest_valid,
        manifestIssue=manifest_issue,
        directoryCount=len(layout.directories),
        missingDirectories=missing_directories,
        coreFiles=core_files,
        providerCallCount=0,
        fullTextIncluded=False,
    )
