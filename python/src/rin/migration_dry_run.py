from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from rin.diagnostics.safety import PRODUCTION_RIN_DATA_DIR
from rin.shadow import ShadowValidationReport, run_copy_data_shadow_report


@dataclass(frozen=True)
class MigrationDryRunReport:
    mode: str
    status: str
    sourceDbHashUnchanged: bool
    copiedDataResult: str
    plannedOperations: tuple[str, ...]
    compatibilityRisks: tuple[str, ...]
    productionApplyAvailable: bool
    privateTextIncluded: bool


@dataclass(frozen=True)
class RollbackRehearsalReport:
    mode: str
    status: str
    sourceDbHashUnchanged: bool
    copiedDataResult: str
    pythonWriteSession: str
    typescriptReadableState: str
    guarantees: tuple[str, ...]
    limits: tuple[str, ...]
    productionApplyAvailable: bool
    privateTextIncluded: bool


def run_production_migration_dry_run(
    source: Path = PRODUCTION_RIN_DATA_DIR,
) -> MigrationDryRunReport:
    shadow = run_copy_data_shadow_report(source=source, retain_copy=False)
    status = (
        "passed" if shadow.status in {"passed", "skipped_missing_source"} else "failed"
    )
    return MigrationDryRunReport(
        mode="production-migration-dry-run",
        status=status,
        sourceDbHashUnchanged=shadow.sourceDbHashUnchanged,
        copiedDataResult=shadow.status,
        plannedOperations=(
            "copy production .rin-data to /tmp/rin-python-shadow-*",
            "inspect copied SQLite/profile state",
            "simulate Python schema/runtime write on the copy only",
            "verify original SQLite hash is unchanged",
            "leave production launchers unchanged",
        ),
        compatibilityRisks=(
            "production cutover still requires owner approval",
            "real-data migration apply is not implemented",
            "TypeScript remains the rollback backend",
        ),
        productionApplyAvailable=False,
        privateTextIncluded=False,
    )


def run_rollback_rehearsal(
    source: Path = PRODUCTION_RIN_DATA_DIR,
) -> RollbackRehearsalReport:
    shadow = run_copy_data_shadow_report(source=source, retain_copy=False)
    status = (
        "passed" if shadow.status in {"passed", "skipped_missing_source"} else "failed"
    )
    return RollbackRehearsalReport(
        mode="rollback-rehearsal",
        status=status,
        sourceDbHashUnchanged=shadow.sourceDbHashUnchanged,
        copiedDataResult=shadow.status,
        pythonWriteSession=shadow.writeSimulation,
        typescriptReadableState=typescript_readable_state(shadow),
        guarantees=(
            "TypeScript production files and launchers are unchanged",
            "Python writes occurred only on copied/temp data",
            "source DB hash stayed unchanged",
        ),
        limits=(
            "does not prove future production cutover safety",
            "does not perform or approve real-data migration",
            "does not remove the need for owner-reviewed backups",
        ),
        productionApplyAvailable=False,
        privateTextIncluded=False,
    )


def typescript_readable_state(report: ShadowValidationReport) -> str:
    if report.status == "skipped_missing_source":
        return "skipped_missing_source"
    if report.schemaVersion is None:
        return "unknown"
    return "compatible_schema_no_launcher_change"


def format_migration_dry_run_report(report: MigrationDryRunReport) -> str:
    lines = [
        "RIN Python production migration dry-run report.",
        f"Mode: {report.mode}",
        f"Status: {report.status}",
        f"Source DB hash unchanged: {'yes' if report.sourceDbHashUnchanged else 'no'}",
        f"Copied-data result: {report.copiedDataResult}",
        "Production apply available: "
        f"{'yes' if report.productionApplyAvailable else 'no'}",
        f"Private text included: {'yes' if report.privateTextIncluded else 'no'}",
        "Planned operations:",
    ]
    lines.extend(f"- {item}" for item in report.plannedOperations)
    lines.append("Compatibility risks:")
    lines.extend(f"- {item}" for item in report.compatibilityRisks)
    return "\n".join(lines)


def format_rollback_rehearsal_report(report: RollbackRehearsalReport) -> str:
    lines = [
        "RIN Python rollback rehearsal report.",
        f"Mode: {report.mode}",
        f"Status: {report.status}",
        f"Source DB hash unchanged: {'yes' if report.sourceDbHashUnchanged else 'no'}",
        f"Copied-data result: {report.copiedDataResult}",
        f"Python write session: {report.pythonWriteSession}",
        f"TypeScript readable state: {report.typescriptReadableState}",
        "Production apply available: "
        f"{'yes' if report.productionApplyAvailable else 'no'}",
        f"Private text included: {'yes' if report.privateTextIncluded else 'no'}",
        "Rollback guarantees:",
    ]
    lines.extend(f"- {item}" for item in report.guarantees)
    lines.append("Rollback limits:")
    lines.extend(f"- {item}" for item in report.limits)
    return "\n".join(lines)
