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
REQUIRED_RUNTIME_DIRS = ("textures",)
OPTIONAL_RUNTIME_DIRS = ("motions", "expressions")
CUBISM_CORE_SCRIPT_RELATIVE_PATH = "cubism-core/live2dcubismcore.min.js"
LIVE2D_BROWSER_RENDERER_DEPENDENCY = "live2d-renderer@0.6.6"
LIVE2D_BROWSER_RENDERER_COMPATIBLE = False
LIVE2D_BROWSER_RENDERER_BLOCKER = (
    "live2d-renderer@0.6.6 bundles a Cubism Framework build that cannot draw "
    "the current Cubism Core 6 / MOC version 6 RIN export."
)
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


def build_live2d_model_status(
    live2d_root: Path,
    *,
    browser_renderer_compatible: bool = LIVE2D_BROWSER_RENDERER_COMPATIBLE,
) -> dict[str, object]:
    """Inspect local Live2D runtime assets without requiring a Cubism SDK."""
    rin_root = live2d_root / "rin"
    standard_model = live2d_root / STANDARD_MODEL_RELATIVE_PATH
    cubism_core_script = live2d_root / CUBISM_CORE_SCRIPT_RELATIVE_PATH
    runtime_manifest = rin_root / "rin-runtime-manifest.json"
    asset_model = rin_root / "rin-asset-model.json"
    fallback_assets = {
        key: f"/live2d/rin/{filename}"
        for key, filename in FALLBACK_ASSET_FILES.items()
        if (rin_root / filename).is_file()
    }
    partial_exports = discover_partial_cubism_exports(rin_root)
    cubism_model_url = (
        str(partial_exports[0]["model3Path"]) if partial_exports else None
    )
    model_validation = validate_model3_json(standard_model, rin_root)
    fallback_available = "bustFront" in fallback_assets
    has_partial_cubism_export = bool(partial_exports)
    missing_contract_files = [
        item
        for item, exists in (
            ("rin.model3.json", standard_model.is_file()),
            *(
                (f"{dirname}/", (rin_root / dirname).is_dir())
                for dirname in REQUIRED_RUNTIME_DIRS
            ),
        )
        if not exists
    ]
    missing_optional_capabilities = [
        f"{dirname}/"
        for dirname in OPTIONAL_RUNTIME_DIRS
        if not (rin_root / dirname).is_dir()
    ]

    status: ModelAvailability
    status_detail: str
    model_json_valid = model_validation["jsonValid"] is True
    required_references_valid = model_validation["requiredReferencesValid"] is True
    raw_referenced_missing = model_validation["missingReferencedFiles"]
    referenced_missing = (
        [item for item in raw_referenced_missing if isinstance(item, str)]
        if isinstance(raw_referenced_missing, list)
        else []
    )
    if (
        standard_model.is_file()
        and model_json_valid
        and required_references_valid
        and not referenced_missing
    ):
        status = "available"
        if missing_optional_capabilities:
            status_detail = (
                "Standard Live2D model package is available; motions and "
                "expressions are not installed, so state rendering uses "
                "parameter/effect fallbacks."
            )
        else:
            status_detail = "Standard Live2D model package is available."
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

    standard_runtime_available = status == "available"
    cubism_core_present = cubism_core_script.is_file()
    web_runtime_ready = (
        standard_runtime_available
        and cubism_core_present
        and browser_renderer_compatible
    )
    browser_renderer_status = "compatible" if browser_renderer_compatible else "blocked"
    browser_renderer_blocker = (
        None if browser_renderer_compatible else LIVE2D_BROWSER_RENDERER_BLOCKER
    )
    validation_missing_optional = model_validation["missingOptionalFiles"]
    missing_optional_files = [
        *missing_optional_capabilities,
        *(
            validation_missing_optional
            if isinstance(validation_missing_optional, list)
            else []
        ),
    ]

    return {
        "expectedPath": STANDARD_MODEL_URL,
        "installPath": "public/live2d/rin/rin.model3.json",
        "frontendInstallPath": "frontend/public/live2d/rin/rin.model3.json",
        "status": status,
        "statusDetail": status_detail,
        "assetContractReady": standard_runtime_available,
        "runtimePackageReady": standard_runtime_available,
        "runtimeReady": web_runtime_ready,
        "fallbackActive": fallback_available and not web_runtime_ready,
        "standardModelInstalled": standard_model.is_file(),
        "standardModelValid": model_validation["valid"],
        "standardModelJsonValid": model_json_valid,
        "requiredReferencesValid": required_references_valid,
        "standardModelErrors": model_validation["errors"],
        "standardModelWarnings": model_validation["warnings"],
        "missingRequiredFiles": missing_contract_files,
        "missingReferencedFiles": referenced_missing,
        "missingOptionalFiles": missing_optional_files,
        "mocPresent": model_validation["mocPresent"],
        "texturesPresent": model_validation["texturesPresent"],
        "motionsPresent": model_validation["motionsPresent"],
        "expressionsPresent": model_validation["expressionsPresent"],
        "physicsPresent": model_validation["physicsPresent"],
        "posePresent": model_validation["posePresent"],
        "referencedFiles": model_validation["referencedFiles"],
        "runtimeManifestPath": "/live2d/rin/rin-runtime-manifest.json"
        if runtime_manifest.is_file()
        else None,
        "assetModelPath": "/live2d/rin/rin-asset-model.json"
        if asset_model.is_file()
        else None,
        "cubismExportPresent": has_partial_cubism_export,
        "cubismModelPath": cubism_model_url,
        "partialCubismExports": partial_exports,
        "cubismRuntimeActive": web_runtime_ready,
        "runtimeDependency": LIVE2D_BROWSER_RENDERER_DEPENDENCY,
        "browserRendererDependency": LIVE2D_BROWSER_RENDERER_DEPENDENCY,
        "browserRendererCompatible": browser_renderer_compatible,
        "browserRendererStatus": browser_renderer_status,
        "browserRendererBlocker": browser_renderer_blocker,
        "runtimeCoreScriptPath": "/live2d/cubism-core/live2dcubismcore.min.js",
        "runtimeCoreScriptPresent": cubism_core_present,
        "runtimeCoreRequired": True,
        "activeRenderer": "live2d" if web_runtime_ready else "fallback",
        "fallbackModeAvailable": fallback_available,
        "fallbackAssets": fallback_assets,
        "safeToLoad": web_runtime_ready,
        "externalDownloadRequired": False,
        "paidAssetRequired": False,
        "rawTextIncluded": False,
        "secretValuesIncluded": False,
    }


