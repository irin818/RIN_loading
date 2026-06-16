from rin.body import build_body_report


def test_body_report_is_simple_and_safe() -> None:
    report = build_body_report()
    payload = report.to_dict()
    assert payload["ok"] is True
    assert payload["mode"] == "simple-body-state"
    assert payload["currentState"] == "idle"
    assert payload["defaultState"] == "idle"
    assert payload["manifestPath"] == "/body-assets/rin/manifest.json"
    assert payload["fullTextIncluded"] is False
    assert payload["rawPromptIncluded"] is False
    assert payload["hiddenReasoningIncluded"] is False
    assert payload["secretValuesIncluded"] is False
    assert "idle" in payload["availableStates"]
    assert "thinking" in payload["availableStates"]
    assert len(payload["availableStates"]) == 9


def test_body_report_falls_back_to_idle_for_unknown_state() -> None:
    report = build_body_report("fantasy")
    assert report.currentState == "idle"


def test_body_report_accepts_known_state() -> None:
    report = build_body_report("thinking")
    assert report.currentState == "thinking"
