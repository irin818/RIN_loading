"""Local RIN Archive asset management — creative memory gallery backend.

Follows the same patterns as character_assets.py but for the archive/portfolio
content domain. Separate from body/character assets, memory, model, and policy.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, cast
from urllib.parse import unquote
from uuid import uuid4

from fastapi import HTTPException, Request
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from rin.diagnostics.safety import assert_safe_python_write_data_dir
from rin.storage import RinDataLayout

# ── Constants ──

ArchiveAssetType = Literal[
    "illustration",
    "comic",
    "comic-page",
    "story",
    "character-file",
    "worldbuilding",
    "live2d-asset",
    "wallpaper",
    "avatar",
    "reference",
]

ArchiveAssetStatus = Literal["draft", "published", "archived"]

ASSET_ID_RE = re.compile(r"^arc-[a-z0-9-]+$")
SLUG_PART_RE = re.compile(r"[^a-z0-9]+")
ALLOWED_IMAGE_SUFFIXES: dict[str, str] = {
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}
ALLOWED_TEXT_SUFFIXES: dict[str, str] = {
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".json": "application/json",
}
CONTENT_TYPE_SUFFIXES: dict[str, str] = {
    value: key for key, value in ALLOWED_IMAGE_SUFFIXES.items()
}
IMAGE_FORMAT_SUFFIXES: dict[str, str] = {
    "GIF": ".gif",
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}
IMAGE_FORMAT_CONTENT_TYPES: dict[str, str] = {
    "GIF": "image/gif",
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}
MANIFEST_VERSION = 1
PREVIEW_MAX_DIMENSION = 2000
THUMBNAIL_MAX_DIMENSION = 512

VALID_ASSET_TYPES: set[str] = {
    "illustration",
    "comic",
    "comic-page",
    "story",
    "character-file",
    "worldbuilding",
    "live2d-asset",
    "wallpaper",
    "avatar",
    "reference",
}
VALID_STATUSES: set[str] = {"draft", "published", "archived"}


@dataclass(frozen=True)
class ArchiveImageInfo:
    """Dimensions detected from an uploaded archive image."""

    width: int
    height: int
    suffix: str
    content_type: str


@dataclass(frozen=True)
class ArchiveDerivativePaths:
    """Relative paths for generated or fallback archive display files."""

    preview_path: str
    thumbnail_path: str


# ── Pydantic Models ──


class ArchiveAssetPatchBody(BaseModel):
    """Safe editable metadata fields for an archive asset."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    category: str | None = None
    type: ArchiveAssetType | None = None  # noqa: A003
    status: ArchiveAssetStatus | None = None
    sortOrder: int | None = None
    seriesId: str | None = None
    chapterId: str | None = None
    pageNumber: int | None = None
    coverAssetId: str | None = None


class ArchiveStoryContentBody(BaseModel):
    """Story content update payload."""

    model_config = ConfigDict(extra="forbid")

    content: str


class ArchiveAssetRecord(BaseModel):
    """Manifest record for an archive asset."""

    model_config = ConfigDict(extra="forbid")

    id: str
    type: ArchiveAssetType  # noqa: A003
    title: str
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    category: str = ""
    status: ArchiveAssetStatus = "draft"
    fileName: str
    contentType: str
    originalPath: str = ""
    previewPath: str = ""
    thumbnailPath: str = ""
    width: int | None = None
    height: int | None = None
    fileSize: int | None = None
    createdAt: str
    updatedAt: str
    sortOrder: int = 0
    seriesId: str | None = None
    chapterId: str | None = None
    pageNumber: int | None = None
    storyContent: str | None = None
    storyMarkdownFile: str | None = None
    coverAssetId: str | None = None


class ArchiveManifest(BaseModel):
    """Local manifest persisted under the RIN data directory."""

    model_config = ConfigDict(extra="ignore")

    version: int = MANIFEST_VERSION
    assets: list[ArchiveAssetRecord] = Field(default_factory=list)


# ── Public API ──


