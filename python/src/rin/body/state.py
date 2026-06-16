"""Safe body/embodiment state for the active Layered Avatar renderer."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

BodyActivity = Literal[
    "idle",
    "thinking",
    "speaking",
    "memory",
    "warning",
    "error",
    "sleeping",
    "listening",
    "reviewing",
]
SpeechState = Literal["silent", "speaking"]


@dataclass(frozen=True)
class BodyState:
    """Current safe body/avatar state for UI rendering."""

    activeRenderer: str
    activity: BodyActivity
    expression: str
    motion: str
    intensity: float
    attentionState: str
    speechState: SpeechState
    warningLevel: int

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True)
class BodyReport:
    """
    Report on the body adapter: active renderer status, what's stored in-body vs. in RIN
    core.
    """

    mode: str
    status: str
    adapterId: str
    adapterKind: str
    activeRenderer: str
    rendererLabel: str
    assetMode: str
    manifestPath: str
    publicManifestPath: str
    cubismStatus: str
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
    """Build the safe Layered Avatar body report."""
    return BodyReport(
        mode="body-state-report",
        status="ready",
        adapterId="rin-layered-avatar-body",
        adapterKind="layered-avatar",
        activeRenderer="layered",
        rendererLabel="Layered Avatar",
        assetMode="state-images",
        manifestPath="public/body/rin-layered/manifest.json",
        publicManifestPath="/body-assets/rin-layered/manifest.json",
        cubismStatus="disabled_archived_future_route",
        bodyState=BodyState(
            activeRenderer="layered",
            activity="idle",
            expression="neutral",
            motion="idle",
            intensity=0.5,
            attentionState="idle",
            speechState="silent",
            warningLevel=0,
        ),
        bodyReplaceable=True,
        identityStoredInBody=False,
        memoryStoredInBody=False,
        policyStoredInBody=False,
        providerCallCount=0,
        fullTextIncluded=False,
    )
