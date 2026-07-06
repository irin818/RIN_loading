"""Local RIN body state image asset management.

Body states (默认, 生气, 惊讶, 难受, ...) map to state-specific character
images.  Default states ship with the repo under public/body/rin/states/;
custom states uploaded by the owner are stored under the RIN data directory
and merged with the static manifest at runtime.
"""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import cast
from urllib.parse import unquote
from uuid import uuid4

from fastapi import HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from rin.storage import RinDataLayout

ALLOWED_IMAGE_SUFFIXES: dict[str, str] = {
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}
CONTENT_TYPE_SUFFIXES: dict[str, str] = {
    value: key for key, value in ALLOWED_IMAGE_SUFFIXES.items()
}
STATE_ID_RE = re.compile(r"^[a-z0-9\u4e00-\u9fff_-]{1,32}$")
MANIFEST_VERSION = 1
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

STATIC_MANIFEST_PATH = (
    Path(__file__).resolve().parents[4] / "public" / "body" / "rin" / "manifest.json"
)
PUBLIC_BODY_BASE_URL = "/body-assets/rin"
PUBLIC_BODY_MANIFEST_PATH = f"{PUBLIC_BODY_BASE_URL}/manifest.json"
BODY_DATA_SCOPE = ".rin-data/body/rin"
DEFAULT_STATE_ID = "默认"
DEFAULT_STATES: tuple[str, ...] = ("默认", "生气", "惊讶", "难受")


class BodyStateRecord(BaseModel):
    """Single state entry in the writable manifest."""

    model_config = ConfigDict(extra="forbid")

    stateId: str  # e.g. "默认" or "custom-xxx"
    label: str
    fileName: str
    contentType: str
    custom: bool = False
    createdAt: str | None = None


class BodyStateManifest(BaseModel):
    """Writable manifest persisted under .rin-data/body/rin/."""

    model_config = ConfigDict(extra="ignore")

    version: int = MANIFEST_VERSION
    customStates: list[BodyStateRecord] = Field(default_factory=list)
    hiddenDefaultIds: list[str] = Field(default_factory=list)


class BodyStatePayload(BaseModel):
    """Display-safe body state metadata returned to the UI."""

    model_config = ConfigDict(extra="forbid")

    stateId: str
    label: str
    imageUrl: str
    custom: bool = False


class BodyCurrentStateBody(BaseModel):
    """Request body for PUT /api/body/current-state."""

    model_config = ConfigDict(extra="forbid")

    stateId: str


def _current_state_path(layout: RinDataLayout) -> Path:
    return layout.rootDir / "body" / "rin" / "current-state.txt"


def _data_states_dir(layout: RinDataLayout) -> Path:
    return layout.rootDir / "body" / "rin" / "states"


def _data_manifest_path(layout: RinDataLayout) -> Path:
    return layout.rootDir / "body" / "rin" / "state-manifest.json"


def _load_data_manifest(layout: RinDataLayout) -> BodyStateManifest:
    path = _data_manifest_path(layout)
    if not path.exists():
        return BodyStateManifest()
    try:
        return BodyStateManifest.model_validate(json.loads(path.read_text("utf-8")))
    except (OSError, json.JSONDecodeError, ValidationError) as e:
        raise HTTPException(
            status_code=500,
            detail="Body state manifest is invalid.",
        ) from e


