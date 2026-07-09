import json
import shutil
from collections.abc import Generator
from io import BytesIO
from pathlib import Path
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from rin.database import create_temp_layout_database
from rin.diagnostics.safety import create_temp_data_dir
from rin.server import create_app
from rin.server.api import MockApiAdapter
from rin.storage import RinDataLayout


@pytest.fixture()
def archive_client() -> Generator[tuple[TestClient, RinDataLayout], None, None]:
    temp = create_temp_data_dir()
    layout = create_temp_layout_database(temp.path)
    try:
        yield TestClient(create_app(layout, adapter=MockApiAdapter())), layout
    finally:
        shutil.rmtree(layout.rootDir, ignore_errors=True)


def test_archive_upload_generates_derivatives_and_metadata(
    archive_client: tuple[TestClient, RinDataLayout],
) -> None:
    client, layout = archive_client
    image = _make_image_bytes("PNG", size=(2600, 1800))

    response = _upload_asset(
        client,
        image,
        file_name="large-illustration.png",
        content_type="image/png",
        metadata={"type": "illustration", "title": "Large Illustration"},
    )

    assert response.status_code == 200
    payload = response.json()
    asset = payload["assets"][0]
    original_path = _archive_file_path(layout, "originals", asset["fileName"])
    preview_path = _archive_file_path(layout, "previews", asset["fileName"])
    thumbnail_path = _archive_file_path(layout, "thumbnails", asset["fileName"])

    assert payload["total"] == 1
    assert asset["title"] == "Large Illustration"
    assert asset["contentType"] == "image/png"
    assert asset["width"] == 2600
    assert asset["height"] == 1800
    assert asset["fileSize"] == len(image)
    assert asset["originalPath"] == f"/api/archive/assets/files/{asset['id']}"
    assert asset["previewPath"] == f"/api/archive/assets/previews/{asset['id']}"
    assert asset["thumbnailPath"] == f"/api/archive/assets/thumbnails/{asset['id']}"

    assert original_path.read_bytes() == image
    assert preview_path.is_file()
    assert thumbnail_path.is_file()
    assert max(_image_size(preview_path)) <= 2000
    assert max(_image_size(thumbnail_path)) <= 512

    original = client.get(asset["originalPath"])
    preview = client.get(asset["previewPath"])
    thumbnail = client.get(asset["thumbnailPath"])
    assert original.status_code == 200
    assert original.content == image
    assert preview.status_code == 200
    assert thumbnail.status_code == 200


@pytest.mark.parametrize(
    ("format_name", "file_name", "content_type"),
    [
        ("JPEG", "small-photo.jpg", "image/jpeg"),
        ("WEBP", "small-render.webp", "image/webp"),
    ],
)
def test_archive_small_image_derivatives_do_not_upscale(
    archive_client: tuple[TestClient, RinDataLayout],
    format_name: str,
    file_name: str,
    content_type: str,
) -> None:
    client, layout = archive_client
    image = _make_image_bytes(format_name, size=(128, 96))

    response = _upload_asset(
        client,
        image,
        file_name=file_name,
        content_type=content_type,
    )

    assert response.status_code == 200
    asset = response.json()["assets"][0]
    preview_path = _archive_file_path(layout, "previews", asset["fileName"])
    thumbnail_path = _archive_file_path(layout, "thumbnails", asset["fileName"])

    assert _image_size(preview_path) == (128, 96)
    assert _image_size(thumbnail_path) == (128, 96)


def test_archive_gif_upload_uses_original_for_preview_fallback(
    archive_client: tuple[TestClient, RinDataLayout],
) -> None:
    client, layout = archive_client
    image = _make_gif_bytes(size=(320, 240))

    response = _upload_asset(
        client,
        image,
        file_name="animated.gif",
        content_type="image/gif",
    )

    assert response.status_code == 200
    asset = response.json()["assets"][0]
    record = _manifest_record(layout, asset["id"])

    assert asset["width"] == 320
    assert asset["height"] == 240
    assert record["originalPath"] == record["previewPath"] == record["thumbnailPath"]
    assert client.get(asset["previewPath"]).content == image
    assert client.get(asset["thumbnailPath"]).content == image


def test_archive_upload_uses_detected_image_format_for_storage(
    archive_client: tuple[TestClient, RinDataLayout],
) -> None:
    client, layout = archive_client
    image = _make_image_bytes("JPEG", size=(320, 240))

    response = _upload_asset(
        client,
        image,
        file_name="wrong-extension.png",
        content_type="image/png",
    )

    assert response.status_code == 200
    asset = response.json()["assets"][0]
    assert asset["contentType"] == "image/jpeg"
    assert asset["fileName"].endswith(".jpg")
    assert _archive_file_path(layout, "originals", asset["fileName"]).read_bytes() == (
        image
    )


