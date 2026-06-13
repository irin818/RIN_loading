"""Central safe defaults and environment overrides for RIN Mind."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass

from .schemas import MindPolicyMetadata


@dataclass(frozen=True)
class MindPolicy:
    contextMaxCharacters: int = 8000
    recentHistorySelectedLimit: int = 8
    recentHistoryCandidateLimit: int = 20
    memoryRetrievalCandidateLimit: int = 100
    memoryMaxSelected: int = 5
    autopromoteConfidence: float = 0.8
    ownerStateTtlHours: int = 6
    enableEmbeddings: bool = False
    embeddingProvider: str = "disabled"
    enableModelSummaries: bool = False
    enableAgentTools: bool = False
    allowHighRiskMemoryExport: bool = False
    selfModelAutoApply: bool = False
    warnings: tuple[str, ...] = ()

    def metadata(self) -> MindPolicyMetadata:
        return MindPolicyMetadata(
            contextMaxCharacters=self.contextMaxCharacters,
            recentHistorySelectedLimit=self.recentHistorySelectedLimit,
            recentHistoryCandidateLimit=self.recentHistoryCandidateLimit,
            memoryRetrievalCandidateLimit=self.memoryRetrievalCandidateLimit,
            memoryMaxSelected=self.memoryMaxSelected,
            autopromoteConfidence=self.autopromoteConfidence,
            ownerStateTtlHours=self.ownerStateTtlHours,
            enableEmbeddings=self.enableEmbeddings,
            embeddingProvider=self.embeddingProvider,
            enableModelSummaries=self.enableModelSummaries,
            enableAgentTools=self.enableAgentTools,
            allowHighRiskMemoryExport=self.allowHighRiskMemoryExport,
            selfModelAutoApply=self.selfModelAutoApply,
            warnings=list(self.warnings),
            dangerousDefaultsDisabled=not any(
                (
                    self.enableEmbeddings,
                    self.enableModelSummaries,
                    self.enableAgentTools,
                    self.allowHighRiskMemoryExport,
                    self.selfModelAutoApply,
                )
            ),
            secretValuesIncluded=False,
        )


def load_mind_policy(environ: Mapping[str, str] | None = None) -> MindPolicy:
    """Load safe Mind policy with defensive env parsing."""
    env = environ if environ is not None else os.environ
    warnings: list[str] = []

    context_max = parse_int(
        env,
        "RIN_MIND_CONTEXT_MAX_CHARACTERS",
        8000,
        min_value=1200,
        max_value=32000,
        warnings=warnings,
    )
    selected_limit = parse_int(
        env,
        "RIN_MIND_RECENT_HISTORY_LIMIT",
        8,
        min_value=1,
        max_value=20,
        warnings=warnings,
    )
    candidate_limit = parse_int(
        env,
        "RIN_MIND_RECENT_HISTORY_CANDIDATE_LIMIT",
        20,
        min_value=1,
        max_value=200,
        warnings=warnings,
    )
    memory_candidate_limit = parse_int(
        env,
        "RIN_MIND_MEMORY_RETRIEVAL_LIMIT",
        100,
        min_value=1,
        max_value=500,
        warnings=warnings,
    )
    memory_max_selected = parse_int(
        env,
        "RIN_MIND_MEMORY_MAX_SELECTED",
        5,
        min_value=1,
        max_value=20,
        warnings=warnings,
    )
    autopromote = parse_float(
        env,
        "RIN_MIND_AUTOPROMOTE_CONFIDENCE",
        0.8,
        min_value=0.0,
        max_value=1.0,
        warnings=warnings,
    )
    ttl = parse_int(
        env,
        "RIN_MIND_OWNER_STATE_TTL_HOURS",
        6,
        min_value=1,
        max_value=168,
        warnings=warnings,
    )
    embeddings_enabled = parse_bool(env, "RIN_MIND_ENABLE_EMBEDDINGS", False, warnings)
    embedding_provider = env.get("RIN_MIND_EMBEDDING_PROVIDER", "disabled").strip()
    if not embedding_provider:
        embedding_provider = "disabled"
        warnings.append("RIN_MIND_EMBEDDING_PROVIDER empty; using disabled.")
    if not embeddings_enabled:
        embedding_provider = "disabled"

    return MindPolicy(
        contextMaxCharacters=context_max,
        recentHistorySelectedLimit=selected_limit,
        recentHistoryCandidateLimit=candidate_limit,
        memoryRetrievalCandidateLimit=memory_candidate_limit,
        memoryMaxSelected=memory_max_selected,
        autopromoteConfidence=autopromote,
        ownerStateTtlHours=ttl,
        enableEmbeddings=embeddings_enabled,
        embeddingProvider=embedding_provider,
        enableModelSummaries=parse_bool(
            env,
            "RIN_MIND_ENABLE_MODEL_SUMMARIES",
            False,
            warnings,
        ),
        enableAgentTools=parse_bool(
            env,
            "RIN_MIND_ENABLE_AGENT_TOOLS",
            False,
            warnings,
        ),
        allowHighRiskMemoryExport=parse_bool(
            env,
            "RIN_MIND_ALLOW_HIGH_RISK_MEMORY_EXPORT",
            False,
            warnings,
        ),
        selfModelAutoApply=parse_bool(
            env,
            "RIN_MIND_SELF_MODEL_AUTO_APPLY",
            False,
            warnings,
        ),
        warnings=tuple(warnings),
    )


def parse_bool(
    env: Mapping[str, str],
    key: str,
    default: bool,
    warnings: list[str],
) -> bool:
    raw = env.get(key)
    if raw is None:
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    warnings.append(f"{key} invalid; using {default}.")
    return default


def parse_int(
    env: Mapping[str, str],
    key: str,
    default: int,
    *,
    min_value: int,
    max_value: int,
    warnings: list[str],
) -> int:
    raw = env.get(key)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        warnings.append(f"{key} invalid; using {default}.")
        return default
    if value < min_value or value > max_value:
        warnings.append(f"{key} out of range; using {default}.")
        return default
    return value


def parse_float(
    env: Mapping[str, str],
    key: str,
    default: float,
    *,
    min_value: float,
    max_value: float,
    warnings: list[str],
) -> float:
    raw = env.get(key)
    if raw is None:
        return default
    try:
        value = float(raw)
    except ValueError:
        warnings.append(f"{key} invalid; using {default}.")
        return default
    if value < min_value or value > max_value:
        warnings.append(f"{key} out of range; using {default}.")
        return default
    return value