def _save_data_manifest(layout: RinDataLayout, manifest: BodyStateManifest) -> None:
    path = _data_manifest_path(layout)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = manifest.model_copy(update={"version": MANIFEST_VERSION}).model_dump(
        mode="json"
    )
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _load_static_manifest() -> dict[str, object]:
    try:
        raw: object = json.loads(STATIC_MANIFEST_PATH.read_text("utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"states": {}}
    if isinstance(raw, dict):
        return cast(dict[str, object], raw)
    return {"states": {}}


def _static_state_entries() -> list[tuple[str, dict[str, object]]]:
    raw = _load_static_manifest()
    states = raw.get("states", {})
    if isinstance(states, dict):
        return [
            (state_id, entry)
            for state_id, entry in states.items()
            if isinstance(state_id, str) and isinstance(entry, dict)
        ]
    return [
        (state_id, {"label": state_id, "image": f"states/{state_id}.png"})
        for state_id in DEFAULT_STATES
    ]


def _static_state_ids() -> set[str]:
    return {state_id for state_id, _entry in _static_state_entries()}


def _static_image_url(state_id: str, entry: dict[str, object]) -> str:
    image = entry.get("image")
    if (
        not isinstance(image, str)
        or not image
        or image.startswith("/")
        or "://" in image
    ):
        image = f"states/{state_id}.png"
    return f"{PUBLIC_BODY_BASE_URL}/{image.lstrip('/')}"


def _visible_state_ids(
    layout: RinDataLayout,
    manifest: BodyStateManifest,
) -> list[str]:
    hidden = set(manifest.hiddenDefaultIds)
    state_ids = [
        state_id
        for state_id, _entry in _static_state_entries()
        if state_id not in hidden
    ]
    state_ids.extend(
        rec.stateId
        for rec in manifest.customStates
        if (_data_states_dir(layout) / rec.fileName).is_file()
    )
    return list(dict.fromkeys(state_ids))


def list_available_body_state_ids(layout: RinDataLayout) -> list[str]:
    """Return visible static and custom body state ids in UI order."""
    manifest = _load_data_manifest(layout)
    visible = _visible_state_ids(layout, manifest)
    return visible if visible else [DEFAULT_STATE_ID]


def _fallback_state_id(
    layout: RinDataLayout,
    manifest: BodyStateManifest | None = None,
) -> str:
    visible = _visible_state_ids(layout, manifest or _load_data_manifest(layout))
    return visible[0] if visible else DEFAULT_STATE_ID


def _write_current_state_unchecked(layout: RinDataLayout, state_id: str) -> None:
    path = _current_state_path(layout)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(state_id.strip(), encoding="utf-8")


def read_current_state(layout: RinDataLayout) -> str:
    """Read the persisted current body state, falling back to a visible state."""
    path = _current_state_path(layout)
    value = ""
    if path.exists():
        try:
            value = path.read_text("utf-8").strip()
        except OSError:
            value = ""

    manifest = _load_data_manifest(layout)
    if value and value in _visible_state_ids(layout, manifest):
        return value
    return _fallback_state_id(layout, manifest)


def write_current_state(layout: RinDataLayout, state_id: str) -> None:
    """Persist the current body state after validating that it is visible."""
    normalized = state_id.strip()
    if not STATE_ID_RE.fullmatch(normalized):
        raise HTTPException(status_code=404, detail="Body state not found.")
    manifest = _load_data_manifest(layout)
    if normalized not in _visible_state_ids(layout, manifest):
        raise HTTPException(status_code=404, detail="Body state not found.")
    _write_current_state_unchecked(layout, normalized)


def list_body_states(layout: RinDataLayout) -> dict[str, object]:
    """Return merged list of static + custom body states."""
    data_manifest = _load_data_manifest(layout)
    hidden = set(data_manifest.hiddenDefaultIds)

    payloads: list[BodyStatePayload] = []

    for state_id, entry in _static_state_entries():
        if state_id not in hidden:
            label = entry.get("label", state_id)
            payloads.append(
                BodyStatePayload(
                    stateId=state_id,
                    label=str(label),
                    imageUrl=_static_image_url(state_id, entry),
                    custom=False,
                )
            )

    for rec in data_manifest.customStates:
        if not (_data_states_dir(layout) / rec.fileName).is_file():
            continue
        url = f"/api/body/state-assets/files/{rec.stateId}"
        payloads.append(
            BodyStatePayload(
                stateId=rec.stateId,
                label=rec.label,
                imageUrl=url,
                custom=True,
            )
        )

    return {
        "ok": True,
        "mode": "rin-body-states",
        "localOnly": True,
        "rawTextIncluded": False,
        "secretValuesIncluded": False,
        "storageScope": BODY_DATA_SCOPE,
        "absolutePathIncluded": False,
        "currentState": read_current_state(layout),
        "defaultStateIds": list(DEFAULT_STATES),
        "states": [p.model_dump(mode="json") for p in payloads],
    }


def _decoded_header(request: Request, name: str) -> str:
    raw = request.headers.get(name, "")
    try:
        return unquote(raw.strip())
    except ValueError:
        return raw.strip()


def _upload_suffix_and_media_type(request: Request) -> tuple[str, str]:
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type in CONTENT_TYPE_SUFFIXES:
        suffix = CONTENT_TYPE_SUFFIXES[content_type]
        return suffix, ALLOWED_IMAGE_SUFFIXES[suffix]

    original_name = _decoded_header(request, "x-rin-file-name")
    suffix = Path(original_name).suffix.lower()
    if suffix in ALLOWED_IMAGE_SUFFIXES:
        return suffix, ALLOWED_IMAGE_SUFFIXES[suffix]

    raise HTTPException(
        status_code=400,
        detail="Only PNG, JPG, WEBP, or GIF images are supported.",
    )


async def store_uploaded_body_state(
    layout: RinDataLayout,
    request: Request,
) -> dict[str, object]:
    """Persist an uploaded body state image under the RIN data directory."""
    data_manifest = _load_data_manifest(layout)

    raw_label = _decoded_header(request, "x-rin-state-label")
    label = (raw_label or "CUSTOM")[:40]
    suffix, media_type = _upload_suffix_and_media_type(request)

    state_id = f"custom-{uuid4().hex[:10]}"
    stored_name = f"{state_id}{suffix}"

    states_dir = _data_states_dir(layout)
    states_dir.mkdir(parents=True, exist_ok=True)
    final_path = states_dir / stored_name
    temp_path = final_path.with_suffix(f"{final_path.suffix}.tmp")

    byte_count = 0
    try:
        with temp_path.open("wb") as out:
            async for chunk in request.stream():
                if not chunk:
                    continue
                byte_count += len(chunk)
                if byte_count > MAX_UPLOAD_BYTES:
                    temp_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail="Image upload is too large.",
                    )
                out.write(chunk)
        if byte_count == 0:
            temp_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Image upload is empty.")
        temp_path.replace(final_path)
    except HTTPException:
        raise
    except OSError as e:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to save state image.",
        ) from e

    record = BodyStateRecord(
        stateId=state_id,
        label=label,
        fileName=stored_name,
        contentType=media_type,
        custom=True,
        createdAt=datetime.now(UTC).isoformat(),
    )
    data_manifest.customStates.append(record)
    _save_data_manifest(layout, data_manifest)
    _write_current_state_unchecked(layout, state_id)
    response = list_body_states(layout)
    response["selectedStateId"] = state_id
    return response


