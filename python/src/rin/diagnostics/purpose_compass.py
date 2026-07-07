"""Purpose compass diagnostics for the RIN runtime.

This module turns RIN's governance-level purpose into a safe, read-only runtime
contract. It exposes maturity signals and roadmap direction without reading raw
conversation text, profile text, memory content, secrets, or hidden reasoning.
"""

from __future__ import annotations

from collections.abc import Mapping

from rin.body import build_body_report
from rin.config.chat_provider import load_chat_provider_config
from rin.database import inspect_database
from rin.diagnostics.runtime_trace import RUNTIME_TRACE_STORE
from rin.profiles import build_profile_report
from rin.storage import RinDataLayout


def build_purpose_compass_payload(
    layout: RinDataLayout,
    adapter: object,
) -> dict[str, object]:
    """Build a safe purpose/maturity/roadmap payload for UI and API clients."""
    status = inspect_database(layout)
    counts = status.counts
    profile = build_profile_report(layout)
    body = build_body_report(layout)
    chat_config = load_chat_provider_config()
    latest_trace = RUNTIME_TRACE_STORE.latest()
    adapter_id = str(getattr(adapter, "id", chat_config.id))
    provider = str(getattr(adapter, "provider", chat_config.provider))
    model = str(getattr(adapter, "model", chat_config.model))
    provider_configured = adapter_id == "rin-mock-test" or chat_config.configured
    latest_trace_status = latest_trace.status if latest_trace else "n/a"

    dimensions = [
        purpose_dimension(
            "local-governance",
            "Local Governance",
            "Keep identity, memory, policy, state, and continuity locally owned.",
            score=score_booleans(
                status.schemaVersion >= 6,
                layout.manifestPath.is_file(),
                profile.fullTextIncluded is False,
            ),
            status="active" if status.schemaVersion >= 6 else "needs_attention",
            evidence=[
                f"database schema v{status.schemaVersion}",
                f"manifestPresent={layout.manifestPath.is_file()}",
                "profile diagnostics expose counts only",
            ],
            signals=[
                metric("schema", status.schemaVersion),
                metric("slow variable versions", counts.slowVariableVersions),
                metric("state history", counts.stateHistory),
            ],
            next_step=(
                "Keep schema, storage, and governance changes explicit, small, "
                "and test-backed."
            ),
        ),
        purpose_dimension(
            "identity-owner-model",
            "Identity / Owner Model",
            "Maintain RIN identity and owner understanding as governed slow variables.",
            score=score_booleans(
                profile.status == "valid",
                len(profile.files) >= 2,
                profile.issueCount == 0,
            ),
            status="active" if profile.status == "valid" else "needs_attention",
            evidence=[
                f"profileStatus={profile.status}",
                f"profileFiles={len(profile.files)}",
                f"profileIssues={profile.issueCount}",
            ],
            signals=[
                metric("profile files", len(profile.files)),
                metric("profile issues", profile.issueCount),
                metric("self model rows", counts.rinSelfModel),
            ],
            next_step=(
                "Add owner-reviewed profile editing only as a dedicated "
                "slow-variable task."
            ),
        ),
        purpose_dimension(
            "conversation-runtime",
            "Conversation Runtime",
            "Run provider-neutral conversation turns through backend orchestration.",
            score=score_booleans(
                status.schemaVersion >= 6,
                provider_configured,
                counts.messages > 0 or latest_trace is not None,
            ),
            status="active" if provider_configured else "provider_config_needed",
            evidence=[
                f"adapter={adapter_id}",
                f"provider={provider}",
                f"model={model}",
            ],
            signals=[
                metric("conversations", counts.conversations),
                metric("messages", counts.messages),
                metric("latest trace", latest_trace_status),
            ],
            next_step=(
                "Keep frontend chat behind FastAPI adapters; never call providers "
                "from React."
            ),
        ),
        purpose_dimension(
            "memory-governance",
            "Memory Governance",
            (
                "Grow long-term memory through safe candidates, traces, review, "
                "and retrieval."
            ),
            score=score_memory(counts.memoryV2Traces, counts.memoryCandidates),
            status="active" if counts.memoryV2Traces > 0 else "ready_no_traces",
            evidence=[
                f"memoryV2Traces={counts.memoryV2Traces}",
                f"memoryCandidates={counts.memoryCandidates}",
                "raw memory text is not exposed in this payload",
            ],
            signals=[
                metric("traces", counts.memoryV2Traces),
                metric("candidates", counts.memoryCandidates),
                metric("retrieval events", counts.memoryV2RetrievalEvents),
            ],
            next_step=(
                "Tune retrieval, review ergonomics, and retention estimates "
                "without automatic memory acceptance."
            ),
        ),
        purpose_dimension(
            "context-safety",
            "Context / Safety",
            (
                "Assemble provider context with explicit budgets, redaction, "
                "and safe diagnostics."
            ),
            score=score_booleans(
                counts.mindTurnSnapshots > 0 or latest_trace is not None,
                counts.messageMemoryContexts > 0 or counts.messages == 0,
                True,
            ),
            status="active" if latest_trace is not None else "ready_no_recent_trace",
            evidence=[
                f"mindSnapshots={counts.mindTurnSnapshots}",
                f"messageMemoryContexts={counts.messageMemoryContexts}",
                "hidden reasoning and raw prompts are not included",
            ],
            signals=[
                metric("mind snapshots", counts.mindTurnSnapshots),
                metric("context links", counts.messageMemoryContexts),
                metric("api usage events", counts.apiUsageEvents),
            ],
            next_step=(
                "Expose richer context comparison reports using summaries and ids only."
            ),
        ),
        purpose_dimension(
            "provider-boundary",
            "Provider Boundary",
            (
                "Treat external API models as replaceable fast variables, "
                "not identity sources."
            ),
            score=score_booleans(provider_configured, bool(adapter_id), True),
            status="active" if provider_configured else "configuration_missing",
            evidence=[
                f"adapter={adapter_id}",
                f"configurationStatus={chat_config.configurationStatus}",
                "api key value is never included",
            ],
            signals=[
                metric("configured", provider_configured),
                metric("streaming", "adapter-dependent"),
                metric("secret values", "excluded"),
            ],
            next_step=(
                "Keep model settings observable and provider-neutral; do not add "
                "local chat fallback."
            ),
        ),
        purpose_dimension(
            "observability-review",
            "Observability / Review",
            (
                "Make growth, errors, costs, and improvement proposals "
                "inspectable before action."
            ),
            score=score_review(counts.selfReviewReports, counts.improvementProposals),
            status="active",
            evidence=[
                f"selfReviewReports={counts.selfReviewReports}",
                f"improvementProposals={counts.improvementProposals}",
                "tool execution remains disabled unless explicitly reopened",
            ],
            signals=[
                metric("self reviews", counts.selfReviewReports),
                metric("improvements", counts.improvementProposals),
                metric("tool proposals", counts.toolInvocationRequests),
            ],
            next_step=(
                "Convert high-value safe observations into owner-reviewed "
                "implementation tasks."
            ),
        ),
        purpose_dimension(
            "body-presence",
            "Body / Presence",
            (
                "Represent RIN through a local body boundary without pretending "
                "full Live2D exists."
            ),
            score=score_booleans(
                body.ok,
                len(body.availableStates) > 0,
                body.fullTextIncluded is False,
            ),
            status="simple_body_active",
            evidence=[
                f"renderer={body.mode}",
                f"currentState={body.currentState}",
                "real Cubism Live2D remains deferred",
            ],
            signals=[
                metric("states", len(body.availableStates)),
                metric("current", body.currentState),
                metric("secrets", "excluded"),
            ],
            next_step=(
                "Improve state-image presence and controls before reopening "
                "Cubism-level behavior."
            ),
        ),
    ]

    overall_score = round(
        sum(dimension_score(item) for item in dimensions) / max(1, len(dimensions))
    )

    return {
        "ok": True,
        "mode": "rin-purpose-compass",
        "readOnly": True,
        "localOnly": True,
        "rawPromptIncluded": False,
        "rawMemoryIncluded": False,
        "rawProfileIncluded": False,
        "rawModelOutputIncluded": False,
        "hiddenReasoningIncluded": False,
        "secretValuesIncluded": False,
        "externalProviderCallCount": 0,
        "finalPurpose": (
            "RIN is a local-first, single-owner, long-running personal AI system "
            "whose identity, memory, owner model, policy, state, and continuity "
            "remain locally governed."
        ),
        "operatingDirection": (
            "Advance durable continuity by improving governed memory, identity, "
            "context, diagnostics, provider boundaries, body presence, and review "
            "loops while keeping frozen autonomy and synchronization scopes closed."
        ),
        "overall": {
            "score": overall_score,
            "status": score_label(overall_score),
            "dimensionCount": len(dimensions),
            "strongestSignals": [
                "local-first backend authority",
                "safe metadata contracts",
                "owner-reviewed growth loop",
            ],
        },
        "dimensions": dimensions,
        "guardrails": [
            guardrail("backend_authority", "Frontend uses backend APIs only."),
            guardrail(
                "no_secret_display",
                "Secrets are represented as present/missing metadata only.",
            ),
            guardrail(
                "no_raw_reasoning",
                "Hidden reasoning and raw prompts are never exposed.",
            ),
            guardrail(
                "owner_review", "Growth and tool proposals require owner review."
            ),
            guardrail(
                "local_state_first",
                "Local data remains outside Git and cloud identity.",
            ),
        ],
        "inactiveScopes": [
            "autonomous agent execution",
            "planner/task autonomy",
            "tool-execution framework",
            "backup/restore/migration/synchronization",
            "local model chat provider or fallback",
            "real Live2D Cubism .moc3 loading",
            "multi-user accounts or SaaS backend",
        ],
        "recommendedSlices": [
            roadmap_item(
                "memory-review-depth",
                "Memory review depth",
                (
                    "Improve candidate triage, retrieval explanations, and "
                    "retention estimates."
                ),
                "memory-governance",
                "owner-reviewed, no automatic long-term acceptance",
            ),
            roadmap_item(
                "context-observability",
                "Context observability",
                (
                    "Compare context plans across turns with ids, counts, and "
                    "safe summaries only."
                ),
                "context-safety",
                "no raw prompt export",
            ),
            roadmap_item(
                "profile-governed-editing",
                "Governed profile editing",
                (
                    "Add explicit owner-approved profile edits with validation "
                    "and audit trails."
                ),
                "identity-owner-model",
                "slow-variable task; separate design required",
            ),
            roadmap_item(
                "presence-state-loop",
                "Presence state loop",
                (
                    "Tighten body state controls and diagnostics before any "
                    "Cubism scope is reopened."
                ),
                "body-presence",
                "simple state-image renderer remains the active runtime",
            ),
            roadmap_item(
                "review-to-pr-flow",
                "Review-to-PR flow",
                (
                    "Turn safe self-review observations into Codex-ready drafts "
                    "without auto-execution."
                ),
                "observability-review",
                "manual owner review remains required",
            ),
        ],
    }


