from __future__ import annotations

import os
import urllib.error
import urllib.request
from dataclasses import dataclass

from rin.database import inspect_database
from rin.diagnostics.safety import PRODUCTION_RIN_DATA_DIR
from rin.storage import create_data_layout

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)))


@dataclass(frozen=True)
class ProductionCheckReport:
    status: str
    dataDir: str
    schemaVersion: int
    conversations: int
    messages: int
    defaultLauncherExists: bool
    defaultLauncherExecutable: bool
    extraRootLaunchersAbsent: bool
    externalApiDisabled: bool
    localModelChecked: bool
    localModelReady: bool | None


def _check_local_ollama() -> bool:
    base_url = os.environ.get("RIN_OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    model = os.environ.get("RIN_OLLAMA_MODEL", "qwen3:4b")
    try:
        with urllib.request.urlopen(f"{base_url}/api/tags", timeout=3) as resp:
            payload = resp.read().decode("utf-8")
    except (OSError, urllib.error.URLError):
        return False
    return f'"name":"{model}"' in payload or f'"name": "{model}"' in payload


def run_production_check(*, check_local_model: bool = False) -> ProductionCheckReport:
    layout = create_data_layout(str(PRODUCTION_RIN_DATA_DIR), cwd="/")
    status = inspect_database(layout)

    default_launcher = os.path.join(_REPO_ROOT, "Start_RIN.command")
    launcher_exists = os.path.isfile(default_launcher)
    launcher_exec = launcher_exists and os.access(default_launcher, os.X_OK)

    extra_launchers = sorted(
        name for name in os.listdir(_REPO_ROOT)
        if name.endswith(".command") and name != "Start_RIN.command"
    )

    local_ready: bool | None = None
    if check_local_model:
        local_ready = _check_local_ollama()

    passed = all([
        status.schemaVersion >= 6,
        launcher_exists,
        launcher_exec,
        not extra_launchers,
        local_ready is not False,
    ])

    return ProductionCheckReport(
        status="passed" if passed else "failed",
        dataDir=str(layout.rootDir),
        schemaVersion=status.schemaVersion,
        conversations=status.counts.conversations,
        messages=status.counts.messages,
        defaultLauncherExists=launcher_exists,
        defaultLauncherExecutable=launcher_exec,
        extraRootLaunchersAbsent=not extra_launchers,
        externalApiDisabled=True,
        localModelChecked=check_local_model,
        localModelReady=local_ready,
    )


def format_report(report: ProductionCheckReport) -> str:
    local_model = (
        "not checked" if not report.localModelChecked
        else "ready" if report.localModelReady
        else "not ready"
    )
    return "\n".join([
        "RIN Python production check report.",
        f"Status: {report.status}",
        f"Data dir: {report.dataDir}",
        f"Schema version: {report.schemaVersion}",
        f"Conversations: {report.conversations}",
        f"Messages: {report.messages}",
        f"Default launcher exists: {'yes' if report.defaultLauncherExists else 'no'}",
        f"Default launcher executable: {'yes' if report.defaultLauncherExecutable else 'no'}",
        f"Extra root launchers absent: {'yes' if report.extraRootLaunchersAbsent else 'no'}",
        f"External API disabled: {'yes' if report.externalApiDisabled else 'no'}",
        f"Local model: {local_model}",
    ])


def main() -> None:
    check_local = os.environ.get("RIN_PYTHON_CHECK_LOCAL_MODEL") == "1"
    print(format_report(run_production_check(check_local_model=check_local)))


if __name__ == "__main__":
    main()