def test_archive_rejects_unreadable_image_uploads(
    archive_client: tuple[TestClient, RinDataLayout],
) -> None:
    client, layout = archive_client

    unreadable = _upload_asset(
        client,
        b"not a png",
        file_name="broken.png",
        content_type="image/png",
    )

    assert unreadable.status_code == 400
    assert unreadable.json()["detail"] == "Unsupported or unreadable image file."
    assert not _manifest_path(layout).exists()


def test_archive_uploads_nonimage_as_safe_downloadable_asset(
    archive_client: tuple[TestClient, RinDataLayout],
) -> None:
    client, layout = archive_client
    file_content = b"local live2d binary asset"

    response = _upload_asset(
        client,
        file_content,
        file_name="rin-model.moc3",
        content_type="application/octet-stream",
        metadata={"type": "live2d-asset", "title": "RIN model"},
    )

    assert response.status_code == 200
    asset = response.json()["assets"][0]
    record = _manifest_record(layout, asset["id"])
    original = client.get(asset["originalPath"])
    preview = client.get(asset["previewPath"])
    thumbnail = client.get(asset["thumbnailPath"])

    assert asset["contentType"] == "application/octet-stream"
    assert asset["width"] is None
    assert asset["height"] is None
    assert asset["fileSize"] == len(file_content)
    assert record["previewPath"] == ""
    assert record["thumbnailPath"] == ""
    assert _archive_file_path(layout, "originals", asset["fileName"]).read_bytes() == (
        file_content
    )
    for file_response in (original, preview, thumbnail):
        assert file_response.status_code == 200
        assert file_response.content == file_content
        assert file_response.headers["content-type"].startswith(
            "application/octet-stream"
        )
        assert file_response.headers["content-disposition"].startswith("attachment;")


def test_archive_preview_and_thumbnail_endpoints_fall_back_to_original(
    archive_client: tuple[TestClient, RinDataLayout],
) -> None:
    client, layout = archive_client
    image = _make_image_bytes("PNG", size=(640, 480))

    response = _upload_asset(
        client,
        image,
        file_name="fallback-source.png",
        content_type="image/png",
    )
    asset = response.json()["assets"][0]
    record = _manifest_record(layout, asset["id"])
    (layout.rootDir / record["previewPath"]).unlink()
    (layout.rootDir / record["thumbnailPath"]).unlink()

    preview = client.get(asset["previewPath"])
    thumbnail = client.get(asset["thumbnailPath"])

    assert preview.status_code == 200
    assert thumbnail.status_code == 200
    assert preview.content == image
    assert thumbnail.content == image


def test_archive_hard_delete_removes_original_preview_and_thumbnail(
    archive_client: tuple[TestClient, RinDataLayout],
) -> None:
    client, layout = archive_client
    image = _make_image_bytes("PNG", size=(640, 480))

    upload = _upload_asset(
        client,
        image,
        file_name="delete-me.png",
        content_type="image/png",
    )
    asset = upload.json()["assets"][0]
    original_path = _archive_file_path(layout, "originals", asset["fileName"])
    preview_path = _archive_file_path(layout, "previews", asset["fileName"])
    thumbnail_path = _archive_file_path(layout, "thumbnails", asset["fileName"])

    response = client.delete(f"/api/archive/assets/{asset['id']}?hard=true")

    assert response.status_code == 200
    assert not original_path.exists()
    assert not preview_path.exists()
    assert not thumbnail_path.exists()
    assert _manifest_path(layout).read_text(encoding="utf-8").count(asset["id"]) == 0


def test_archive_hard_delete_validates_derivative_paths_before_unlink(
    archive_client: tuple[TestClient, RinDataLayout],
) -> None:
    client, layout = archive_client
    image = _make_image_bytes("PNG", size=(640, 480))

    upload = _upload_asset(
        client,
        image,
        file_name="keep-original.png",
        content_type="image/png",
    )
    asset = upload.json()["assets"][0]
    original_path = _archive_file_path(layout, "originals", asset["fileName"])
    manifest_path = _manifest_path(layout)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["assets"][0]["previewPath"] = "../escape.png"
    manifest["assets"][0]["thumbnailPath"] = ""
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    response = client.delete(f"/api/archive/assets/{asset['id']}?hard=true")

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsafe archive asset path."
    assert original_path.read_bytes() == image
    assert _manifest_record(layout, asset["id"])["id"] == asset["id"]


