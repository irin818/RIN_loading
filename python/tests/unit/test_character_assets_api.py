import json
import shutil
from pathlib import Path

from fastapi.testclient import TestClient

from rin.database import create_temp_layout_database
from rin.diagnostics.safety import create_temp_data_dir
from rin.server import create_app
from rin.server.api import MockApiAdapter
from rin.storage import RinDataLayout

PNG_BYTES = b"\x89PNG\r\n\x1a\nrin-local-character-test"


def create_client() -> tuple[TestClient, RinDataLayout]:
    temp = create_temp_data_dir()
    layout = create_temp_layout_database(temp.path)
    return TestClient(create_app(layout, adapter=MockApiAdapter())), layout


def manifest_path(layout: RinDataLayout) -> Path:
    return layout.rootDir / "body" / "rin" / "characters" / "manifest.json"


def test_character_asset_upload_view_and_delete_are_backend_local() -> None:
    client, layout = create_client()
    try:
        initial = client.get("/api/body/character-assets")
        assert initial.status_code == 200
        assert initial.json()["localOnly"] is True
        assert initial.json()["rawTextIncluded"] is False
        assert initial.json()["secretValuesIncluded"] is False

        uploaded = client.post(
            "/api/body/character-assets",
            content=PNG_BYTES,
            headers={
                "content-type": "image/png",
                "x-rin-file-name": "local%20rin%20pose.png",
            },
        )

        assert uploaded.status_code == 200
        payload = uploaded.json()
        asset_id = payload["selectedAssetId"]
        asset = next(item for item in payload["assets"] if item["id"] == asset_id)
        assert asset["custom"] is True
        assert asset["source"] == "local"
        assert asset["path"] == f"/api/body/character-assets/files/{asset_id}"
        assert manifest_path(layout).is_file()

        manifest = json.loads(manifest_path(layout).read_text(encoding="utf-8"))
        record = next(
            item for item in manifest["customAssets"] if item["id"] == asset_id
        )
        stored_file = (
            layout.rootDir
            / "body"
            / "rin"
            / "characters"
            / "files"
            / record["fileName"]
        )
        assert stored_file.is_file()
        assert layout.rootDir in stored_file.resolve().parents

        served = client.get(asset["path"])
        assert served.status_code == 200
        assert served.content == PNG_BYTES

        view = {
            "x": 24,
            "y": -18,
            "scale": 1.35,
            "cropTop": 2,
            "cropRight": 3,
            "cropBottom": 4,
            "cropLeft": 5,
        }
        saved_view = client.put(
            f"/api/body/character-assets/{asset_id}/view",
            json=view,
        )
        assert saved_view.status_code == 200
        assert saved_view.json()["views"][asset_id]["scale"] == 1.35

        reloaded = client.get("/api/body/character-assets")
        assert reloaded.status_code == 200
        assert any(item["id"] == asset_id for item in reloaded.json()["assets"])
        assert reloaded.json()["views"][asset_id]["x"] == 24

        deleted = client.delete(f"/api/body/character-assets/{asset_id}")
        assert deleted.status_code == 200
        assert not stored_file.exists()
        assert all(item["id"] != asset_id for item in deleted.json()["assets"])
        assert asset_id not in deleted.json()["views"]
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_default_character_assets_can_be_hidden_and_restored_locally() -> None:
    client, layout = create_client()
    try:
        default_id = "rin-00-core"

        hidden = client.delete(f"/api/body/character-assets/{default_id}")
        assert hidden.status_code == 200
        assert default_id in hidden.json()["hiddenDefaultIds"]
        assert all(item["id"] != default_id for item in hidden.json()["assets"])
        assert manifest_path(layout).is_file()

        restored = client.post("/api/body/character-assets/defaults/restore")
        assert restored.status_code == 200
        assert default_id not in restored.json()["hiddenDefaultIds"]
        assert any(item["id"] == default_id for item in restored.json()["assets"])
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_character_asset_api_rejects_non_images_and_unknown_ids() -> None:
    client, layout = create_client()
    try:
        rejected = client.post(
            "/api/body/character-assets",
            content=b"not image bytes",
            headers={
                "content-type": "text/plain",
                "x-rin-file-name": "notes.txt",
            },
        )
        missing = client.delete("/api/body/character-assets/local-missing")

        assert rejected.status_code == 400
        assert missing.status_code == 404
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)
