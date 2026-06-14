from pathlib import Path

from rin.body import (
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
