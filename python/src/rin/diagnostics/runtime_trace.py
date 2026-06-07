from __future__ import annotations

import hashlib
from collections import deque
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from time import perf_counter
from typing import Literal

TraceStageStatus = Literal["ok", "warning", "error", "skipped"]
TraceStatus = Literal["running", "success", "failed"]


@dataclass(frozen=True)
class RuntimeTraceStage:
    name: str
    status: TraceStageStatus
    metadata: dict[str, object]
    recordedAt: str

    def to_safe_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass
class RuntimeTrace:
    turnId: str
    conversationId: str
    createdAt: str
    status: TraceStatus = "running"
    totalDurationMs: int | None = None
    errorCode: str | None = None
    stages: list[RuntimeTraceStage] = field(default_factory=list)

    def to_safe_dict(self) -> dict[str, object]:
        return {
            "turnId": self.turnId,
            "conversationId": self.conversationId,
            "createdAt": self.createdAt,
            "status": self.status,
            "totalDurationMs": self.totalDurationMs,
            "errorCode": self.errorCode,
            "privacyMode": "safe",
            "fullTextIncluded": False,
            "rawModelOutputIncluded": False,
            "rawPromptIncluded": False,
            "stages": [stage.to_safe_dict() for stage in self.stages],
        }


class RuntimeTraceRecorder:
    def __init__(self, turn_id: str, conversation_id: str, created_at: str) -> None:
        self.trace = RuntimeTrace(
            turnId=turn_id,
            conversationId=conversation_id,
            createdAt=created_at,
        )
        self._started_at = perf_counter()

    def record(
        self,
        name: str,
        status: TraceStageStatus = "ok",
        **metadata: object,
    ) -> None:
        self.trace.stages.append(
            RuntimeTraceStage(
                name=name,
                status=status,
                metadata=safe_metadata(metadata),
                recordedAt=utc_now(),
            )
        )

    def finish(
        self,
        status: TraceStatus,
        error_code: str | None = None,
    ) -> RuntimeTrace:
        self.trace.status = status
        self.trace.errorCode = error_code
        self.trace.totalDurationMs = elapsed_ms(self._started_at)
        return self.trace


class RuntimeTraceStore:
    def __init__(self, limit: int = 20) -> None:
        self._items: deque[RuntimeTrace] = deque(maxlen=limit)

    def add(self, trace: RuntimeTrace) -> None:
        self._items.appendleft(trace)

    def latest(self) -> RuntimeTrace | None:
        return self._items[0] if self._items else None

    def get(self, turn_id: str) -> RuntimeTrace | None:
        return next((trace for trace in self._items if trace.turnId == turn_id), None)

    def list(self) -> list[RuntimeTrace]:
        return list(self._items)

    def clear(self) -> None:
        self._items.clear()


RUNTIME_TRACE_STORE = RuntimeTraceStore()


def safe_trace_response(traces: list[RuntimeTrace]) -> dict[str, object]:
    return {
        "privacyMode": "safe",
        "readOnly": True,
        "localOnly": True,
        "externalProviderCallCount": 0,
        "fullTextIncluded": False,
        "rawModelOutputIncluded": False,
        "rawPromptIncluded": False,
        "traces": [trace.to_safe_dict() for trace in traces],
    }


def input_preview(value: str, limit: int = 18) -> str:
    stripped = " ".join(value.split())
    return stripped[:limit] + ("..." if len(stripped) > limit else "")


def short_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]


def has_thinking_tag(value: str) -> bool:
    lowered = value.lower()
    return "<think>" in lowered or "</think>" in lowered


def has_thinking_like_prefix(value: str) -> bool:
    stripped = value.lstrip().lower()
    return stripped.startswith(
        (
            "thinking:",
            "reasoning:",
            "analysis:",
            "internal analysis",
            "hidden reasoning",
        )
    )


def safe_metadata(metadata: dict[str, object]) -> dict[str, object]:
    safe: dict[str, object] = {}
    for key, value in metadata.items():
        safe[key] = safe_value(value)
    return safe


def safe_value(value: object) -> object:
    if value is None or isinstance(value, str | int | float | bool):
        return value
    if isinstance(value, list):
        return [safe_value(item) for item in value]
    if isinstance(value, tuple):
        return [safe_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): safe_value(item) for key, item in value.items()}
    return str(value)


def utc_now() -> str:
    return (
        datetime.now(tz=UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    )


def elapsed_ms(started_at: float) -> int:
    return max(0, round((perf_counter() - started_at) * 1000))
