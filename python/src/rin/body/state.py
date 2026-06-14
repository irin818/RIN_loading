"""Body/embodiment state and Live2D asset status helpers."""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

MouthSync = Literal["idle", "speaking"]
BodyActivity = Literal[
    "idle",
    "thinking",
    "speaking",
    "listening",
    "memory",
    "warning",
    "error",
    "sleeping",
    "reviewing",
]
ModelAvailability = Literal["available", "missing", "invalid", "partial", "fallback"]

STANDARD_MODEL_URL = "/live2d/rin/rin.model3.json"
STANDARD_MODEL_RELATIVE_PATH = "rin/rin.model3.json"
FALLBACK_ASSET_FILES = {
    "bustFront": "rin-bust-front.png",
    "frontFullBody": "rin-front-fullbody.png",
    "frontBodyNoTail": "rin-front-body-no-tail.png",
    "tailLarge": "rin-tail-large.png",
    "foxMask": "rin-fox-mask.png",
    "ponytail": "rin-ponytail.png",
    "earPair": "rin-ear-pair.png",
    "eyesDetail": "rin-eyes-detail.png",
    "mouthSet": "rin-mouth-set.png",
}


@dataclass(frozen=True)
class BodyState:
    """Current body/avatar state: emotion, expression, motion, voice, attention."""

    emotion: str
    expression: str
    motion: str
    voiceStyle: str
    mouthSync: MouthSync
    idleBehavior: str
    attention: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True)
class BodyReport:
    """
    Report on the body adapter: placeholder status, what's stored in-body vs. in RIN
    core.
    """

    mode: str
    status: str
    adapterId: str
    adapterKind: str
    bodyState: BodyState
    bodyReplaceable: bool
    identityStoredInBody: bool
    memoryStoredInBody: bool
    policyStoredInBody: bool
    providerCallCount: int
    fullTextIncluded: bool

    def to_dict(self) -> dict[str, object]:
        payload = asdict(self)
        payload["bodyState"] = self.bodyState.to_dict()
        return payload


def build_body_report() -> BodyReport:
    """Build a placeholder body report (no real avatar/robot connected yet)."""
    return BodyReport(
        mode="body-state-report",
        status="ready",
        adapterId="rin-python-placeholder-body",
        adapterKind="placeholder",
        bodyState=BodyState(
            emotion="calm",
            expression="neutral",
            motion="idle-breathing",
            voiceStyle="soft",
            mouthSync="idle",
            idleBehavior="calm-idle",
            attention="idle",
        ),
        bodyReplaceable=True,
        identityStoredInBody=False,
        memoryStoredInBody=False,
        policyStoredInBody=False,
        providerCallCount=0,
        fullTextIncluded=False,
    )