def list_archive_assets(
    layout: RinDataLayout,
    *,
    asset_type: str | None = None,
    status: str | None = None,
    tag: str | None = None,
    category: str | None = None,
    q: str | None = None,
    series_id: str | None = None,
    limit: int | None = None,
) -> dict[str, object]:
    """Return display-safe archive asset metadata."""
    manifest = _load_manifest(layout)
    assets = _visible_assets(layout, manifest)

    # Exclude archived assets by default unless status filter explicitly includes them
    if not status:
        assets = [a for a in assets if a.status != "archived"]

    asset_types = _asset_type_filter(asset_type)
    if asset_types is not None:
        assets = [a for a in assets if a.type in asset_types]
    if status:
        assets = [a for a in assets if a.status == status]
    if tag:
        assets = [a for a in assets if tag in a.tags]
    if category:
        assets = [a for a in assets if a.category == category]
    if series_id:
        assets = [a for a in assets if a.seriesId == series_id]
    if q:
        query = q.lower()
        assets = [
            a
            for a in assets
            if query in a.title.lower()
            or query in a.description.lower()
            or any(query in t.lower() for t in a.tags)
        ]

    # Sort by sortOrder then createdAt descending
    assets.sort(key=lambda a: (a.sortOrder, a.createdAt), reverse=True)

    if limit is not None:
        assets = assets[: max(1, min(limit, 200))]

    return {
        "ok": True,
        "mode": "rin-archive-assets",
        "localOnly": True,
        "rawTextIncluded": False,
        "secretValuesIncluded": False,
        "assets": [_asset_to_display(a) for a in assets],
        "total": len(assets),
    }


async def store_uploaded_archive_asset(
    layout: RinDataLayout,
    request: Request,
) -> dict[str, object]:
    """Persist an uploaded file as an archive asset."""
    _reject_unsafe(layout)
    manifest = _load_manifest(layout)

    original_name = _uploaded_file_name(request)
    content_type = _safe_content_type(request)
    _require_supported_image_hint(original_name, content_type)

    metadata = _parse_upload_metadata(request)
    asset_type = _validate_asset_type(metadata.get("type", "illustration"))
    title_raw = metadata.get("title")
    title = str(title_raw) if title_raw else _label_from_file_name(original_name)
    description = str(metadata.get("description", ""))
    tags_raw = metadata.get("tags", [])
    if isinstance(tags_raw, str):
        tags = [t.strip() for t in tags_raw.split(",") if t.strip()]
    elif isinstance(tags_raw, list):
        tags = [str(t) for t in tags_raw]
    else:
        tags = []
    category = str(metadata.get("category", ""))
    series_id_raw = metadata.get("seriesId")
    series_id = str(series_id_raw) if series_id_raw else None
    page_number_raw = metadata.get("pageNumber")
    sort_order_raw = metadata.get("sortOrder", 0)

    asset_id = _new_asset_id(title)
    now = datetime.now(UTC).isoformat()

    originals_dir = _originals_dir(layout)
    originals_dir.mkdir(parents=True, exist_ok=True)
    temp_path = _ensure_child(originals_dir / f"{asset_id}.upload.tmp", originals_dir)
    final_path: Path | None = None
    stored_name = ""

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
            raise HTTPException(status_code=400, detail="Upload is empty.")
        image_info = _inspect_uploaded_image(temp_path)
        stored_name = f"{asset_id}{image_info.suffix}"
        final_path = _ensure_child(originals_dir / stored_name, originals_dir)
        temp_path.replace(final_path)
    except HTTPException:
        temp_path.unlink(missing_ok=True)
        raise
    except Exception as error:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to save archive asset file.",
        ) from error

    assert final_path is not None
    derivatives = _generate_archive_derivatives(
        layout,
        original_path=final_path,
        stored_name=stored_name,
        suffix=image_info.suffix,
    )
    page_number: int | None = None
    if page_number_raw is not None:
        try:
            page_number = int(str(page_number_raw))
        except (ValueError, TypeError):
            page_number = None
    sort_order: int = 0
    if sort_order_raw is not None:
        try:
            sort_order = int(str(sort_order_raw))
        except (ValueError, TypeError):
            sort_order = 0
    record = ArchiveAssetRecord(
        id=asset_id,
        type=asset_type,
        title=title,
        description=description,
        tags=tags,
        category=category,
        status="draft",
        fileName=stored_name,
        contentType=image_info.content_type,
        originalPath=str(final_path.relative_to(layout.rootDir)),
        previewPath=derivatives.preview_path,
        thumbnailPath=derivatives.thumbnail_path,
        width=image_info.width,
        height=image_info.height,
        fileSize=final_path.stat().st_size,
        createdAt=now,
        updatedAt=now,
        sortOrder=sort_order,
        seriesId=series_id,
        pageNumber=page_number,
    )
    manifest.assets.append(record)
    _save_manifest(layout, manifest)
    return list_archive_assets(layout)


