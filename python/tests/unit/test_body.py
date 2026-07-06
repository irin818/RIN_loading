from rin.body import build_body_report
from rin.body.state import write_current_state
from rin.diagnostics.safety import create_temp_data_dir
from rin.storage import create_data_layout


def _temp_layout():
    """Create a temporary layout for testing."""
    tmp = create_temp_data_dir()
    return create_data_layout(str(tmp.path), cwd="/")


def test_body_report_is_simple_and_safe() -> None:
    layout = _temp_layout()
    report = build_body_report(layout)
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
    available: list[str] = report.availableStates
    assert "默认" in available
    assert "生气" in available
    assert "惊讶" in available
    assert "难受" in available
    assert len(available) == 4


def test_body_report_falls_back_to_default_for_unknown_state() -> None:
    layout = _temp_layout()
    # When no state is persisted, it defaults to "默认"
    report = build_body_report(layout)
    assert report.currentState == "默认"


def test_body_report_accepts_persisted_state() -> None:
    layout = _temp_layout()
    write_current_state(layout, "生气")
    report = build_body_report(layout)
    assert report.currentState == "生气"


def test_body_report_includes_custom_states() -> None:
    layout = _temp_layout()
    write_current_state(layout, "默认")
    report = build_body_report(layout)
    available: list[str] = report.availableStates
    assert "默认" in available
    assert len(available) == 4  # no custom states uploaded yet