def build_live2d_model_status(live2d_root: Path) -> dict[str, object]:
    """Inspect local Live2D runtime assets without requiring a Cubism SDK."""
    rin_root = live2d_root / "rin"
    standard_model = live2d_root / STANDARD_MODEL_RELATIVE_PATH
    runtime_manifest = rin_root / "rin-runtime-manifest.json"
    asset_model = rin_root / "rin-asset-model.json"
    fallback_assets = {
        key: f"/live2d/rin/{filename}"
        for key, filename in FALLBACK_ASSET_FILES.items()
        if (rin_root / filename).is_file()
    }
    cubism_models = sorted((rin_root / "cubism").glob("*/*.model3.json"))
    cubism_model_url = (
        f"/live2d/rin/cubism/{cubism_models[0].parent.name}/{cubism_models[0].name}"
        if cubism_models
        else None
    )
    model_validation = validate_model3_json(standard_model, rin_root)
    fallback_available = "bustFront" in fallback_assets
    has_partial_cubism_export = bool(cubism_models)
    missing_contract_files = [
        item
        for item, exists in (
            ("rin.model3.json", standard_model.is_file()),
            ("textures/", (rin_root / "textures").is_dir()),
            ("motions/", (rin_root / "motions").is_dir()),
            ("expressions/", (rin_root / "expressions").is_dir()),
        )
        if not exists
    ]

    status: ModelAvailability
    status_detail: str
    if standard_model.is_file() and model_validation["valid"] is True:
        if missing_contract_files:
            status = "partial"
            status_detail = (
                "Standard model3 file exists, but the runtime contract is incomplete."
            )
        else:
            status = "available"
            status_detail = "Standard Live2D model contract is available."
    elif standard_model.is_file():
        status = "invalid"
        status_detail = "Standard model3 file exists but failed safe validation."
    elif has_partial_cubism_export:
        status = "partial"
        status_detail = (
            "A Cubism export exists, but /live2d/rin/rin.model3.json is not "
            "installed and Web Cubism runtime loading is not active."
        )
    elif fallback_available:
        status = "fallback"
        status_detail = "PNG fallback avatar assets are available."
    else:
        status = "missing"
        status_detail = "No standard Live2D model or fallback avatar assets found."

    return {
        "expectedPath": STANDARD_MODEL_URL,
        "installPath": "public/live2d/rin/rin.model3.json",
        "frontendInstallPath": "frontend/public/live2d/rin/rin.model3.json",
        "status": status,
        "statusDetail": status_detail,
        "standardModelInstalled": standard_model.is_file(),
        "standardModelValid": model_validation["valid"],
        "standardModelErrors": model_validation["errors"],
        "missingRequiredFiles": missing_contract_files,
        "runtimeManifestPath": "/live2d/rin/rin-runtime-manifest.json"
        if runtime_manifest.is_file()
        else None,
        "assetModelPath": "/live2d/rin/rin-asset-model.json"
        if asset_model.is_file()
        else None,
        "cubismExportPresent": has_partial_cubism_export,
        "cubismModelPath": cubism_model_url,
        "cubismRuntimeActive": False,
        "runtimeDependency": "not-installed",
        "activeRenderer": "fallback" if status != "available" else "adapter-ready",
        "fallbackModeAvailable": fallback_available,
        "fallbackAssets": fallback_assets,
        "safeToLoad": status in {"available", "partial", "fallback"},
        "externalDownloadRequired": False,
        "paidAssetRequired": False,
    }


def validate_model3_json(model_path: Path, rin_root: Path) -> dict[str, object]:
    """Validate a model3 manifest enough to choose safe UI behavior."""
    if not model_path.is_file():
        return {"valid": False, "errors": ["rin.model3.json is missing"]}
    try:
        payload = json.loads(model_path.read_text(encoding="utf-8"))
    except Exception:
        return {"valid": False, "errors": ["rin.model3.json is not valid JSON"]}
    if not isinstance(payload, dict):
        return {"valid": False, "errors": ["rin.model3.json root is not an object"]}
    refs = payload.get("FileReferences")
    if not isinstance(refs, dict):
        return {"valid": False, "errors": ["FileReferences object is missing"]}
    errors: list[str] = []
    moc = refs.get("Moc")
    textures = refs.get("Textures")
    if not isinstance(moc, str) or not moc:
        errors.append("FileReferences.Moc is missing")
    elif not (model_path.parent / moc).is_file():
        errors.append(f"Referenced Moc file is missing: {moc}")
    if not isinstance(textures, list) or not textures:
        errors.append("FileReferences.Textures is missing")
    else:
        for texture in textures:
            if not isinstance(texture, str) or not texture:
                errors.append("A texture reference is invalid")
            elif not (model_path.parent / texture).is_file():
                errors.append(f"Referenced texture is missing: {texture}")
    # Motions and expressions are part of the RIN asset contract, but are reported
    # as partial contract gaps rather than JSON validity failures.
    return {"valid": not errors, "errors": errors, "root": str(rin_root)}


