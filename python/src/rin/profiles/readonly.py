"""
Profile loading and validation: load RIN and owner profiles from disk, validate, build
reports.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from pydantic import ValidationError

from rin.contracts import (
    OwnerProfile,
    ProfileFileStatus,
    ProfileReport,
    ProfileValidationIssue,
    RinProfile,
)
from rin.storage.layout import RinDataLayout, create_data_layout

ProfileFile = Literal["rin_profile.json", "owner_profile.json"]
RIN_PROFILE_FILE: ProfileFile = "rin_profile.json"
OWNER_PROFILE_FILE: ProfileFile = "owner_profile.json"


def load_rin_profile(layout: RinDataLayout) -> RinProfile:
    """Load and validate the RIN profile JSON file from the config directory."""
    return RinProfile.model_validate(read_profile_json(layout, RIN_PROFILE_FILE))


def load_owner_profile(layout: RinDataLayout) -> OwnerProfile:
    """Load and validate the owner profile JSON file from the config directory."""
    return OwnerProfile.model_validate(read_profile_json(layout, OWNER_PROFILE_FILE))


def build_profile_report(layout: RinDataLayout) -> ProfileReport:
    """
    Load both profiles, validate them, and build a ProfileReport with issue diagnostics.
    """
    rin_profile, rin_issues = validate_rin_profile(layout)
    owner_profile, owner_issues = validate_owner_profile(layout)
    issues = [*rin_issues, *owner_issues]
    files = [
        file_status(RIN_PROFILE_FILE, rin_profile, rin_issues),
        file_status(OWNER_PROFILE_FILE, owner_profile, owner_issues),
    ]

    return ProfileReport(
        mode="profile-report",
        status="valid" if not issues else "invalid",
        files=files,
        issueCount=len(issues),
        issues=issues,
        contextCharacterCount=estimate_context_character_count(
            rin_profile,
            owner_profile,
            issues,
        ),
        providerCallCount=0,
        fullTextIncluded=False,
    )


def format_profile_report(report: ProfileReport) -> str:
    lines = [
        "RIN Python profile report.",
        "Mode: profile-report",
        f"Status: {report.status}",
        f"Files: {len(report.files)}",
        f"Issues: {report.issueCount}",
        f"Context characters: {report.contextCharacterCount}",
        f"providerCallCount: {report.providerCallCount}",
        f"Full text included: {'yes' if report.fullTextIncluded else 'no'}",
        "File summaries:",
    ]
    lines.extend(
        f"- {item.file} exists={'yes' if item.exists else 'no'} "
        f"valid={'yes' if item.valid else 'no'} issues={item.issueCount} "
        f"counts={json.dumps(item.summaryCounts, sort_keys=True)}"
        for item in report.files
    )
    if report.issues:
        lines.append("Issues:")
        lines.extend(
            f"- {issue.file} {issue.code}: {issue.message}" for issue in report.issues
        )
    return "\n".join(lines)


def validate_rin_profile(
    layout: RinDataLayout,
) -> tuple[RinProfile | None, list[ProfileValidationIssue]]:
    try:
        return load_rin_profile(layout), []
    except FileNotFoundError:
        return None, missing_file_issue(RIN_PROFILE_FILE)
    except json.JSONDecodeError:
        return None, invalid_json_issue(RIN_PROFILE_FILE)
    except TypeError:
        return None, invalid_json_object_issue(RIN_PROFILE_FILE)
    except ValidationError as error:
        return None, validation_issues_from_error(RIN_PROFILE_FILE, error)


def validate_owner_profile(
    layout: RinDataLayout,
) -> tuple[OwnerProfile | None, list[ProfileValidationIssue]]:
    try:
        return load_owner_profile(layout), []
    except FileNotFoundError:
        return None, missing_file_issue(OWNER_PROFILE_FILE)
    except json.JSONDecodeError:
        return None, invalid_json_issue(OWNER_PROFILE_FILE)
    except TypeError:
        return None, invalid_json_object_issue(OWNER_PROFILE_FILE)
    except ValidationError as error:
        return None, validation_issues_from_error(OWNER_PROFILE_FILE, error)


def read_profile_json(layout: RinDataLayout, file: ProfileFile) -> dict[str, Any]:
    raw = (layout.directories["config"] / file).read_text(encoding="utf-8")
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise TypeError("Profile file must contain a JSON object.")
    return parsed


def missing_file_issue(file: ProfileFile) -> list[ProfileValidationIssue]:
    return [
        ProfileValidationIssue(
            file=file,
            code="missing_file",
            message="Profile file is missing.",
        )
    ]


def invalid_json_issue(file: ProfileFile) -> list[ProfileValidationIssue]:
    return [
        ProfileValidationIssue(
            file=file,
            code="invalid_json",
            message="Profile file must be valid JSON.",
        )
    ]


def invalid_json_object_issue(file: ProfileFile) -> list[ProfileValidationIssue]:
    return [
        ProfileValidationIssue(
            file=file,
            code="invalid_json_object",
            message="Profile file must contain a JSON object.",
        )
    ]


def validation_issues_from_error(
    file: ProfileFile,
    error: ValidationError,
) -> list[ProfileValidationIssue]:
    issues: list[ProfileValidationIssue] = []
    for item in error.errors():
        key = str(item["loc"][0]) if item["loc"] else "json_object"
        issues.append(
            ProfileValidationIssue(
                file=file,
                code=f"invalid_{key}",
                message=issue_message(key, item["type"]),
            )
        )
    return issues


def issue_message(key: str, issue_type: str) -> str:
    if key == "json_object":
        return "Profile file must contain a JSON object."
    if issue_type == "missing":
        return f"{key} is required."
    return f"{key} is invalid."


def file_status(
    file: ProfileFile,
    profile: RinProfile | OwnerProfile | None,
    issues: list[ProfileValidationIssue],
) -> ProfileFileStatus:
    return ProfileFileStatus(
        file=file,
        exists=not any(issue.code == "missing_file" for issue in issues),
        valid=not issues,
        issueCount=len(issues),
        summaryCounts=summary_counts(profile),
    )


def summary_counts(profile: RinProfile | OwnerProfile | None) -> dict[str, int]:
    if profile is None:
        return {}
    if profile.kind == "rin_profile":
        return {
            "communicationStyle": len(profile.communicationStyle),
            "behaviorBoundaries": len(profile.behaviorBoundaries),
            "contextNotes": len(profile.contextNotes),
        }
    return {
        "communicationPreferences": len(profile.communicationPreferences),
        "stablePreferences": len(profile.stablePreferences),
        "activeProjects": len(profile.activeProjects),
        "contextNotes": len(profile.contextNotes),
    }


def estimate_context_character_count(
    rin_profile: RinProfile | None,
    owner_profile: OwnerProfile | None,
    issues: list[ProfileValidationIssue],
) -> int:
    if issues or rin_profile is None or owner_profile is None:
        return 0
    # Compact profile summary — no full profile text exposed.
    compact = {
        "rin": summary_counts(rin_profile),
        "owner": summary_counts(owner_profile),
    }
    return len(json.dumps(compact, sort_keys=True))


def build_profile_report_for_path(
    data_dir: str,
    cwd: Path | str | None = None,
) -> ProfileReport:
    return build_profile_report(create_data_layout(data_dir, cwd))
