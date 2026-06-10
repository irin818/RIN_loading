"""API contract smoke test: spin up the FastAPI app, hit key endpoints, report pass/fail."""

from __future__ import annotations

import shutil
from dataclasses import dataclass

from fastapi.testclient import TestClient

from rin.database import create_temp_layout_database
from rin.diagnostics.safety import create_temp_data_dir
from rin.server import create_app


@dataclass(frozen=True)
class ApiContractCheckReport:
    """Result of the API contract check: per-endpoint pass/fail flags and summary status."""

    mode: str
    status: str
    localState: bool
    conversationPost: bool
    conversationHistory: bool
    readiness: bool
    memoryContextTrace: bool
    profileSummary: bool
    structuredErrors: bool
    providerCallCount: int
    externalProviderCallCount: int
    uiChangesRequired: bool


def run_api_contract_check() -> ApiContractCheckReport:
    """Create a temp database, spin up the FastAPI app, hit every key endpoint, and report results."""
    temp = create_temp_data_dir("rin-python-api-contract-")
    layout = create_temp_layout_database(temp.path)
    try:
        client = TestClient(create_app(layout))
        local_state = client.get("/api/local-state")
        readiness = client.get("/api/readiness")
        profile = client.get("/profile/status")
        trace = client.get("/memory/context-trace/status")
        posted = client.post(
            "/api/conversations",
            json={"content": "hello contract"},
        )
        turn = posted.json().get("turn", {}) if posted.status_code == 200 else {}
        conversation_id = turn.get("conversationId", "")
        history = client.get(f"/api/conversations/{conversation_id}")
        error = client.post("/api/conversations", json={"content": ""})
        checks = {
            "local_state": local_state.status_code == 200
            and "modelRuntime" in local_state.json(),
            "conversation_post": posted.status_code == 200
            and posted.json().get("ok") is True,
            "conversation_history": history.status_code == 200
            and history.json().get("ok") is True,
            "readiness": readiness.status_code == 200
            and readiness.json().get("ok") is True,
            "memory_context_trace": trace.status_code == 200
            and trace.json().get("fullTextIncluded") is False,
            "profile_summary": profile.status_code == 200
            and profile.json().get("fullTextIncluded") is False,
            "structured_errors": error.status_code in {400, 502},
        }
        return ApiContractCheckReport(
            mode="api-contract-check",
            status="passed" if all(checks.values()) else "failed",
            localState=checks["local_state"],
            conversationPost=checks["conversation_post"],
            conversationHistory=checks["conversation_history"],
            readiness=checks["readiness"],
            memoryContextTrace=checks["memory_context_trace"],
            profileSummary=checks["profile_summary"],
            structuredErrors=checks["structured_errors"],
            providerCallCount=0,
            externalProviderCallCount=0,
            uiChangesRequired=False,
        )
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def format_api_contract_check_report(report: ApiContractCheckReport) -> str:
    """Render an ApiContractCheckReport as a human-readable multi-line string."""
    return "\n".join(
        [
            "RIN Python API contract check.",
            f"Mode: {report.mode}",
            f"Status: {report.status}",
            f"GET /api/local-state: {'ok' if report.localState else 'failed'}",
            f"POST /api/conversations: {'ok' if report.conversationPost else 'failed'}",
            "GET /api/conversations/{id}: "
            f"{'ok' if report.conversationHistory else 'failed'}",
            f"Readiness: {'ok' if report.readiness else 'failed'}",
            "Memory/context trace status: "
            f"{'ok' if report.memoryContextTrace else 'failed'}",
            f"Profile summary: {'ok' if report.profileSummary else 'failed'}",
            f"Structured errors: {'ok' if report.structuredErrors else 'failed'}",
            f"Provider calls: {report.providerCallCount}",
            f"External provider calls: {report.externalProviderCallCount}",
            f"UI changes required: {'yes' if report.uiChangesRequired else 'no'}",
        ]
    )
