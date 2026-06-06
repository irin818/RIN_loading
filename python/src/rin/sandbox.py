from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from rin.database import create_temp_layout_database, inspect_database
from rin.diagnostics.safety import (
    PERSISTENT_SANDBOX_DATA_DIR,
    PRODUCTION_RIN_DATA_DIR,
    assert_safe_persistent_sandbox_data_dir,
)
from rin.preview import PreviewSmokeReport, production_write_is_rejected
from rin.server import create_app
from rin.storage import RinDataLayout, create_data_layout

SANDBOX_MODE = "python-persistent-sandbox"


@dataclass(frozen=True)
class SandboxInitReport:
    mode: str
    status: str
    dataDir: str
    productionData: str
    productionRejected: bool
    manifestReady: bool
    databaseReady: bool
    profileReady: bool
    persistent: bool
    fullTextIncluded: bool


@dataclass(frozen=True)
class SandboxResetDryRunReport:
    mode: str
    status: str
    dataDir: str
    wouldRemove: bool
    wouldRemoveDatabase: bool
    wouldRemoveManifest: bool
    destructiveApplyAvailable: bool
    fullTextIncluded: bool


def sandbox_data_dir() -> Path:
    return assert_safe_persistent_sandbox_data_dir(PERSISTENT_SANDBOX_DATA_DIR)


def create_sandbox_layout() -> RinDataLayout:
    return create_data_layout(str(sandbox_data_dir()), cwd="/")


def initialize_sandbox() -> SandboxInitReport:
    layout = create_sandbox_layout()
    assert_safe_persistent_sandbox_data_dir(layout.rootDir)
    for directory in layout.directories.values():
        directory.mkdir(parents=True, exist_ok=True)
    now = utc_now()
    write_json_if_missing(
        layout.manifestPath,
        {
            "project": "RIN",
            "schemaVersion": 1,
            "ownerId": "python-sandbox-owner",
            "deviceId": "python-sandbox-device",
            "createdAt": now,
            "updatedAt": now,
            "directories": {key: str(path) for key, path in layout.directories.items()},
        },
    )
    write_core_files(layout, now)
    create_temp_layout_database(layout.rootDir)
    status = inspect_database(layout)
    profile_ready = (layout.directories["config"] / "rin_profile.json").is_file() and (
        layout.directories["config"] / "owner_profile.json"
    ).is_file()
    return SandboxInitReport(
        mode=SANDBOX_MODE,
        status="ready" if status.schemaVersion >= 6 and profile_ready else "incomplete",
        dataDir=str(layout.rootDir),
        productionData=str(PRODUCTION_RIN_DATA_DIR),
        productionRejected=production_write_is_rejected(),
        manifestReady=layout.manifestPath.is_file(),
        databaseReady=status.schemaVersion >= 6,
        profileReady=profile_ready,
        persistent=True,
        fullTextIncluded=False,
    )


def run_sandbox_smoke() -> PreviewSmokeReport:
    from fastapi.testclient import TestClient

    init_report = initialize_sandbox()
    layout = create_sandbox_layout()
    client = TestClient(create_app(layout))
    readiness = client.get("/readiness")
    state = client.get("/state")
    created = client.post("/conversations", json={"title": "Python sandbox smoke"})
    conversation_id = created.json().get("id") if created.status_code == 200 else ""
    sent = client.post(
        f"/conversations/{conversation_id}/send",
        json={"content": "hello persistent sandbox"},
    )
    history = client.get(f"/conversations/{conversation_id}/history")
    trace = client.get("/memory/context-trace/status")
    status = (
        "passed"
        if all(
            [
                init_report.status == "ready",
                readiness.status_code == 200,
                state.status_code == 200,
                created.status_code == 200,
                sent.status_code == 200,
                history.status_code == 200,
                trace.status_code == 200,
                init_report.productionRejected,
            ]
        )
        else "failed"
    )
    return PreviewSmokeReport(
        mode="python-sandbox-smoke",
        status=status,
        dataDir=str(layout.rootDir),
        readinessOk=readiness.status_code == 200,
        stateOk=state.status_code == 200,
        conversationOk=sent.status_code == 200,
        historyOk=history.status_code == 200,
        traceOk=trace.status_code == 200,
        productionWriteRejected=init_report.productionRejected,
        providerCallCount=0,
        externalProviderCallCount=0,
        fullTextIncluded=False,
        cleanup="retained",
    )


