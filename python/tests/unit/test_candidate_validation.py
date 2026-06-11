import hashlib
import shutil
from pathlib import Path

from fastapi.testclient import TestClient

from rin.database import (
    create_temp_layout_database,
    inspect_database,
)
from rin.diagnostics.safety import create_temp_data_dir
from rin.server import create_app
from rin.storage import create_data_layout


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def test_candidate_api_runtime_and_readonly_reports_on_synthetic_data() -> None:
    temp = create_temp_data_dir()
    layout = create_temp_layout_database(temp.path)
    client = TestClient(create_app(layout))
    try:
        created = client.post("/conversations", json={"title": "Candidate"})
        conversation_id = created.json()["id"]
        sent = client.post(
            f"/conversations/{conversation_id}/send",
            json={"content": "hello candidate"},
        )
        state = client.get("/state")
        trace = client.get("/memory/context-trace/status")

        assert created.status_code == 200
        assert sent.status_code == 200
        assert sent.json()["status"] == "completed"
        assert state.json()["conversations"] == 1
        assert state.json()["messages"] == 2
        assert trace.json()["memoryV2Traces"] == 0
        assert trace.json()["providerCallCount"] == 0
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_readonly_inspection_does_not_change_copied_database_hash() -> None:
    source_temp = create_temp_data_dir()
    source_layout = create_temp_layout_database(source_temp.path)
    copy_temp = create_temp_data_dir()
    try:
        shutil.copytree(source_layout.rootDir, copy_temp.path, dirs_exist_ok=True)
        copied_layout = create_data_layout(str(copy_temp.path), cwd="/")
        database_path = copied_layout.directories["databases"] / "rin.sqlite"

        before = file_hash(database_path)
        status = inspect_database(copied_layout)
        after = file_hash(database_path)

        assert status.schemaVersion == 6
        assert before == after
    finally:
        shutil.rmtree(source_layout.rootDir, ignore_errors=True)
        shutil.rmtree(copy_temp.path, ignore_errors=True)
