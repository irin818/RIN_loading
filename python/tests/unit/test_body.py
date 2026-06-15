from pathlib import Path

from rin.body import (
    build_body_asset_diagnostics_payload,
    build_body_report,
    build_body_state_payload,
    build_live2d_model_status,
)


def test_body_report_is_replaceable_and_policy_free() -> None:
    report = build_body_report()

    assert report.status == "ready"
    assert report.adapterKind == "placeholder"
    assert report.bodyReplaceable is True
    assert report.identityStoredInBody is False
    assert report.memoryStoredInBody is False
    assert report.policyStoredInBody is False
    assert report.providerCallCount == 0
    assert report.fullTextIncluded is False


def test_body_report_payload_is_safe_summary() -> None:
    payload = build_body_report().to_dict()

    assert payload["bodyState"] == {
        "emotion": "calm",
        "expression": "neutral",
        "motion": "idle-breathing",
        "voiceStyle": "soft",
        "mouthSync": "idle",
        "idleBehavior": "calm-idle",
        "attention": "idle",
    }
    assert payload["providerCallCount"] == 0
    assert payload["fullTextIncluded"] is False


def test_live2d_model_status_handles_missing_assets(tmp_path: Path) -> None:
    status = build_live2d_model_status(tmp_path)

    assert status["status"] == "missing"
    assert status["expectedPath"] == "/live2d/rin/rin.model3.json"
    assert status["standardModelInstalled"] is False
    assert status["fallbackModeAvailable"] is False
    assert status["fallbackActive"] is False
    assert status["externalDownloadRequired"] is False


def test_live2d_model_status_uses_fallback_when_png_assets_exist(
    tmp_path: Path,
) -> None:
    rin_root = tmp_path / "rin"
    rin_root.mkdir()
    (rin_root / "rin-bust-front.png").write_bytes(b"placeholder")

    status = build_live2d_model_status(tmp_path)

    assert status["status"] == "fallback"
    assert status["fallbackModeAvailable"] is True
    assert status["fallbackAssets"] == {"bustFront": "/live2d/rin/rin-bust-front.png"}
    assert status["assetContractReady"] is False
    assert status["runtimeReady"] is False


def test_live2d_model_status_reports_partial_cubism_export(tmp_path: Path) -> None:
    export_root = tmp_path / "rin" / "cubism" / "rin-layered-source"
    texture_root = export_root / "rin-layered-source.1024"
    texture_root.mkdir(parents=True)
    (export_root / "rin-layered-source.moc3").write_bytes(b"moc")
    (texture_root / "texture_00.png").write_bytes(b"texture")
    (export_root / "rin-layered-source.model3.json").write_text(
        """
        {
          "Version": 3,
          "FileReferences": {
            "Moc": "rin-layered-source.moc3",
            "Textures": ["rin-layered-source.1024/texture_00.png"]
          }
        }
        """,
        encoding="utf-8",
    )

    status = build_live2d_model_status(tmp_path)

    assert status["status"] == "partial"
    assert status["standardModelInstalled"] is False
    assert status["cubismExportPresent"] is True
    assert status["cubismModelPath"] == (
        "/live2d/rin/cubism/rin-layered-source/rin-layered-source.model3.json"
    )
    assert status["partialCubismExports"][0]["status"] == "partial"
    assert status["partialCubismExports"][0]["mocPresent"] is True
    assert status["partialCubismExports"][0]["texturesPresent"] is True
    assert status["partialCubismExports"][0]["motionsPresent"] is False
    assert status["partialCubismExports"][0]["expressionsPresent"] is False
    assert status["runtimeReady"] is False


def test_live2d_model_status_accepts_loadable_standard_model_without_motion_assets(
    tmp_path: Path,
) -> None:
    rin_root = tmp_path / "rin"
    (rin_root / "textures").mkdir(parents=True)
    (rin_root / "rin.moc3").write_bytes(b"moc")
    (rin_root / "textures" / "texture_00.png").write_bytes(b"texture")
    (rin_root / "rin.model3.json").write_text(
        """
        {
          "Version": 3,
          "FileReferences": {
            "Moc": "rin.moc3",
            "Textures": ["textures/texture_00.png"],
            "DisplayInfo": "rin.cdi3.json"
          }
        }
        """,
        encoding="utf-8",
    )

    status = build_live2d_model_status(tmp_path)

    assert status["status"] == "available"
    assert status["assetContractReady"] is True
    assert status["runtimePackageReady"] is True
    assert status["standardModelInstalled"] is True
    assert status["mocPresent"] is True
    assert status["texturesPresent"] is True
    assert status["motionsPresent"] is False
    assert status["expressionsPresent"] is False
    assert status["missingRequiredFiles"] == []
    assert status["missingReferencedFiles"] == []
    assert status["missingOptionalFiles"] == ["motions/", "expressions/"]
    assert status["runtimeCoreScriptPresent"] is False
    assert status["runtimeReady"] is False
    assert status["cubismRuntimeActive"] is False
    assert status["activeRenderer"] == "fallback"
    assert status["safeToLoad"] is False