def delete_body_state(layout: RinDataLayout, state_id: str) -> dict[str, object]:
    """Delete a custom body state or hide a default state."""
    if not STATE_ID_RE.fullmatch(state_id):
        raise HTTPException(status_code=404, detail="Body state not found.")

    data_manifest = _load_data_manifest(layout)
    current_before = read_current_state(layout)
    visible_before = _visible_state_ids(layout, data_manifest)
    if len(visible_before) <= 1:
        raise HTTPException(
            status_code=409,
            detail="At least one body state must remain.",
        )

    if state_id in _static_state_ids():
        if state_id not in data_manifest.hiddenDefaultIds:
            data_manifest.hiddenDefaultIds.append(state_id)
        _save_data_manifest(layout, data_manifest)
        if current_before == state_id:
            _write_current_state_unchecked(layout, _fallback_state_id(layout))
        return list_body_states(layout)

    for i, rec in enumerate(data_manifest.customStates):
        if rec.stateId == state_id:
            file_path = _data_states_dir(layout) / rec.fileName
            file_path.unlink(missing_ok=True)
            data_manifest.customStates.pop(i)
            _save_data_manifest(layout, data_manifest)
            if current_before == state_id:
                _write_current_state_unchecked(layout, _fallback_state_id(layout))
            return list_body_states(layout)

    raise HTTPException(status_code=404, detail="Body state not found.")


def restore_default_states(layout: RinDataLayout) -> dict[str, object]:
    """Restore all hidden default body states."""
    data_manifest = _load_data_manifest(layout)
    data_manifest.hiddenDefaultIds = []
    _save_data_manifest(layout, data_manifest)
    _write_current_state_unchecked(layout, read_current_state(layout))
    return list_body_states(layout)


def get_body_state_file(layout: RinDataLayout, state_id: str) -> tuple[Path, str]:
    """Return the local image path and media type for FileResponse."""
    if not STATE_ID_RE.fullmatch(state_id):
        raise HTTPException(status_code=404, detail="Body state not found.")

    data_manifest = _load_data_manifest(layout)

    for rec in data_manifest.customStates:
        if rec.stateId == state_id:
            path = _data_states_dir(layout) / rec.fileName
            if path.is_file():
                return path, rec.contentType
            raise HTTPException(status_code=404, detail="State image file not found.")

    raise HTTPException(status_code=404, detail="Body state not found.")