def purpose_dimension(
    identifier: str,
    label: str,
    purpose: str,
    *,
    score: int,
    status: str,
    evidence: list[str],
    signals: list[dict[str, object]],
    next_step: str,
) -> dict[str, object]:
    return {
        "id": identifier,
        "label": label,
        "purpose": purpose,
        "score": max(0, min(100, score)),
        "status": status,
        "evidence": evidence,
        "signals": signals,
        "nextStep": next_step,
        "rawTextIncluded": False,
        "secretValuesIncluded": False,
    }


def metric(label: str, value: object) -> dict[str, object]:
    return {"label": label, "value": display_value(value)}


def guardrail(identifier: str, label: str) -> dict[str, object]:
    return {"id": identifier, "label": label, "active": True}


def roadmap_item(
    identifier: str,
    title: str,
    summary: str,
    dimension: str,
    guardrail_note: str,
) -> dict[str, object]:
    return {
        "id": identifier,
        "title": title,
        "summary": summary,
        "dimension": dimension,
        "guardrail": guardrail_note,
        "requiresOwnerApproval": True,
    }


def score_booleans(*values: bool) -> int:
    if not values:
        return 0
    return round(sum(1 for value in values if value) / len(values) * 100)


def score_memory(trace_count: int, candidate_count: int) -> int:
    if trace_count > 0 and candidate_count > 0:
        return 78
    if trace_count > 0:
        return 68
    if candidate_count > 0:
        return 58
    return 42


def score_review(self_reviews: int, proposals: int) -> int:
    if self_reviews > 0 and proposals > 0:
        return 82
    if self_reviews > 0 or proposals > 0:
        return 66
    return 52


def score_label(score: int) -> str:
    if score >= 80:
        return "strong_active"
    if score >= 65:
        return "active_foundation"
    if score >= 45:
        return "partial_foundation"
    return "needs_foundation"


def dimension_score(item: Mapping[str, object]) -> int:
    value = item.get("score")
    return value if isinstance(value, int) else 0


def display_value(value: object) -> object:
    if value is None:
        return "n/a"
    if isinstance(value, bool | int | float | str):
        return value
    if isinstance(value, Mapping):
        return "metadata"
    if isinstance(value, list | tuple | set):
        return len(value)
    return str(value)