def test_live2d_model_status_keeps_runtime_blocked_when_renderer_is_incompatible(
    tmp_path: Path,
) -> None:
    rin_root = tmp_path / "rin"
    (rin_root / "textures").mkdir(parents=True)
    (tmp_path / "cubism-core").mkdir()
    (tmp_path / "cubism-core" / "live2dcubismcore.min.js").write_text(
        "window.Live2DCubismCore = {};",
        encoding="utf-8",
    )
    (rin_root / "rin.moc3").write_bytes(b"moc")
    (rin_root / "textures" / "texture_00.png").write_bytes(b"texture")
    (rin_root / "rin.model3.json").write_text(
        """
        {
          "Version": 3,
          "FileReferences": {
            "Moc": "rin.moc3",
            "Textures": ["textures/texture_00.png"]
          }
        }
        """,
        encoding="utf-8",
    )

    status = build_live2d_model_status(tmp_path)

    assert status["status"] == "available"
    assert status["runtimeCoreScriptPresent"] is True
    assert status["browserRendererCompatible"] is False
    assert status["browserRendererStatus"] == "blocked"
    assert status["browserRendererBlocker"]
    assert status["runtimeReady"] is False
    assert status["cubismRuntimeActive"] is False
    assert status["activeRenderer"] == "fallback"
    assert status["safeToLoad"] is False


def test_live2d_model_status_marks_web_runtime_ready_with_compatible_renderer(
    tmp_path: Path,
) -> None:
    rin_root = tmp_path / "rin"
    (rin_root / "textures").mkdir(parents=True)
    (tmp_path / "cubism-core").mkdir()
    (tmp_path / "cubism-core" / "live2dcubismcore.min.js").write_text(
        "window.Live2DCubismCore = {};",
        encoding="utf-8",
    )
    (rin_root / "rin.moc3").write_bytes(b"moc")
    (rin_root / "textures" / "texture_00.png").write_bytes(b"texture")
    (rin_root / "rin.model3.json").write_text(
        """
        {
          "Version": 3,
          "FileReferences": {
            "Moc": "rin.moc3",
            "Textures": ["textures/texture_00.png"]
          }
        }
        """,
        encoding="utf-8",
    )

    status = build_live2d_model_status(tmp_path, browser_renderer_compatible=True)

    assert status["status"] == "available"
    assert status["runtimeCoreScriptPresent"] is True
    assert status["browserRendererCompatible"] is True
    assert status["browserRendererStatus"] == "compatible"
    assert status["browserRendererBlocker"] is None
    assert status["runtimeReady"] is True
    assert status["cubismRuntimeActive"] is True
    assert status["activeRenderer"] == "live2d"
    assert status["safeToLoad"] is True


def test_live2d_model_status_accepts_complete_standard_contract(
    tmp_path: Path,
) -> None:
    rin_root = tmp_path / "rin"
    (rin_root / "textures").mkdir(parents=True)
    (rin_root / "motions").mkdir()
    (rin_root / "expressions").mkdir()
    (rin_root / "rin.moc3").write_bytes(b"moc")
    (rin_root / "textures" / "texture_00.png").write_bytes(b"texture")
    (rin_root / "motions" / "idle.motion3.json").write_text("{}", encoding="utf-8")
    (rin_root / "expressions" / "neutral.exp3.json").write_text(
        "{}",
        encoding="utf-8",
    )
    (rin_root / "physics.physics3.json").write_text("{}", encoding="utf-8")
    (rin_root / "pose.pose3.json").write_text("{}", encoding="utf-8")
    (rin_root / "rin.model3.json").write_text(
        """
        {
          "Version": 3,
          "FileReferences": {
            "Moc": "rin.moc3",
            "Textures": ["textures/texture_00.png"],
            "Motions": {
              "Idle": [{ "File": "motions/idle.motion3.json" }]
            },
            "Expressions": [
              { "Name": "neutral", "File": "expressions/neutral.exp3.json" }
            ],
            "Physics": "physics.physics3.json",
            "Pose": "pose.pose3.json"
          }
        }
        """,
        encoding="utf-8",
    )

    status = build_live2d_model_status(tmp_path)

    assert status["status"] == "available"
    assert status["assetContractReady"] is True
    assert status["standardModelInstalled"] is True
    assert status["standardModelValid"] is True
    assert status["mocPresent"] is True
    assert status["texturesPresent"] is True
    assert status["motionsPresent"] is True
    assert status["expressionsPresent"] is True
    assert status["physicsPresent"] is True
    assert status["posePresent"] is True
    assert status["missingRequiredFiles"] == []
    assert status["missingReferencedFiles"] == []
    assert status["safeToLoad"] is False
    assert status["runtimeReady"] is False