def build_body_state_payload(
    *,
    live2d_root: Path,
    latest_trace: Mapping[str, object] | None = None,
    provider_configured: bool = True,
    provider_health: str = "ok",
    pending_memory_review_count: int = 0,
) -> dict[str, object]:
    """Build a privacy-safe body state API payload from safe runtime metadata."""
    model = build_live2d_model_status(live2d_root)
    body_state = derive_body_state(
        latest_trace=latest_trace,
        provider_configured=provider_configured,
        provider_health=provider_health,
        pending_memory_review_count=pending_memory_review_count,
        model_status=str(model["status"]),
    )
    return {
        "ok": True,
        "mode": "body-state",
        "readOnly": True,
        "localOnly": True,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "rawModelOutputIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
        "externalProviderCallCount": 0,
        "bodyState": body_state,
        "model": model,
        "autonomy": {
            "level": "visual-only",
            "localOnly": True,
            "startsConversation": False,
            "executesTools": False,
            "readsFiles": False,
            "operatesOS": False,
            "externalApiCalls": False,
            "writesBackendData": False,
            "allowedBehaviors": [
                "blink",
                "breathing",
                "subtle_attention_shift",
                "low_frequency_idle_variation",
                "state_glow",
            ],
        },
        "controls": {
            "manualPreviewFrontendOnly": True,
            "reloadModelFrontendOnly": True,
            "fallbackToggleFrontendOnly": True,
            "backendMutationAvailable": False,
        },
        "installInstructions": {
            "message": "Live2D model not installed yet",
            "placeModelFilesUnder": "/live2d/rin/rin.model3.json",
            "expectedLocalPath": "public/live2d/rin/rin.model3.json",
            "expectedFrontendPublicPath": "frontend/public/live2d/rin/rin.model3.json",
            "runtimeDownloads": "disabled",
        },
    }


def derive_body_state(
    *,
    latest_trace: Mapping[str, object] | None,
    provider_configured: bool,
    provider_health: str,
    pending_memory_review_count: int,
    model_status: str,
) -> dict[str, object]:
    """Map safe runtime status into visual-only body state."""
    trace_status = str(latest_trace.get("status")) if latest_trace else ""
    if trace_status == "running":
        return body_state(
            activity="thinking",
            expression="focused",
            motion="thinking_loop",
            intensity=0.72,
            speech_state="silent",
            attention_state="focused",
            mood="focused",
            warning_level="none",
            source="runtime_trace",
            reason="A chat turn is currently running.",
        )
    if trace_status == "failed":
        error_code = latest_trace.get("errorCode") if latest_trace else None
        return body_state(
            activity="error",
            expression="concerned",
            motion="warning_alert",
            intensity=0.9,
            speech_state="silent",
            attention_state="alert",
            mood="concerned",
            warning_level="error",
            source="runtime_trace",
            reason=(
                f"Latest safe runtime trace failed: {error_code or 'unknown_error'}."
            ),
        )
    if not provider_configured or provider_health in {"warning", "error", "critical"}:
        return body_state(
            activity="warning",
            expression="alert",
            motion="warning_alert",
            intensity=0.68,
            speech_state="silent",
            attention_state="alert",
            mood="concerned",
            warning_level="warning",
            source="provider_status",
            reason="External chat provider configuration needs attention.",
        )
    if pending_memory_review_count > 0:
        return body_state(
            activity="memory",
            expression="gentle",
            motion="memory_pulse",
            intensity=0.54,
            speech_state="silent",
            attention_state="reviewing",
            mood="attentive",
            warning_level="none",
            source="memory_review_queue",
            reason=(
                f"{pending_memory_review_count} memory candidates need owner review."
            ),
        )
    if model_status in {"missing", "invalid"}:
        return body_state(
            activity="warning",
            expression="concerned",
            motion="warning_alert",
            intensity=0.5,
            speech_state="silent",
            attention_state="relaxed",
            mood="neutral",
            warning_level="warning",
            source="live2d_asset_status",
            reason=(
                "Live2D model is not ready; fallback body remains available "
                "if assets exist."
            ),
        )
    return body_state(
        activity="idle",
        expression="neutral",
        motion="idle_breath",
        intensity=0.3,
        speech_state="silent",
        attention_state="relaxed",
        mood="neutral",
        warning_level="none",
        source="derived_from_snapshot",
        reason="No active chat request.",
    )


def body_state(
    *,
    activity: BodyActivity,
    expression: str,
    motion: str,
    intensity: float,
    speech_state: str,
    attention_state: str,
    mood: str,
    warning_level: str,
    source: str,
    reason: str,
) -> dict[str, object]:
    return {
        "activity": activity,
        "expression": expression,
        "motion": motion,
        "intensity": intensity,
        "speechState": speech_state,
        "attentionState": attention_state,
        "mood": mood,
        "warningLevel": warning_level,
        "source": source,
        "reason": reason,
    }