def test_archive_list_accepts_multiple_asset_types(
    archive_client: tuple[TestClient, RinDataLayout],
) -> None:
    client, _layout = archive_client
    comic = _upload_asset(
        client,
        _make_image_bytes("PNG", size=(640, 480)),
        file_name="series-cover.png",
        content_type="image/png",
        metadata={"type": "comic", "title": "Series Cover"},
    ).json()["assets"][0]
    page = _upload_asset(
        client,
        _make_image_bytes("PNG", size=(640, 480)),
        file_name="series-page-1.png",
        content_type="image/png",
        metadata={
            "type": "comic-page",
            "title": "Series Page",
            "seriesId": "rin-series",
        },
    ).json()["assets"][0]
    illustration = _upload_asset(
        client,
        _make_image_bytes("PNG", size=(640, 480)),
        file_name="illustration.png",
        content_type="image/png",
        metadata={"type": "illustration", "title": "Illustration"},
    ).json()["assets"][0]
    for asset in (comic, page, illustration):
        patch = client.patch(
            f"/api/archive/assets/{asset['id']}",
            json={"status": "published"},
        )
        assert patch.status_code == 200

    response = client.get("/api/archive/assets?type=comic,comic-page")

    assert response.status_code == 200
    returned_ids = {asset["id"] for asset in response.json()["assets"]}
    assert returned_ids == {comic["id"], page["id"]}


def test_archive_rejects_manifest_path_traversal(
    archive_client: tuple[TestClient, RinDataLayout],
) -> None:
    client, layout = archive_client
    asset_id = "arc-20260706120000-evil-abcdef12"
    manifest_path = _manifest_path(layout)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(
            {
                "version": 1,
                "assets": [
                    {
                        "id": asset_id,
                        "type": "illustration",
                        "title": "Unsafe",
                        "description": "",
                        "tags": [],
                        "category": "",
                        "status": "draft",
                        "fileName": "../escape.png",
                        "contentType": "image/png",
                        "originalPath": "archive/files/originals/../escape.png",
                        "previewPath": "archive/files/previews/escape.png",
                        "thumbnailPath": "archive/files/thumbnails/escape.png",
                        "createdAt": "2026-07-06T00:00:00+00:00",
                        "updatedAt": "2026-07-06T00:00:00+00:00",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    response = client.get(f"/api/archive/assets/files/{asset_id}")

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsafe archive asset path."


def test_archive_story_content_is_returned_only_by_story_endpoint(
    archive_client: tuple[TestClient, RinDataLayout],
) -> None:
    client, _layout = archive_client
    upload = _upload_asset(
        client,
        _make_image_bytes("PNG", size=(640, 480)),
        file_name="story-cover.png",
        content_type="image/png",
        metadata={"type": "story", "title": "Story With Content"},
    )
    story = upload.json()["assets"][0]

    saved = client.put(
        f"/api/archive/stories/{story['id']}",
        json={"content": "Line one\nLine two"},
    )
    listed = client.get("/api/archive/assets?type=story")
    fetched = client.get(f"/api/archive/stories/{story['id']}")

    assert saved.status_code == 200
    assert listed.status_code == 200
    assert fetched.status_code == 200
    assert listed.json()["assets"][0]["storyContent"] is None
    assert fetched.json()["storyContent"] == "Line one\nLine two"


def _upload_asset(
    client: TestClient,
    content: bytes,
    *,
    file_name: str,
    content_type: str,
    metadata: dict[str, object] | None = None,
):
    headers = {
        "Content-Type": content_type,
        "X-RIN-File-Name": quote(file_name),
        "X-RIN-Metadata": quote(json.dumps(metadata or {})),
    }
    return client.post("/api/archive/assets", content=content, headers=headers)


def _make_image_bytes(format_name: str, *, size: tuple[int, int]) -> bytes:
    image = Image.new("RGB", size, color=(24, 160, 92))
    output = BytesIO()
    image.save(output, format=format_name)
    return output.getvalue()


def _make_gif_bytes(*, size: tuple[int, int]) -> bytes:
    first = Image.new("P", size, color=1)
    second = Image.new("P", size, color=2)
    output = BytesIO()
    first.save(
        output,
        format="GIF",
        save_all=True,
        append_images=[second],
        duration=120,
        loop=0,
    )
    return output.getvalue()


def _image_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as image:
        return image.width, image.height


def _archive_file_path(layout: RinDataLayout, kind: str, file_name: str) -> Path:
    return layout.rootDir / "archive" / "files" / kind / file_name


def _manifest_path(layout: RinDataLayout) -> Path:
    return layout.rootDir / "archive" / "manifest.json"


def _manifest_record(layout: RinDataLayout, asset_id: str) -> dict[str, object]:
    manifest = json.loads(_manifest_path(layout).read_text(encoding="utf-8"))
    return next(asset for asset in manifest["assets"] if asset["id"] == asset_id)
