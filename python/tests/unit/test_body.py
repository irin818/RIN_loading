from rin.body import build_body_report


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
