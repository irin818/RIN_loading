"""Privacy-safe runtime tracing: record per-stage diagnostics for each conversation turn.

Traces are stored in-memory only (deque of last N turns). No raw prompt or model
output text is ever included — only hashes, previews, and character counts.
"""

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
    """One stage in a turn trace: input, operation, output, decision, privacy metadata."""

    name: str
    displayName: str
    status: TraceStageStatus
    durationMs: int
    summary: str
    input: dict[str, object]
    operation: dict[str, object]
    output: dict[str, object]
    decision: dict[str, object]
    privacy: dict[str, object]
    warnings: list[str]
    errors: list[str]
    metadata: dict[str, object]
    recordedAt: str

    def to_safe_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass
class RuntimeTrace:
    """A full trace for one conversation turn: ordered stages with privacy-safe summaries."""

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
            "turnShortId": short_id(self.turnId),
            "conversationId": self.conversationId,
            "conversationShortId": short_id(self.conversationId),
            "createdAt": self.createdAt,
            "status": self.status,
            "totalDurationMs": self.totalDurationMs,
            "errorCode": self.errorCode,
            "privacyMode": "safe",
            "fullTextIncluded": False,
            "rawModelOutputIncluded": False,
            "rawPromptIncluded": False,
            "analysis": build_trace_analysis(self),
            "stages": [stage.to_safe_dict() for stage in self.stages],
        }