def run_sandbox_reset_dry_run() -> SandboxResetDryRunReport:
    layout = create_sandbox_layout()
    assert_safe_persistent_sandbox_data_dir(layout.rootDir)
    return SandboxResetDryRunReport(
        mode="python-sandbox-reset-dry-run",
        status="dry_run_only",
        dataDir=str(layout.rootDir),
        wouldRemove=layout.rootDir.exists(),
        wouldRemoveDatabase=(layout.directories["databases"] / "rin.sqlite").exists(),
        wouldRemoveManifest=layout.manifestPath.exists(),
        destructiveApplyAvailable=False,
        fullTextIncluded=False,
    )


def format_sandbox_init_report(report: SandboxInitReport) -> str:
    return "\n".join(
        [
            "RIN Python persistent sandbox init report.",
            f"Mode: {report.mode}",
            f"Status: {report.status}",
            f"Data dir: {report.dataDir}",
            f"Production data path: {report.productionData}",
            f"Production data rejected: {'yes' if report.productionRejected else 'no'}",
            f"Manifest ready: {'yes' if report.manifestReady else 'no'}",
            f"Database ready: {'yes' if report.databaseReady else 'no'}",
            f"Profile ready: {'yes' if report.profileReady else 'no'}",
            f"Persistent: {'yes' if report.persistent else 'no'}",
            f"Full text included: {'yes' if report.fullTextIncluded else 'no'}",
        ]
    )


def format_sandbox_reset_dry_run_report(
    report: SandboxResetDryRunReport,
) -> str:
    return "\n".join(
        [
            "RIN Python persistent sandbox reset dry-run report.",
            f"Mode: {report.mode}",
            f"Status: {report.status}",
            f"Data dir: {report.dataDir}",
            f"Would remove sandbox: {'yes' if report.wouldRemove else 'no'}",
            f"Would remove database: {'yes' if report.wouldRemoveDatabase else 'no'}",
            f"Would remove manifest: {'yes' if report.wouldRemoveManifest else 'no'}",
            "Destructive apply available: "
            f"{'yes' if report.destructiveApplyAvailable else 'no'}",
            f"Full text included: {'yes' if report.fullTextIncluded else 'no'}",
        ]
    )


def write_core_files(layout: RinDataLayout, now: str) -> None:
    write_json_if_missing(
        layout.rootDir / "config/user_model.json",
        {"schemaVersion": 1},
    )
    write_json_if_missing(
        layout.rootDir / "config/ai_identity.json",
        {"schemaVersion": 1, "kind": "ai_identity", "updatedAt": now},
    )
    write_json_if_missing(
        layout.rootDir / "config/ai_state.json",
        {"schemaVersion": 1, "kind": "ai_state", "updatedAt": now},
    )
    write_json_if_missing(
        layout.rootDir / "config/policy_config.json",
        {"schemaVersion": 1, "kind": "policy_config", "updatedAt": now},
    )
    write_json_if_missing(
        layout.rootDir / "config/model_config.json",
        {"schemaVersion": 1, "kind": "model_config", "updatedAt": now},
    )
    write_json_if_missing(
        layout.rootDir / "config/rin_profile.json",
        {
            "schemaVersion": 1,
            "kind": "rin_profile",
            "updatedAt": now,
            "displayName": "RIN Python Sandbox",
            "role": "local-first Python sandbox candidate",
            "communicationStyle": ["sandbox", "local-only"],
            "behaviorBoundaries": [
                "Use sandbox data only.",
                "Do not treat sandbox data as production memory.",
            ],
            "contextNotes": ["Persistent Python sandbox; not production .rin-data."],
        },
    )
    write_json_if_missing(
        layout.rootDir / "config/owner_profile.json",
        {
            "schemaVersion": 1,
            "kind": "owner_profile",
            "ownerId": "python-sandbox-owner",
            "updatedAt": now,
            "displayName": "Sandbox Owner",
            "communicationPreferences": ["Use local-only sandbox behavior."],
            "stablePreferences": [],
            "activeProjects": ["Python cutover sandbox validation"],
            "contextNotes": ["Synthetic sandbox profile only."],
        },
    )
    audit_log = layout.rootDir / "logs/audit_log.jsonl"
    audit_log.parent.mkdir(parents=True, exist_ok=True)
    if not audit_log.exists():
        audit_log.write_text("", encoding="utf-8")


def write_json_if_missing(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(
            f"{json.dumps(payload, indent=2, sort_keys=True)}\n",
            encoding="utf-8",
        )


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