def test_body_asset_diagnostics_payload_is_safe(tmp_path: Path) -> None:
    payload = build_body_asset_diagnostics_payload(tmp_path)

    assert payload["mode"] == "body-assets"
    assert payload["readOnly"] is True
    assert payload["localOnly"] is True
    assert payload["rawPromptIncluded"] is False
    assert payload["rawMemoryIncluded"] is False
    assert payload["rawModelOutputIncluded"] is False
    assert payload["hiddenReasoningIncluded"] is False
    assert payload["secretValuesIncluded"] is False
    assert payload["contract"]["fallbackIsLive2D"] is False


def test_body_state_payload_is_visual_only_and_safe(tmp_path: Path) -> None:
    payload = build_body_state_payload(
        live2d_root=tmp_path,
        latest_trace={"status": "running"},
        provider_configured=True,
        provider_health="ok",
        pending_memory_review_count=0,
    )

    assert payload["mode"] == "body-state"
    assert payload["localOnly"] is True
    assert payload["rawPromptIncluded"] is False
    assert payload["rawMemoryIncluded"] is False
    assert payload["hiddenReasoningIncluded"] is False
    assert payload["secretValuesIncluded"] is False
    assert payload["externalProviderCallCount"] == 0
    assert payload["bodyState"]["activity"] == "thinking"
    assert payload["autonomy"]["startsConversation"] is False
    assert payload["autonomy"]["executesTools"] is False
    assert payload["controls"]["backendMutationAvailable"] is False


def test_body_state_payload_explains_missing_cubism_core(tmp_path: Path) -> None:
    rin_root = tmp_path / "rin"
    (rin_root / "textures").mkdir(parents=True)
    (rin_root / "rin.moc3").write_bytes(b"moc")
    (rin_root / "textures" / "texture_00.png").write_bytes(b"texture")
    (rin_root / "rin.model3.json").write_text(
        """
        {
          "Version": 3,
          "FileReferences": {
            "Moc": "rin.moc3",
            "Textures": ["textures/texture_00.png"]
          }
        }
        """,
        encoding="utf-8",
    )

    payload = build_body_state_payload(
        live2d_root=tmp_path,
        provider_configured=True,
        provider_health="ok",
        pending_memory_review_count=0,
    )

    assert payload["model"]["status"] == "available"
    assert payload["model"]["runtimeReady"] is False
    assert payload["installInstructions"]["message"] == (
        "Live2D model is installed; Cubism Core runtime script is missing"
    )
    assert payload["installInstructions"]["expectedRuntimeCorePath"] == (
        "public/live2d/cubism-core/live2dcubismcore.min.js"
    )


def test_body_state_payload_explains_blocked_browser_renderer(tmp_path: Path) -> None:
    rin_root = tmp_path / "rin"
    (rin_root / "textures").mkdir(parents=True)
    (tmp_path / "cubism-core").mkdir()
    (tmp_path / "cubism-core" / "live2dcubismcore.min.js").write_text(
        "window.Live2DCubismCore = {};",
        encoding="utf-8",
    )
    (rin_root / "rin.moc3").write_bytes(b"moc")
    (rin_root / "textures" / "texture_00.png").write_bytes(b"texture")
    (rin_root / "rin.model3.json").write_text(
        """
        {
          "Version": 3,
          "FileReferences": {
            "Moc": "rin.moc3",
            "Textures": ["textures/texture_00.png"]
          }
        }
        """,
        encoding="utf-8",
    )

    payload = build_body_state_payload(
        live2d_root=tmp_path,
        provider_configured=True,
        provider_health="ok",
        pending_memory_review_count=0,
    )

    assert payload["model"]["status"] == "available"
    assert payload["model"]["runtimeCoreScriptPresent"] is True
    assert payload["model"]["browserRendererCompatible"] is False
    assert payload["model"]["runtimeReady"] is False
    assert payload["model"]["safeToLoad"] is False
    assert payload["installInstructions"]["message"] == (
        "Live2D model and Cubism Core are installed; browser renderer is "
        "blocked by Cubism Core 6 / MOC v6 compatibility"
    )