def validate_model3_json(model_path: Path, rin_root: Path) -> dict[str, object]:
    """Validate a model3 manifest enough to choose safe UI behavior."""
    if not model_path.is_file():
        return empty_model_validation(["rin.model3.json is missing"])
    try:
        payload = json.loads(model_path.read_text(encoding="utf-8"))
    except Exception:
        return empty_model_validation(["rin.model3.json is not valid JSON"])
    if not isinstance(payload, dict):
        return empty_model_validation(["rin.model3.json root is not an object"])
    refs = payload.get("FileReferences")
    if not isinstance(refs, dict):
        return empty_model_validation(["FileReferences object is missing"])

    errors: list[str] = []
    warnings: list[str] = []
    missing_referenced_files: list[str] = []
    missing_optional_files: list[str] = []
    referenced_files: dict[str, object] = {
        "moc": None,
        "textures": [],
        "motions": [],
        "expressions": [],
        "physics": None,
        "pose": None,
    }
    moc_present = False
    textures_present = False
    motions_present = False
    expressions_present = False
    physics_present = False
    pose_present = False

    moc = refs.get("Moc")
    textures = refs.get("Textures")
    if not isinstance(moc, str) or not moc:
        errors.append("FileReferences.Moc is missing")
    else:
        referenced_files["moc"] = moc
        moc_path = safe_reference_path(model_path.parent, moc)
        if moc_path is None:
            errors.append(f"Referenced Moc file path is unsafe: {moc}")
        elif moc_path.is_file():
            moc_present = True
        else:
            errors.append(f"Referenced Moc file is missing: {moc}")

    if not isinstance(textures, list) or not textures:
        errors.append("FileReferences.Textures is missing")
    else:
        texture_refs: list[str] = []
        for texture in textures:
            if not isinstance(texture, str) or not texture:
                errors.append("A texture reference is invalid")
                continue
            texture_refs.append(texture)
            texture_path = safe_reference_path(model_path.parent, texture)
            if texture_path is None:
                errors.append(f"Referenced texture path is unsafe: {texture}")
            elif not texture_path.is_file():
                missing_referenced_files.append(f"texture:{texture}")
        referenced_files["textures"] = texture_refs
        textures_present = bool(texture_refs) and not any(
            item.startswith("texture:") for item in missing_referenced_files
        )

    motion_refs = collect_motion_references(refs.get("Motions"))
    referenced_files["motions"] = motion_refs
    motions_present = bool(motion_refs)
    if not motion_refs:
        warnings.append("FileReferences.Motions is missing or empty")
    for motion in motion_refs:
        motion_path = safe_reference_path(model_path.parent, motion)
        if motion_path is None or not motion_path.is_file():
            missing_referenced_files.append(f"motion:{motion}")

    expression_refs = collect_expression_references(refs.get("Expressions"))
    referenced_files["expressions"] = expression_refs
    expressions_present = bool(expression_refs)
    if not expression_refs:
        warnings.append("FileReferences.Expressions is missing or empty")
    for expression in expression_refs:
        expression_path = safe_reference_path(model_path.parent, expression)
        if expression_path is None or not expression_path.is_file():
            missing_referenced_files.append(f"expression:{expression}")

    physics = refs.get("Physics")
    if isinstance(physics, str) and physics:
        referenced_files["physics"] = physics
        physics_path = safe_reference_path(model_path.parent, physics)
        if physics_path is None:
            missing_optional_files.append(f"physics:{physics}")
        elif physics_path.is_file():
            physics_present = True
        else:
            missing_optional_files.append(f"physics:{physics}")

    pose = refs.get("Pose")
    if isinstance(pose, str) and pose:
        referenced_files["pose"] = pose
        pose_path = safe_reference_path(model_path.parent, pose)
        if pose_path is None:
            missing_optional_files.append(f"pose:{pose}")
        elif pose_path.is_file():
            pose_present = True
        else:
            missing_optional_files.append(f"pose:{pose}")

    required_references_valid = moc_present and textures_present
    valid = not errors and required_references_valid and not missing_referenced_files
    return {
        "valid": valid,
        "jsonValid": True,
        "requiredReferencesValid": required_references_valid,
        "errors": errors,
        "warnings": warnings,
        "missingReferencedFiles": missing_referenced_files,
        "missingOptionalFiles": missing_optional_files,
        "referencedFiles": referenced_files,
        "mocPresent": moc_present,
        "texturesPresent": textures_present,
        "motionsPresent": motions_present,
        "expressionsPresent": expressions_present,
        "physicsPresent": physics_present,
        "posePresent": pose_present,
        "root": str(rin_root),
    }


