"""Simple body state — one image per state, no layered parts or Cubism."""

from __future__ import annotations

from dataclasses import asdict, dataclass

BODY_STATES = ["默认", "生气", "惊讶", "难受"]


@dataclass(frozen=True)
class SimpleBodyReport:
    ok: bool
    mode: str
    currentState: str
    defaultState: str
    availableStates: list[str]
    manifestPath: str
    fullTextIncluded: bool
    rawPromptIncluded: bool
    hiddenReasoningIncluded: bool
    secretValuesIncluded: bool

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def build_body_report(current_state: str = "idle") -> SimpleBodyReport:
    if current_state not in BODY_STATES:
        current_state = "默认"
    return SimpleBodyReport(
        ok=True,
        mode="simple-body-state",
        currentState=current_state,
        defaultState="默认",
        availableStates=list(BODY_STATES),
        manifestPath="/body-assets/rin/manifest.json",
        fullTextIncluded=False,
        rawPromptIncluded=False,
        hiddenReasoningIncluded=False,
        secretValuesIncluded=False,
    )
