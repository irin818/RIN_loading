from rin.body import build_body_report


def test_body_report_is_replaceable_and_policy_free() -> None:
    report = build_body_report()

    assert report.status == "ready"
    assert report.adapterKind == "layered-avatar"
    assert report.activeRenderer == "layered"
    assert report.assetMode == "state-images"
    assert report.cubismStatus == "disabled_archived_future_route"
    assert report.bodyReplaceable is True
    assert report.identityStoredInBody is False
    assert report.memoryStoredInBody is False
    assert report.policyStoredInBody is False
    assert report.providerCallCount == 0
    assert report.fullTextIncluded is False


def test_body_report_payload_is_safe_summary() -> None:
    payload = build_body_report().to_dict()

    assert payload["bodyState"] == {
        "activeRenderer": "layered",
        "activity": "idle",
        "expression": "neutral",
        "motion": "idle",
        "intensity": 0.5,
        "attentionState": "idle",
        "speechState": "silent",
        "warningLevel": 0,
    }
    assert payload["publicManifestPath"] == "/body-assets/rin-layered/manifest.json"
    assert payload["providerCallCount"] == 0
    assert payload["fullTextIncluded"] is False