class RuntimeTraceRecorder:
    """Records trace stages for a single turn. Call record() at each step, then finish()."""

    def __init__(self, turn_id: str, conversation_id: str, created_at: str) -> None:
        self.trace = RuntimeTrace(
            turnId=turn_id,
            conversationId=conversation_id,
            createdAt=created_at,
        )
        self._started_at = perf_counter()
        self._last_stage_at = self._started_at

    def record(
        self,
        name: str,
        status: TraceStageStatus = "ok",
        display_name: str | None = None,
        summary: str | None = None,
        input: dict[str, object] | None = None,
        operation: dict[str, object] | None = None,
        output: dict[str, object] | None = None,
        decision: dict[str, object] | None = None,
        privacy: dict[str, object] | None = None,
        warnings: list[str] | None = None,
        errors: list[str] | None = None,
        **metadata: object,
    ) -> None:
        now = perf_counter()
        duration_ms = elapsed_ms(self._last_stage_at)
        self._last_stage_at = now
        safe_input = safe_metadata(input or {})
        safe_operation = safe_metadata(operation or {})
        safe_output = safe_metadata(output or {})
        safe_decision = safe_metadata(decision or {})
        safe_privacy = {
            "fullTextIncluded": False,
            "rawPromptIncluded": False,
            "rawModelOutputIncluded": False,
            "profileTextIncluded": False,
            "memoryTextIncluded": False,
            **safe_metadata(privacy or {}),
        }
        self.trace.stages.append(
            RuntimeTraceStage(
                name=name,
                displayName=display_name or humanize_stage_name(name),
                status=status,
                durationMs=duration_ms,
                summary=summary or status,
                input=safe_input,
                operation=safe_operation,
                output=safe_output,
                decision=safe_decision,
                privacy=safe_privacy,
                warnings=[str(item) for item in warnings or []],
                errors=[str(item) for item in errors or []],
                metadata=safe_metadata(
                    metadata
                    or compatibility_metadata(
                        safe_input,
                        safe_operation,
                        safe_output,
                        safe_decision,
                        safe_privacy,
                    )
                ),
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
    """In-memory ring buffer of the most recent N RuntimeTraces (default 20)."""

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
    """Wrap a list of traces in a privacy-safe response envelope for the trace API."""
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
    """Return a short, whitespace-normalized preview of a string (for trace safety)."""
    stripped = " ".join(value.split())
    return stripped[:limit] + ("..." if len(stripped) > limit else "")


def short_hash(value: str) -> str:
    """Return the first 12 hex chars of SHA-256 (for trace-safe content fingerprinting)."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]


def short_id(value: str | None, limit: int = 8) -> str:
    """Truncate a UUID/id to a short prefix for display (returns 'n/a' for None/empty)."""
    if not value:
        return "n/a"
    return value[:limit] + ("..." if len(value) > limit else "")


def build_trace_analysis(trace: RuntimeTrace) -> dict[str, object]:
    """Extract key metrics from a completed trace for the analysis summary view."""
    input_stage = find_stage(trace, "input_received")
    recent_stage = find_stage(trace, "recent_history_selection")
    memory_stage = find_stage(trace, "memory_v2_retrieval")
    context_stage = find_stage(trace, "context_assembly")
    request_stage = find_stage(trace, "model_request")
    sanitizer_stage = find_stage(trace, "sanitization_final_answer")
    store_stage = find_stage(trace, "rin_reply_persisted")

    raw_length = int_value(stage_value(sanitizer_stage, "output", "rawLength"))
    final_length = int_value(stage_value(sanitizer_stage, "output", "finalLength"))
    removed_length = int_value(
        stage_value(sanitizer_stage, "output", "removedCharacterCount")
    )
    context_chars = int_value(
        stage_value(context_stage, "output", "finalContextCharacterCount")
    )
    request_chars = int_value(
        stage_value(request_stage, "output", "requestCharacterCount")
    )
    return {
        "ownerInputLength": stage_value(input_stage, "output", "inputLength", "n/a"),
        "recentMessagesSelected": stage_value(
            recent_stage,
            "output",
            "selectedPriorMessages",
            "n/a",
        ),
        "memoryTracesInjected": stage_value(
            memory_stage,
            "output",
            "selectedTraceCount",
            0,
        ),
        "memoryRetrievalStatus": memory_stage.status if memory_stage else "n/a",
        "memorySkipReason": stage_value(memory_stage, "decision", "skipReason", "n/a"),
        "requestMessages": stage_value(
            request_stage,
            "output",
            "requestMessageCount",
            "n/a",
        ),
        "requestCharacters": request_chars or "n/a",
        "contextCharacters": context_chars or "n/a",
        "rawOutputLength": raw_length or "n/a",
        "finalAnswerLength": final_length or "n/a",
        "removedThinkingCharacters": removed_length,
        "storedSanitizedOnly": stage_value(
            store_stage,
            "output",
            "storedSanitizedAnswer",
            "n/a",
        ),
        "model": stage_value(request_stage, "operation", "model", "n/a"),
        "rawToFinalPercent": percent(final_length, raw_length),
        "removedPercent": percent(removed_length, raw_length),
        "contextToRequestPercent": percent(context_chars, request_chars),
        "durationBars": [
            {
                "name": stage.displayName,
                "status": stage.status,
                "durationMs": stage.durationMs,
                "percent": percent(stage.durationMs, trace.totalDurationMs or 0),
            }
            for stage in trace.stages
        ],
    }


def find_stage(trace: RuntimeTrace, name: str) -> RuntimeTraceStage | None:
    return next((stage for stage in trace.stages if stage.name == name), None)


def stage_value(
    stage: RuntimeTraceStage | None,
    section: str,
    key: str,
    default: object = None,
) -> object:
    if stage is None:
        return default
    source = getattr(stage, section)
    if isinstance(source, dict):
        return source.get(key, default)
    return default


def int_value(value: object) -> int:
    return value if isinstance(value, int) else 0


def percent(value: int, total: int) -> int:
    if total <= 0:
        return 0
    return max(0, min(100, round((value / total) * 100)))


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


def compatibility_metadata(
    input: dict[str, object],
    operation: dict[str, object],
    output: dict[str, object],
    decision: dict[str, object],
    privacy: dict[str, object],
) -> dict[str, object]:
    merged: dict[str, object] = {}
    for section in (input, operation, output, decision, privacy):
        merged.update(section)
    return merged


def humanize_stage_name(name: str) -> str:
    labels = {
        "input_received": "Input",
        "owner_message_persisted": "Persist Owner",
        "profile_loading": "Profiles",
        "recent_history_selection": "Recent History",
        "memory_v2_retrieval": "Memory Retrieval",
        "context_assembly": "Context Assembly",
        "model_request": "Model Request",
        "raw_model_response": "Raw Response",
        "sanitization_final_answer": "Sanitizer",
        "rin_reply_persisted": "Store Reply",
        "memory_update": "Memory Update",
        "response_returned": "Return",
    }
    return labels.get(name, name.replace("_", " ").title())


def utc_now() -> str:
    return (
        datetime.now(tz=UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    )


def elapsed_ms(started_at: float) -> int:
    return max(0, round((perf_counter() - started_at) * 1000))
