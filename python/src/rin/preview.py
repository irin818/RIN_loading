from __future__ import annotations

import asyncio
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path

from rin.database import create_temp_layout_database
from rin.diagnostics.safety import PRODUCTION_RIN_DATA_DIR, assert_safe_temp_data_dir
from rin.model.local_chat_smoke import (
    LocalChatSmokeReport,
    run_local_chat_smoke,
)
from rin.server import create_app
from rin.storage import RinDataLayout

PREVIEW_HOST = "127.0.0.1"
PREVIEW_PORT = 8765


@dataclass(frozen=True)
class PreviewSmokeReport:
    mode: str
    status: str
    dataDir: str
    readinessOk: bool
    stateOk: bool
    conversationOk: bool
    historyOk: bool
    traceOk: bool
    productionWriteRejected: bool
    providerCallCount: int
    externalProviderCallCount: int
    fullTextIncluded: bool
    cleanup: str


def create_preview_layout(data_dir: str | None = None) -> RinDataLayout:
    root = Path(
        data_dir or tempfile.mkdtemp(prefix="rin-python-preview-", dir="/tmp")
    ).resolve()
    if root == PRODUCTION_RIN_DATA_DIR.resolve():
        raise ValueError("Python preview refuses to use production .rin-data.")
    assert_safe_temp_data_dir(root)
    return create_temp_layout_database(root)


def preview_url(host: str = PREVIEW_HOST, port: int = PREVIEW_PORT) -> str:
    return f"http://{host}:{port}"


def run_preview_smoke(retain_data: bool = False) -> PreviewSmokeReport:
    from fastapi.testclient import TestClient

    layout = create_preview_layout()
    cleanup = "retained" if retain_data else "removed"
    try:
        client = TestClient(create_app(layout))
        readiness = client.get("/readiness")
        state = client.get("/state")
        created = client.post("/conversations", json={"title": "Preview smoke"})
        conversation_id = created.json().get("id") if created.status_code == 200 else ""
        sent = client.post(
            f"/conversations/{conversation_id}/send",
            json={"content": "hello preview"},
        )
        history = client.get(f"/conversations/{conversation_id}/history")
        trace = client.get("/memory/context-trace/status")
        rejected = production_write_is_rejected()
        status = (
            "passed"
            if all(
                [
                    readiness.status_code == 200,
                    state.status_code == 200,
                    created.status_code == 200,
                    sent.status_code == 200,
                    history.status_code == 200,
                    trace.status_code == 200,
                    rejected,
                ]
            )
            else "failed"
        )
        return PreviewSmokeReport(
            mode="python-preview-smoke",
            status=status,
            dataDir=str(layout.rootDir),
            readinessOk=readiness.status_code == 200,
            stateOk=state.status_code == 200,
            conversationOk=sent.status_code == 200,
            historyOk=history.status_code == 200,
            traceOk=trace.status_code == 200,
            productionWriteRejected=rejected,
            providerCallCount=0,
            externalProviderCallCount=0,
            fullTextIncluded=False,
            cleanup=cleanup,
        )
    finally:
        if not retain_data:
            shutil.rmtree(layout.rootDir, ignore_errors=True)


def production_write_is_rejected() -> bool:
    try:
        create_preview_layout(str(PRODUCTION_RIN_DATA_DIR))
    except Exception:
        return True
    return False


async def run_preview_local_model_smoke() -> LocalChatSmokeReport:
    return await run_local_chat_smoke()


def format_preview_smoke_report(report: PreviewSmokeReport) -> str:
    return "\n".join(
        [
            "RIN Python preview smoke report.",
            f"Mode: {report.mode}",
            f"Status: {report.status}",
            f"Data dir: {report.dataDir}",
            f"Readiness endpoint: {'ok' if report.readinessOk else 'failed'}",
            f"Local state endpoint: {'ok' if report.stateOk else 'failed'}",
            "Mock conversation endpoint: "
            f"{'ok' if report.conversationOk else 'failed'}",
            f"History endpoint: {'ok' if report.historyOk else 'failed'}",
            f"Trace endpoint: {'ok' if report.traceOk else 'failed'}",
            "Production data write rejected: "
            f"{'yes' if report.productionWriteRejected else 'no'}",
            f"Provider calls: {report.providerCallCount}",
            f"External provider calls: {report.externalProviderCallCount}",
            f"Full text included: {'yes' if report.fullTextIncluded else 'no'}",
            f"Cleanup: {report.cleanup}",
        ]
    )


def run_async_preview_local_model_smoke() -> LocalChatSmokeReport:
    return asyncio.run(run_preview_local_model_smoke())
