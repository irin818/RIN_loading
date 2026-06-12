import json
import shutil
from pathlib import Path
from typing import Any

from rin.diagnostics.safety import create_temp_data_dir, resolve_path
from rin.profiles import build_profile_report, format_profile_report
from rin.storage import (
    RinDataLayout,
    build_storage_report,
    create_data_layout,
    load_manifest,
)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")


def create_layout() -> RinDataLayout:
    temp_dir = create_temp_data_dir()
    layout = create_data_layout(str(temp_dir.path), cwd="/")
    for directory in layout.directories.values():
        directory.mkdir(parents=True, exist_ok=True)
    write_json(
        layout.manifestPath,
        {
            "project": "RIN",
            "schemaVersion": 1,
            "ownerId": "local-owner",
            "deviceId": "local-device",
            "createdAt": "2026-06-05T00:00:00.000Z",
            "updatedAt": "2026-06-05T00:00:00.000Z",
            "directories": {
                "config": str(layout.directories["config"]),
                "databases": str(layout.directories["databases"]),
                "logs": str(layout.directories["logs"]),
                "attachments": str(layout.directories["attachments"]),
            },
        },
    )
    write_json(
        layout.directories["config"] / "rin_profile.json",
        {
            "schemaVersion": 1,
            "kind": "rin_profile",
            "updatedAt": "2026-06-05T00:00:00.000Z",
            "displayName": "RIN",
            "role": "local-first personal AI companion",
            "communicationStyle": ["concise", "Chinese-friendly"],
            "behaviorBoundaries": ["Do not modify slow variables automatically."],
            "contextNotes": ["Synthetic fixture only."],
        },
    )
    write_json(
        layout.directories["config"] / "owner_profile.json",
        {
            "schemaVersion": 1,
            "kind": "owner_profile",
            "ownerId": "local-owner",
            "updatedAt": "2026-06-05T00:00:00.000Z",
            "displayName": "Private Owner Name",
            "communicationPreferences": ["private communication preference"],
            "stablePreferences": ["private stable preference"],
            "activeProjects": ["private project codename"],
            "contextNotes": ["private note that must not appear"],
        },
    )
    for relative in (
        "config/user_model.json",
        "config/ai_identity.json",
        "config/ai_state.json",
        "config/policy_config.json",
        "config/model_config.json",
    ):
        write_json(layout.rootDir / relative, {"schemaVersion": 1})
    (layout.directories["logs"] / "audit_log.jsonl").write_text("", encoding="utf-8")
    return layout


def test_storage_report_reads_manifest_and_core_files() -> None:
    layout = create_layout()
    try:
        manifest = load_manifest(layout)
        report = build_storage_report(layout)

        assert manifest.ownerId == "local-owner"
        assert report.status == "ready"
        assert report.providerCallCount == 0
        assert report.fullTextIncluded is False
        assert all(item.exists for item in report.coreFiles)
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_profile_report_summarizes_without_private_text() -> None:
    layout = create_layout()
    try:
        report = build_profile_report(layout)
        formatted = format_profile_report(report)

        assert report.status == "valid"
        assert report.fullTextIncluded is False
        assert report.files[1].summaryCounts["stablePreferences"] == 1
        assert "Private Owner Name" not in formatted
        assert "private stable preference" not in formatted
        assert "private project codename" not in formatted
        assert "private note" not in formatted
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_invalid_profile_fails_safely() -> None:
    layout = create_layout()
    try:
        write_json(
            layout.directories["config"] / "rin_profile.json",
            {"schemaVersion": 1, "kind": "rin_profile"},
        )

        report = build_profile_report(layout)

        assert report.status == "invalid"
        assert any(issue.code == "invalid_displayName" for issue in report.issues)
        assert report.contextCharacterCount == 0
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_missing_manifest_reports_incomplete() -> None:
    layout = create_layout()
    try:
        layout.manifestPath.unlink()

        report = build_storage_report(layout)

        assert report.status == "incomplete"
        assert report.manifestValid is False
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_fixture_paths_are_tmp_only() -> None:
    layout = create_layout()
    try:
        resolved = resolve_path(layout.rootDir)

        assert any(part.startswith("rin-python-") for part in resolved.parts)
        assert "/.rin-data" not in str(resolved)
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_profile_validate_rejects_non_object() -> None:
    layout = create_layout()
    try:
        (layout.directories["config"] / "owner_profile.json").write_text(
            "[]\n",
            encoding="utf-8",
        )

        report = build_profile_report(layout)

        assert report.status == "invalid"
        assert any(issue.code == "invalid_json_object" for issue in report.issues)
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)
