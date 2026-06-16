from rin.body import build_body_report


def test_body_report_is_simple_and_safe() -> None:
    report = build_body_report()
    payload = report.to_dict()
    assert payload["ok"] is True
    assert payload["mode"] == "simple-body-state"
    assert payload["currentState"] == "默认"
    assert payload["defaultState"] == "默认"
    assert payload["manifestPath"] == "/body-assets/rin/manifest.json"
    assert payload["fullTextIncluded"] is False
    assert payload["rawPromptIncluded"] is False
    assert payload["hiddenReasoningIncluded"] is False
    assert payload["secretValuesIncluded"] is False
    assert "默认" in payload["availableStates"]
    assert "生气" in payload["availableStates"]
    assert "惊讶" in payload["availableStates"]
    assert "难受" in payload["availableStates"]
    assert len(payload["availableStates"]) == 4


def test_body_report_falls_back_to_default_for_unknown_state() -> None:
    report = build_body_report("fantasy")
    assert report.currentState == "默认"


def test_body_report_accepts_known_state() -> None:
    report = build_body_report("生气")
    assert report.currentState == "生气"