def empty_model_validation(errors: list[str]) -> dict[str, object]:
    return {
        "valid": False,
        "jsonValid": False,
        "requiredReferencesValid": False,
        "errors": errors,
        "warnings": [],
        "missingReferencedFiles": [],
        "missingOptionalFiles": [],
        "referencedFiles": {
            "moc": None,
            "textures": [],
            "motions": [],
            "expressions": [],
            "physics": None,
            "pose": None,
        },
        "mocPresent": False,
        "texturesPresent": False,
        "motionsPresent": False,
        "expressionsPresent": False,
        "physicsPresent": False,
        "posePresent": False,
        "root": "",
    }


def safe_reference_path(base: Path, reference: str) -> Path | None:
    path = Path(reference)
    if path.is_absolute() or ".." in path.parts:
        return None
    return base / path


def collect_motion_references(value: object) -> list[str]:
    if not isinstance(value, dict):
        return []
    refs: list[str] = []
    for group_items in value.values():
        if not isinstance(group_items, list):
            continue
        for item in group_items:
            if isinstance(item, dict) and isinstance(item.get("File"), str):
                refs.append(str(item["File"]))
    return refs


def collect_expression_references(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    refs: list[str] = []
    for item in value:
        if isinstance(item, dict) and isinstance(item.get("File"), str):
            refs.append(str(item["File"]))
    return refs


def discover_partial_cubism_exports(rin_root: Path) -> list[dict[str, object]]:
    exports: list[dict[str, object]] = []
    for model_path in sorted((rin_root / "cubism").glob("*/*.model3.json")):
        validation = validate_model3_json(model_path, rin_root)
        relative = model_path.relative_to(rin_root)
        export_complete = (
            validation["valid"] is True
            and validation["motionsPresent"] is True
            and validation["expressionsPresent"] is True
        )
        exports.append(
            {
                "model3Path": f"/live2d/rin/{relative.as_posix()}",
                "status": "complete" if export_complete else "partial",
                "mocPresent": validation["mocPresent"],
                "texturesPresent": validation["texturesPresent"],
                "motionsPresent": validation["motionsPresent"],
                "expressionsPresent": validation["expressionsPresent"],
                "physicsPresent": validation["physicsPresent"],
                "posePresent": validation["posePresent"],
                "missingReferencedFiles": validation["missingReferencedFiles"],
                "note": "Interim export outside the standard runtime contract.",
            }
        )
    return exports


def build_body_asset_diagnostics_payload(live2d_root: Path) -> dict[str, object]:
    """Return safe Live2D asset diagnostics for API and CLI callers."""
    model = build_live2d_model_status(live2d_root)
    return {
        "ok": True,
        "mode": "body-assets",
        "readOnly": True,
        "localOnly": True,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "rawModelOutputIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
        "model": model,
        "contract": {
            "expectedPath": STANDARD_MODEL_URL,
            "required": [
                "rin.model3.json",
                "referenced .moc3",
                "referenced textures",
            ],
            "optional": [
                "motions/",
                "expressions/",
                "referenced physics3.json",
                "referenced pose3.json",
            ],
            "webRuntime": [
                f"frontend dependency: {LIVE2D_BROWSER_RENDERER_DEPENDENCY}",
                f"browser renderer status: {model['browserRendererStatus']}",
                "local Cubism Core script: live2dcubismcore.min.js",
            ],
            "fallbackIsLive2D": False,
        },
    }


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
    install_message = "Live2D model not installed yet"
    if model["status"] == "available" and model["runtimeCoreScriptPresent"] is not True:
        install_message = (
            "Live2D model is installed; Cubism Core runtime script is missing"
        )
    elif (
        model["status"] == "available"
        and model["browserRendererCompatible"] is not True
    ):
        install_message = (
            "Live2D model and Cubism Core are installed; browser renderer is "
            "blocked by Cubism Core 6 / MOC v6 compatibility"
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
            "message": install_message,
            "placeModelFilesUnder": "/live2d/rin/rin.model3.json",
            "expectedLocalPath": "public/live2d/rin/rin.model3.json",
            "expectedFrontendPublicPath": "frontend/public/live2d/rin/rin.model3.json",
            "expectedRuntimeCorePath": (
                "public/live2d/cubism-core/live2dcubismcore.min.js"
            ),
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
