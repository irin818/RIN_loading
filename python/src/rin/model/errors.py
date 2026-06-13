"""Shared model adapter errors."""

from __future__ import annotations

from rin.contracts import ModelErrorCode, ModelErrorDetails


class ModelError(RuntimeError):
    """Raised when a model adapter cannot produce a valid safe response."""

    def __init__(
        self,
        code: ModelErrorCode,
        message: str,
        adapter_id: str,
        provider: str = "openai-compatible",
        retryable: bool | None = None,
        details: ModelErrorDetails | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.adapterId = adapter_id
        self.provider = provider
        self.retryable = retryable if retryable is not None else default_retryable(code)
        self.details = details or ModelErrorDetails()


def default_retryable(code: ModelErrorCode) -> bool:
    """Return whether the runtime may retry this class of provider failure later."""
    return code in {
        "API_PROVIDER_UNAVAILABLE",
        "API_PROVIDER_TIMEOUT",
        "API_PROVIDER_RATE_LIMITED",
        "API_PROVIDER_ERROR",
        "API_PROVIDER_RESPONSE_INVALID",
        "MODEL_RESPONSE_INVALID",
    }
