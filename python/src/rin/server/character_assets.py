"""Local RIN character image asset management for the Web UI."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal
from urllib.parse import unquote
from uuid import uuid4

from fastapi import HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from rin.storage import RinDataLayout

CharacterSource = Literal["core", "imagel", "bbb", "local"]

ASSET_ID_RE = re.compile(r"^(rin-[a-z0-9-]+|local-[a-z0-9-]+)$")
SLUG_PART_RE = re.compile(r"[^a-z0-9]+")
ALLOWED_IMAGE_SUFFIXES = {
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}
CONTENT_TYPE_SUFFIXES = {value: key for key, value in ALLOWED_IMAGE_SUFFIXES.items()}
MANIFEST_VERSION = 1


class CharacterViewPayload(BaseModel):
    """Safe per-image stage transform values editable from the gallery UI."""

    model_config = ConfigDict(extra="forbid")

    x: float = 0
    y: float = 0
    scale: float = 1
    cropTop: float = 0
    cropRight: float = 0
    cropBottom: float = 0
    cropLeft: float = 0


class CharacterAssetPayload(BaseModel):
    """Display-safe character asset metadata returned to the React UI."""

    model_config = ConfigDict(extra="forbid")

    id: str
    label: str
    source: CharacterSource
    pose: str
    path: str
    previewPath: str
    custom: bool = False
    stageScale: float = 1
    stageX: float = 0
    stageY: float = 0


class CharacterAssetRecord(BaseModel):
    """Manifest record for owner-added local image assets."""

    model_config = ConfigDict(extra="forbid")

    id: str
    label: str
    fileName: str
    contentType: str
    pose: str = "custom"
    createdAt: str
    stageScale: float = 1
    stageX: float = 0
    stageY: float = 0


class CharacterAssetManifest(BaseModel):
    """Local manifest persisted under the RIN data directory."""

    model_config = ConfigDict(extra="ignore")

    version: int = MANIFEST_VERSION
    customAssets: list[CharacterAssetRecord] = Field(default_factory=list)
    hiddenDefaultIds: list[str] = Field(default_factory=list)
    views: dict[str, CharacterViewPayload] = Field(default_factory=dict)


DEFAULT_CHARACTER_ASSETS: tuple[CharacterAssetPayload, ...] = (
    CharacterAssetPayload(
        id="rin-00-core",
        label="CORE DEFAULT",
        source="core",
        pose="standing",
        path="/body-assets/rin/characters/rin-00-core.png",
        previewPath="/body-assets/rin/characters/thumbs/rin-00-core.png",
        stageScale=1.07,
        stageY=-4,
    ),
    CharacterAssetPayload(
        id="rin-imagel-01-leap",
        label="CLOVER LEAP",
        source="imagel",
        pose="leap",
        path="/body-assets/rin/characters/rin-imagel-01-leap.png",
        previewPath="/body-assets/rin/characters/thumbs/rin-imagel-01-leap.png",
        stageScale=1.02,
    ),
    CharacterAssetPayload(
        id="rin-imagel-03-kneel",
        label="QUIET KNEEL",
        source="imagel",
        pose="kneel",
        path="/body-assets/rin/characters/rin-imagel-03-kneel.png",
        previewPath="/body-assets/rin/characters/thumbs/rin-imagel-03-kneel.png",
        stageScale=1.04,
        stageY=8,
    ),
    CharacterAssetPayload(
        id="rin-bbb-03-stand",
        label="STATIC STAND",
        source="bbb",
        pose="stand",
        path="/body-assets/rin/characters/rin-bbb-03-stand.png",
        previewPath="/body-assets/rin/characters/thumbs/rin-bbb-03-stand.png",
        stageScale=1.08,
        stageY=-2,
    ),
)
DEFAULT_ASSET_IDS = {asset.id for asset in DEFAULT_CHARACTER_ASSETS}


def list_character_assets(layout: RinDataLayout) -> dict[str, object]:
    """Return display-safe local and bundled character asset metadata."""
    manifest = _load_manifest(layout)
    assets = _visible_assets(layout, manifest)
    return _asset_response(layout, manifest, assets)


async def store_uploaded_character_asset(
    layout: RinDataLayout,
    request: Request,
) -> dict[str, object]:
    """Persist an uploaded image stream under the local RIN data directory."""
    manifest = _load_manifest(layout)
    original_name = _uploaded_file_name(request)
    content_type = _safe_content_type(request)
    suffix = _safe_suffix(original_name, content_type)
    media_type = ALLOWED_IMAGE_SUFFIXES[suffix]
    label = _label_from_file_name(original_name)
    asset_id = _new_local_asset_id(label)
    stored_name = f"{asset_id}{suffix}"

    files_dir = _files_dir(layout)
    files_dir.mkdir(parents=True, exist_ok=True)
    final_path = _ensure_child(files_dir / stored_name, files_dir)
    temp_path = final_path.with_suffix(f"{final_path.suffix}.tmp")

    byte_count = 0
    try:
        with temp_path.open("wb") as output:
            async for chunk in request.stream():
                if not chunk:
                    continue
                byte_count += len(chunk)
                output.write(chunk)
        if byte_count == 0:
            temp_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Image upload is empty.")
        temp_path.replace(final_path)
    except HTTPException:
        raise
    except OSError as error:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to save character image.",
        ) from error

    record = CharacterAssetRecord(
        id=asset_id,
        label=label,
        fileName=stored_name,
        contentType=media_type,
        createdAt=datetime.now(UTC).isoformat(),
    )
    manifest.customAssets.append(record)
    manifest.views[asset_id] = CharacterViewPayload()
    _save_manifest(layout, manifest)
    return _asset_response(
        layout,
        manifest,
        _visible_assets(layout, manifest),
        asset_id,
    )


def delete_character_asset(layout: RinDataLayout, asset_id: str) -> dict[str, object]:
    """Delete a local asset or hide a bundled default asset in local manifest state."""
    _require_asset_id(asset_id)
    manifest = _load_manifest(layout)
    visible_before = _visible_assets(layout, manifest)
    if len(visible_before) <= 1:
        raise HTTPException(
            status_code=409,
            detail="At least one character image must remain.",
        )

    if asset_id in DEFAULT_ASSET_IDS:
        if asset_id not in manifest.hiddenDefaultIds:
            manifest.hiddenDefaultIds.append(asset_id)
        manifest.views.pop(asset_id, None)
        _save_manifest(layout, manifest)
        return _asset_response(layout, manifest, _visible_assets(layout, manifest))

    record = _find_custom_record(manifest, asset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Character image not found.")

    _asset_file_path(layout, record).unlink(missing_ok=True)
    manifest.customAssets = [
        item for item in manifest.customAssets if item.id != asset_id
    ]
    manifest.views.pop(asset_id, None)
    _save_manifest(layout, manifest)
    return _asset_response(layout, manifest, _visible_assets(layout, manifest))


def restore_character_defaults(layout: RinDataLayout) -> dict[str, object]:
    """Restore bundled default character images hidden by the owner."""
    manifest = _load_manifest(layout)
    manifest.hiddenDefaultIds = []
    _save_manifest(layout, manifest)
    return _asset_response(layout, manifest, _visible_assets(layout, manifest))


def save_character_asset_view(
    layout: RinDataLayout,
    asset_id: str,
    view: CharacterViewPayload,
) -> dict[str, object]:
    """Persist stage transform settings for a known asset."""
    _require_known_asset(layout, asset_id)
    manifest = _load_manifest(layout)
    manifest.views[asset_id] = _normalize_view(view)
    _save_manifest(layout, manifest)
    return _asset_response(
        layout,
        manifest,
        _visible_assets(layout, manifest),
        asset_id,
    )


def reset_character_asset_view(
    layout: RinDataLayout,
    asset_id: str,
) -> dict[str, object]:
    """Remove custom stage transform settings for a known asset."""
    _require_known_asset(layout, asset_id)
    manifest = _load_manifest(layout)
    manifest.views.pop(asset_id, None)
    _save_manifest(layout, manifest)
    return _asset_response(
        layout,
        manifest,
        _visible_assets(layout, manifest),
        asset_id,
    )


def get_character_asset_file(layout: RinDataLayout, asset_id: str) -> tuple[Path, str]:
    """Return the local image path and media type for FileResponse."""
    _require_asset_id(asset_id)
    manifest = _load_manifest(layout)
    record = _find_custom_record(manifest, asset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Character image not found.")
    path = _asset_file_path(layout, record)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Character image file not found.")
    return path, record.contentType


def _asset_response(
    layout: RinDataLayout,
    manifest: CharacterAssetManifest,
    assets: list[CharacterAssetPayload],
    selected_asset_id: str | None = None,
) -> dict[str, object]:
    safe_views = {
        asset_id: view.model_dump(mode="json")
        for asset_id, view in manifest.views.items()
        if _asset_exists(layout, manifest, asset_id)
    }
    return {
        "ok": True,
        "mode": "rin-character-assets",
        "localOnly": True,
        "rawTextIncluded": False,
        "secretValuesIncluded": False,
        "selectedAssetId": selected_asset_id,
        "assets": [asset.model_dump(mode="json") for asset in assets],
        "hiddenDefaultIds": list(dict.fromkeys(manifest.hiddenDefaultIds)),
        "views": safe_views,
    }


def _visible_assets(
    layout: RinDataLayout,
    manifest: CharacterAssetManifest,
) -> list[CharacterAssetPayload]:
    hidden = set(manifest.hiddenDefaultIds)
    default_assets = [
        asset for asset in DEFAULT_CHARACTER_ASSETS if asset.id not in hidden
    ]
    custom_assets = [
        _record_to_asset(record)
        for record in manifest.customAssets
        if _asset_file_path(layout, record).is_file()
    ]
    assets = [*default_assets, *custom_assets]
    return assets if assets else list(DEFAULT_CHARACTER_ASSETS)


def _record_to_asset(record: CharacterAssetRecord) -> CharacterAssetPayload:
    url = f"/api/body/character-assets/files/{record.id}"
    return CharacterAssetPayload(
        id=record.id,
        label=record.label,
        source="local",
        pose=record.pose,
        path=url,
        previewPath=url,
        custom=True,
        stageScale=record.stageScale,
        stageX=record.stageX,
        stageY=record.stageY,
    )


def _asset_exists(
    layout: RinDataLayout,
    manifest: CharacterAssetManifest,
    asset_id: str,
) -> bool:
    if asset_id in DEFAULT_ASSET_IDS:
        return True
    record = _find_custom_record(manifest, asset_id)
    return record is not None and _asset_file_path(layout, record).is_file()


def _root_dir(layout: RinDataLayout) -> Path:
    return layout.rootDir / "body" / "rin" / "characters"


def _files_dir(layout: RinDataLayout) -> Path:
    return _root_dir(layout) / "files"


def _manifest_path(layout: RinDataLayout) -> Path:
    return _root_dir(layout) / "manifest.json"


def _load_manifest(layout: RinDataLayout) -> CharacterAssetManifest:
    path = _manifest_path(layout)
    if not path.exists():
        return CharacterAssetManifest()
    try:
        return CharacterAssetManifest.model_validate(
            json.loads(path.read_text(encoding="utf-8"))
        )
    except (OSError, json.JSONDecodeError, ValidationError) as error:
        raise HTTPException(
            status_code=500,
            detail="Character asset manifest is invalid.",
        ) from error


def _save_manifest(layout: RinDataLayout, manifest: CharacterAssetManifest) -> None:
    path = _manifest_path(layout)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = manifest.model_copy(update={"version": MANIFEST_VERSION}).model_dump(
        mode="json"
    )
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )


def _asset_file_path(layout: RinDataLayout, record: CharacterAssetRecord) -> Path:
    return _ensure_child(_files_dir(layout) / record.fileName, _files_dir(layout))


def _ensure_child(path: Path, parent: Path) -> Path:
    resolved = path.resolve(strict=False)
    resolved_parent = parent.resolve(strict=False)
    if resolved_parent != resolved and resolved_parent not in resolved.parents:
        raise HTTPException(status_code=400, detail="Unsafe character asset path.")
    return resolved


def _uploaded_file_name(request: Request) -> str:
    raw_name = request.headers.get("x-rin-file-name", "rin-character")
    name = Path(unquote(raw_name)).name.strip()
    return name or "rin-character"


def _safe_content_type(request: Request) -> str:
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type in CONTENT_TYPE_SUFFIXES:
        return content_type
    return "application/octet-stream"


def _safe_suffix(file_name: str, content_type: str) -> str:
    suffix = Path(file_name).suffix.lower()
    if suffix in ALLOWED_IMAGE_SUFFIXES:
        return suffix
    if content_type in CONTENT_TYPE_SUFFIXES:
        return CONTENT_TYPE_SUFFIXES[content_type]
    raise HTTPException(
        status_code=400,
        detail="Only PNG, JPG, WEBP, or GIF character images are supported.",
    )


def _label_from_file_name(file_name: str) -> str:
    stem = Path(file_name).stem
    label = SLUG_PART_RE.sub(" ", stem.lower()).strip().upper()
    return (label[:28] or "LOCAL RIN").strip()


def _new_local_asset_id(label: str) -> str:
    slug = SLUG_PART_RE.sub("-", label.lower()).strip("-")[:28] or "rin"
    timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    return f"local-{timestamp}-{slug}-{uuid4().hex[:8]}"


def _require_asset_id(asset_id: str) -> None:
    if not ASSET_ID_RE.fullmatch(asset_id):
        raise HTTPException(status_code=404, detail="Character image not found.")


def _require_known_asset(layout: RinDataLayout, asset_id: str) -> None:
    _require_asset_id(asset_id)
    manifest = _load_manifest(layout)
    if not _asset_exists(layout, manifest, asset_id):
        raise HTTPException(status_code=404, detail="Character image not found.")


def _find_custom_record(
    manifest: CharacterAssetManifest,
    asset_id: str,
) -> CharacterAssetRecord | None:
    return next((item for item in manifest.customAssets if item.id == asset_id), None)


def _normalize_view(view: CharacterViewPayload) -> CharacterViewPayload:
    return CharacterViewPayload(
        x=_clamp(view.x, -420, 420),
        y=_clamp(view.y, -320, 320),
        scale=_clamp(view.scale, 0.45, 2.6),
        cropTop=_clamp(view.cropTop, 0, 36),
        cropRight=_clamp(view.cropRight, 0, 36),
        cropBottom=_clamp(view.cropBottom, 0, 36),
        cropLeft=_clamp(view.cropLeft, 0, 36),
    )


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))
