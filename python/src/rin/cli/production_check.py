"""CLI entry point: inspect production data and external API chat configuration."""

from __future__ import annotations

import os
from dataclasses import dataclass

from rin.config.chat_provider import load_chat_provider_config
from rin.database import inspect_database
from rin.diagnostics.safety import PRODUCTION_RIN_DATA_DIR
from rin.storage import create_data_layout

_REPO_ROOT = os.path.dirname(
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
)


@dataclass(frozen=True)
class ProductionCheckReport:
    """
    Result of inspecting production data, launcher files, and API chat config.
    """

    status: str
    dataDir: str
    schemaVersion: int
    conversations: int
    messages: int
    defaultLauncherExists: bool
    defaultLauncherExecutable: bool
    extraRootLaunchersAbsent: bool
    externalApiConfigured: bool
    apiConfigurationStatus: str
    apiMissingEnvironment: list[str]


def yes_no(value: bool) -> str:
    """Format a boolean for concise CLI reports."""
    return "yes" if value else "no"


def run_production_check() -> ProductionCheckReport:
    """
    Inspect the production .rin-data database, launcher files, and API config.
    """
    layout = create_data_layout(str(PRODUCTION_RIN_DATA_DIR), cwd="/")
    status = inspect_database(layout)
    chat_config = load_chat_provider_config()

    default_launcher = os.path.join(_REPO_ROOT, "Start_RIN.command")
    launcher_exists = os.path.isfile(default_launcher)
    launcher_exec = launcher_exists and os.access(default_launcher, os.X_OK)

    extra_launchers = sorted(
        name
        for name in os.listdir(_REPO_ROOT)
        if name.endswith(".command") and name != "Start_RIN.command"
    )

    passed = all(
        [
            status.schemaVersion >= 6,
            launcher_exists,
            launcher_exec,
            not extra_launchers,
        ]
    )

    return ProductionCheckReport(
        status="passed" if passed else "failed",
        dataDir=str(layout.rootDir),
        schemaVersion=status.schemaVersion,
        conversations=status.counts.conversations,
        messages=status.counts.messages,
        defaultLauncherExists=launcher_exists,
        defaultLauncherExecutable=launcher_exec,
        extraRootLaunchersAbsent=not extra_launchers,
        externalApiConfigured=chat_config.configured,
        apiConfigurationStatus=chat_config.configurationStatus,
        apiMissingEnvironment=chat_config.missingEnvironment,
    )


def format_report(report: ProductionCheckReport) -> str:
    """Render a ProductionCheckReport as a human-readable multi-line string."""
    return "\n".join(
        [
            "RIN Python production check report.",
            f"Status: {report.status}",
            f"Data dir: {report.dataDir}",
            f"Schema version: {report.schemaVersion}",
            f"Conversations: {report.conversations}",
            f"Messages: {report.messages}",
            f"Default launcher exists: {yes_no(report.defaultLauncherExists)}",
            f"Default launcher executable: {yes_no(report.defaultLauncherExecutable)}",
            f"Extra root launchers absent: {yes_no(report.extraRootLaunchersAbsent)}",
            f"External API configured: {yes_no(report.externalApiConfigured)}",
            f"API config status: {report.apiConfigurationStatus}",
            "API missing environment: "
            f"{', '.join(report.apiMissingEnvironment) or 'none'}",
        ]
    )


def main() -> None:
    """
    Run the production check and print the report.
    """
    print(format_report(run_production_check()))


if __name__ == "__main__":
    main()