def patch_archive_asset(
    layout: RinDataLayout,
    asset_id: str,
    patch: ArchiveAssetPatchBody,
) -> dict[str, object]:
    """Update safe metadata fields for an archive asset."""
    _reject_unsafe(layout)
    _require_asset_id(asset_id)
    manifest = _load_manifest(layout)
    record = _find_record(manifest, asset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Archive asset not found.")

    updates: dict[str, object] = {}
    patch_data = patch.model_dump(exclude_unset=True)

    if "type" in patch_data and patch_data["type"] not in VALID_ASSET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid asset type.")
    if "status" in patch_data and patch_data["status"] not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status.")

    for field in (
        "title",
        "description",
        "tags",
        "category",
        "type",
        "status",
        "sortOrder",
        "seriesId",
        "chapterId",
        "pageNumber",
        "coverAssetId",
    ):
        if field in patch_data:
            updates[field] = patch_data[field]

    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update.")

    for key, value in updates.items():
        setattr(record, key, value)
    record.updatedAt = datetime.now(UTC).isoformat()
    _save_manifest(layout, manifest)
    return list_archive_assets(layout)


def delete_archive_asset(
    layout: RinDataLayout,
    asset_id: str,
    *,
    hard: bool = False,
) -> dict[str, object]:
    """Archive (soft) or permanently delete (hard) an asset."""
    _reject_unsafe(layout)
    _require_asset_id(asset_id)
    manifest = _load_manifest(layout)
    record = _find_record(manifest, asset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Archive asset not found.")

    if hard:
        delete_paths = _archive_asset_delete_paths(layout, record)
        for path in delete_paths:
            path.unlink(missing_ok=True)
        manifest.assets = [a for a in manifest.assets if a.id != asset_id]
    else:
        # Soft archive — mark status as archived
        record.status = "archived"
        record.updatedAt = datetime.now(UTC).isoformat()

    _save_manifest(layout, manifest)
    return list_archive_assets(layout)


def get_archive_asset_file(
    layout: RinDataLayout,
    asset_id: str,
) -> tuple[Path, str]:
    """Return the original file path and media type for FileResponse."""
    _require_asset_id(asset_id)
    manifest = _load_manifest(layout)
    record = _find_record(manifest, asset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Archive asset not found.")
    path = _resolve_asset_path(layout, record)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Archive asset file not found.")
    return path, record.contentType


def get_archive_asset_preview_file(
    layout: RinDataLayout,
    asset_id: str,
) -> tuple[Path, str]:
    """Return the preview file, falling back to original when unavailable."""
    _require_asset_id(asset_id)
    manifest = _load_manifest(layout)
    record = _find_record(manifest, asset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Archive asset not found.")
    path = _resolve_display_path(layout, record.previewPath)
    if path is not None and path.is_file():
        return path, record.contentType
    return get_archive_asset_file(layout, asset_id)


def get_archive_asset_thumbnail_file(
    layout: RinDataLayout,
    asset_id: str,
) -> tuple[Path, str]:
    """Return the thumbnail file, falling back to preview/original."""
    _require_asset_id(asset_id)
    manifest = _load_manifest(layout)
    record = _find_record(manifest, asset_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Archive asset not found.")
    path = _resolve_display_path(layout, record.thumbnailPath)
    if path is not None and path.is_file():
        return path, record.contentType
    return get_archive_asset_preview_file(layout, asset_id)


def get_archive_story(
    layout: RinDataLayout,
    story_id: str,
) -> dict[str, object]:
    """Return a single story asset with safe content."""
    _require_asset_id(story_id)
    manifest = _load_manifest(layout)
    record = _find_record(manifest, story_id)
    if record is None or record.type != "story":
        raise HTTPException(status_code=404, detail="Story not found.")
    return _asset_to_display(record, include_content=True)


def save_archive_story(
    layout: RinDataLayout,
    story_id: str,
    body: ArchiveStoryContentBody,
) -> dict[str, object]:
    """Save story text content."""
    _reject_unsafe(layout)
    _require_asset_id(story_id)
    manifest = _load_manifest(layout)
    record = _find_record(manifest, story_id)
    if record is None or record.type != "story":
        raise HTTPException(status_code=404, detail="Story not found.")
    record.storyContent = body.content
    record.updatedAt = datetime.now(UTC).isoformat()
    _save_manifest(layout, manifest)
    return _asset_to_display(record, include_content=True)


# ── Helpers ──


def _root_dir(layout: RinDataLayout) -> Path:
    return layout.rootDir / "archive"


def _originals_dir(layout: RinDataLayout) -> Path:
    return _root_dir(layout) / "files" / "originals"


def _previews_dir(layout: RinDataLayout) -> Path:
    return _root_dir(layout) / "files" / "previews"


def _thumbnails_dir(layout: RinDataLayout) -> Path:
    return _root_dir(layout) / "files" / "thumbnails"


def _stories_dir(layout: RinDataLayout) -> Path:
    return _root_dir(layout) / "stories"


def _manifest_path(layout: RinDataLayout) -> Path:
    return _root_dir(layout) / "manifest.json"


def _load_manifest(layout: RinDataLayout) -> ArchiveManifest:
    path = _manifest_path(layout)
    if not path.exists():
        return ArchiveManifest()
    try:
        return ArchiveManifest.model_validate(
            json.loads(path.read_text(encoding="utf-8"))
        )
    except (OSError, json.JSONDecodeError, ValidationError) as error:
        raise HTTPException(
            status_code=500,
            detail="Archive manifest is invalid.",
        ) from error


def _save_manifest(layout: RinDataLayout, manifest: ArchiveManifest) -> None:
    path = _manifest_path(layout)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = manifest.model_copy(update={"version": MANIFEST_VERSION}).model_dump(
        mode="json"
    )
    text = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
    temp_path = path.with_suffix(".tmp")
    temp_path.write_text(text, encoding="utf-8")
    temp_path.replace(path)


def _resolve_asset_path(layout: RinDataLayout, record: ArchiveAssetRecord) -> Path:
    originals = _originals_dir(layout)
    return _ensure_child(originals / record.fileName, originals)


def _archive_asset_delete_paths(
    layout: RinDataLayout,
    record: ArchiveAssetRecord,
) -> list[Path]:
    paths = [_resolve_asset_path(layout, record)]
    for relative in (record.previewPath, record.thumbnailPath):
        path = _resolve_display_path(layout, relative)
        if path is not None and path not in paths:
            paths.append(path)
    return paths


def _resolve_path(layout: RinDataLayout, relative: str) -> Path:
    return _ensure_child(layout.rootDir / relative, layout.rootDir)


def _resolve_display_path(layout: RinDataLayout, relative: str) -> Path | None:
    if not relative:
        return None
    return _resolve_path(layout, relative)


def _ensure_child(path: Path, parent: Path) -> Path:
    resolved = path.resolve(strict=False)
    resolved_parent = parent.resolve(strict=False)
    if resolved_parent != resolved and resolved_parent not in resolved.parents:
        raise HTTPException(status_code=400, detail="Unsafe archive asset path.")
    return resolved


def _visible_assets(
    layout: RinDataLayout,
    manifest: ArchiveManifest,
) -> list[ArchiveAssetRecord]:
    records: list[ArchiveAssetRecord] = []
    for record in manifest.assets:
        path = _resolve_asset_path(layout, record)
        if path.is_file():
            records.append(record)
    return records


def _find_record(
    manifest: ArchiveManifest,
    asset_id: str,
) -> ArchiveAssetRecord | None:
    return next((a for a in manifest.assets if a.id == asset_id), None)


def _asset_to_display(
    record: ArchiveAssetRecord,
    *,
    include_content: bool = False,
) -> dict[str, object]:
    result: dict[str, object] = {
        "id": record.id,
        "type": record.type,
        "title": record.title,
        "description": record.description,
        "tags": record.tags,
        "category": record.category,
        "status": record.status,
        "fileName": record.fileName,
        "contentType": record.contentType,
        "originalPath": f"/api/archive/assets/files/{record.id}",
        "previewPath": f"/api/archive/assets/previews/{record.id}",
        "thumbnailPath": f"/api/archive/assets/thumbnails/{record.id}",
        "width": record.width,
        "height": record.height,
        "fileSize": record.fileSize,
        "createdAt": record.createdAt,
        "updatedAt": record.updatedAt,
        "sortOrder": record.sortOrder,
        "seriesId": record.seriesId,
        "chapterId": record.chapterId,
        "pageNumber": record.pageNumber,
        "storyContent": record.storyContent if include_content else None,
        "storyMarkdownFile": record.storyMarkdownFile,
        "coverAssetId": record.coverAssetId,
    }
    return result


def _uploaded_file_name(request: Request) -> str:
    raw_name = request.headers.get("x-rin-file-name", "archive-asset")
    name = Path(unquote(raw_name)).name.strip()
    return name or "archive-asset"


def _safe_content_type(request: Request) -> str:
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type in CONTENT_TYPE_SUFFIXES:
        return content_type
    return "application/octet-stream"


def _safe_image_suffix(file_name: str, content_type: str) -> str:
    suffix = Path(file_name).suffix.lower()
    if suffix in ALLOWED_IMAGE_SUFFIXES:
        return suffix
    if content_type in CONTENT_TYPE_SUFFIXES:
        return CONTENT_TYPE_SUFFIXES[content_type]
    raise HTTPException(
        status_code=400,
        detail="Only PNG, JPG, WEBP, or GIF images are supported.",
    )


def _require_supported_image_hint(file_name: str, content_type: str) -> None:
    _safe_image_suffix(file_name, content_type)


def _inspect_uploaded_image(path: Path) -> ArchiveImageInfo:
    try:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            format_name = str(image.format or "").upper()
            if format_name not in IMAGE_FORMAT_SUFFIXES:
                raise UnidentifiedImageError
            return ArchiveImageInfo(
                width=image.width,
                height=image.height,
                suffix=IMAGE_FORMAT_SUFFIXES[format_name],
                content_type=IMAGE_FORMAT_CONTENT_TYPES[format_name],
            )
    except (UnidentifiedImageError, OSError) as error:
        path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail="Unsupported or unreadable image file.",
        ) from error


def _generate_archive_derivatives(
    layout: RinDataLayout,
    *,
    original_path: Path,
    stored_name: str,
    suffix: str,
) -> ArchiveDerivativePaths:
    original_relative = str(original_path.relative_to(layout.rootDir))

    if suffix == ".gif":
        return ArchiveDerivativePaths(
            preview_path=original_relative,
            thumbnail_path=original_relative,
        )

    previews_dir = _previews_dir(layout)
    thumbnails_dir = _thumbnails_dir(layout)
    previews_dir.mkdir(parents=True, exist_ok=True)
    thumbnails_dir.mkdir(parents=True, exist_ok=True)

    preview_path = _ensure_child(previews_dir / stored_name, previews_dir)
    thumbnail_path = _ensure_child(thumbnails_dir / stored_name, thumbnails_dir)

    preview_generated = _create_resized_archive_image(
        original_path,
        preview_path,
        max_dimension=PREVIEW_MAX_DIMENSION,
        suffix=suffix,
    )
    thumbnail_generated = _create_resized_archive_image(
        original_path,
        thumbnail_path,
        max_dimension=THUMBNAIL_MAX_DIMENSION,
        suffix=suffix,
    )

    preview_relative = (
        str(preview_path.relative_to(layout.rootDir))
        if preview_generated
        else original_relative
    )
    thumbnail_relative = (
        str(thumbnail_path.relative_to(layout.rootDir))
        if thumbnail_generated
        else preview_relative
    )
    return ArchiveDerivativePaths(
        preview_path=preview_relative,
        thumbnail_path=thumbnail_relative,
    )


def _create_resized_archive_image(
    original_path: Path,
    target_path: Path,
    *,
    max_dimension: int,
    suffix: str,
) -> bool:
    try:
        with Image.open(original_path) as source:
            image = ImageOps.exif_transpose(source)
            try:
                image.thumbnail(
                    (max_dimension, max_dimension),
                    Image.Resampling.LANCZOS,
                )
                output = _image_for_save(image, suffix)
                try:
                    output.save(
                        target_path,
                        format=_image_format_for_suffix(suffix),
                    )
                finally:
                    if output is not image:
                        output.close()
            finally:
                if image is not source:
                    image.close()
        return True
    except (OSError, ValueError, UnidentifiedImageError):
        target_path.unlink(missing_ok=True)
        return False


def _image_for_save(image: Image.Image, suffix: str) -> Image.Image:
    if suffix in {".jpg", ".jpeg"} and image.mode not in {"RGB", "L"}:
        return image.convert("RGB")
    if suffix in {".png", ".webp"} and image.mode == "CMYK":
        return image.convert("RGB")
    return image


def _image_format_for_suffix(suffix: str) -> str:
    if suffix in {".jpg", ".jpeg"}:
        return "JPEG"
    if suffix == ".webp":
        return "WEBP"
    return "PNG"


def _parse_upload_metadata(request: Request) -> dict[str, object]:
    raw = request.headers.get("x-rin-metadata", "{}")
    try:
        result: dict[str, object] = json.loads(unquote(raw))
        return result
    except (json.JSONDecodeError, ValueError):
        return {}


def _asset_type_filter(value: str | None) -> set[ArchiveAssetType] | None:
    if not value:
        return None
    selected = {
        cast(ArchiveAssetType, part)
        for part in (item.strip() for item in value.split(","))
        if part in VALID_ASSET_TYPES
    }
    return selected or set()


def _validate_asset_type(value: object) -> ArchiveAssetType:
    if isinstance(value, str) and value in VALID_ASSET_TYPES:
        return cast(ArchiveAssetType, value)
    return "illustration"


def _label_from_file_name(file_name: str) -> str:
    stem = Path(file_name).stem
    label = SLUG_PART_RE.sub(" ", stem.lower()).strip()
    return (label[:48] or "Archive Asset").strip()


def _new_asset_id(label: str) -> str:
    slug = SLUG_PART_RE.sub("-", label.lower()).strip("-")[:28] or "asset"
    timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    return f"arc-{timestamp}-{slug}-{uuid4().hex[:8]}"


def _require_asset_id(asset_id: str) -> None:
    if not ASSET_ID_RE.fullmatch(asset_id):
        raise HTTPException(status_code=404, detail="Archive asset not found.")


def _reject_unsafe(layout: RinDataLayout) -> None:
    """Reject operations on non-production data directories."""
    assert_safe_python_write_data_dir(str(layout.rootDir))
