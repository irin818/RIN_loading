"""Simple body report — one image per state, no layered parts or Cubism."""

from __future__ import annotations

from dataclasses import asdict, dataclass

from rin.body.state_assets import (
    DEFAULT_STATE_ID,
    PUBLIC_BODY_MANIFEST_PATH,
    list_available_body_state_ids,
    read_current_state,
    write_current_state,
)
from rin.storage import RinDataLayout

__all__ = ["SimpleBodyReport", "build_body_report", "write_current_state"]


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


def build_body_report(layout: RinDataLayout) -> SimpleBodyReport:
    """Build a body status report including dynamic custom states."""
    current = read_current_state(layout)
    return SimpleBodyReport(
        ok=True,
        mode="simple-body-state",
        currentState=current,
        defaultState=DEFAULT_STATE_ID,
        availableStates=list_available_body_state_ids(layout),
        manifestPath=PUBLIC_BODY_MANIFEST_PATH,
        fullTextIncluded=False,
        rawPromptIncluded=False,
        hiddenReasoningIncluded=False,
        secretValuesIncluded=False,
    )
