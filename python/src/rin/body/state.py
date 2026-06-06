from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

MouthSync = Literal["idle", "speaking"]


@dataclass(frozen=True)
class BodyState:
    emotion: str
    expression: str
    motion: str
    voiceStyle: str
    mouthSync: MouthSync
    idleBehavior: str
    attention: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True)
class BodyReport:
    mode: str
    status: str
    adapterId: str
    adapterKind: str
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
    return BodyReport(
        mode="body-state-report",
        status="ready",
        adapterId="rin-python-placeholder-body",
        adapterKind="placeholder",
        bodyState=BodyState(
            emotion="calm",
            expression="neutral",
            motion="idle-breathing",
            voiceStyle="soft",
            mouthSync="idle",
            idleBehavior="calm-idle",
            attention="idle",
        ),
        bodyReplaceable=True,
        identityStoredInBody=False,
        memoryStoredInBody=False,
        policyStoredInBody=False,
        providerCallCount=0,
        fullTextIncluded=False,
    )
