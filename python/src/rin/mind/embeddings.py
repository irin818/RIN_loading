"""Embedding-ready framework for safe Mind memory sources.

The default runtime path does not call external embedding services. Tests and
future local indexing can use the deterministic provider below.
"""

from __future__ import annotations

import hashlib
import math
from typing import Protocol

from .policy import MindPolicy
from .schemas import MemoryCandidate, MemoryEmbeddingEntry, MemorySourceKind


class EmbeddingProvider(Protocol):
    id: str
    model: str
    dimensions: int

    def embed(self, text: str) -> list[float]: ...


class DeterministicEmbeddingProvider:
    """Stable tiny embedding provider for tests and local smoke checks."""

    id = "rin-deterministic-test-embedding"
    model = "hash-bucket-8"
    dimensions = 8

    def embed(self, text: str) -> list[float]:
        buckets = [0.0] * self.dimensions
        for token in tokenize_embedding_text(text):
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = digest[0] % self.dimensions
            buckets[index] += 1.0
        norm = math.sqrt(sum(value * value for value in buckets)) or 1.0
        return [round(value / norm, 6) for value in buckets]


def embedding_provider_for_policy(policy: MindPolicy) -> EmbeddingProvider | None:
    """Return a local-safe provider when embeddings are explicitly enabled."""
    if not policy.enableEmbeddings:
        return None
    if policy.embeddingProvider in {"mock", "deterministic", "test"}:
        return DeterministicEmbeddingProvider()
    return None


def embedding_allowed_for_candidate(
    candidate: MemoryCandidate,
    policy: MindPolicy,
) -> bool:
    """Decide whether a candidate can be embedded from safe semantic text."""
    if not policy.enableEmbeddings:
        return False
    if not candidate.active or candidate.reviewStatus not in {
        "auto_promoted",
        "owner_approved",
    }:
        return False
    if candidate.riskLevel == "blocked":
        return False
    if candidate.riskLevel == "high" and not policy.allowHighRiskMemoryExport:
        return False
    return bool(embedding_text_for_candidate(candidate))


def embedding_text_for_candidate(candidate: MemoryCandidate) -> str:
    """Use only safe semantic fields, never raw source message text."""
    parts = [candidate.safeSummary, candidate.normalizedValue or ""]
    return " ".join(part.strip() for part in parts if part.strip())


def build_embedding_entry_for_candidate(
    candidate: MemoryCandidate,
    *,
    provider: EmbeddingProvider,
    created_at: str,
) -> MemoryEmbeddingEntry:
    text = embedding_text_for_candidate(candidate)
    vector = provider.embed(text)
    return MemoryEmbeddingEntry(
        id=f"embedding-{candidate.id}-{provider.model}",
        sourceKind="memory_candidate",
        sourceId=candidate.id,
        embeddingProvider=provider.id,
        embeddingModel=provider.model,
        vector=vector,
        dimensions=len(vector),
        contentHash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
        createdAt=created_at,
        active=True,
        rawTextIncluded=False,
    )


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    numerator = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if not left_norm or not right_norm:
        return 0.0
    return round(numerator / (left_norm * right_norm), 6)


def tokenize_embedding_text(text: str) -> list[str]:
    lowered = text.lower()
    words = [item for item in lowered.replace("_", " ").split() if item]
    cjk_chars = [char for char in text if "\u4e00" <= char <= "\u9fff"]
    cjk_bigrams = [
        "".join(cjk_chars[index : index + 2])
        for index in range(max(0, len(cjk_chars) - 1))
    ]
    return words + cjk_bigrams


def source_kind_prefix(source_kind: MemorySourceKind) -> str:
    return "trace" if source_kind == "memory_v2_trace" else "candidate"
