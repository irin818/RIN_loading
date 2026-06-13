"""Model adapter interfaces for the Python RIN runtime."""

from rin.model.errors import ModelError
from rin.model.openai_compatible import (
    API_CHAT_ADAPTER_ID,
    OPENAI_COMPATIBLE_PROVIDER,
    OpenAICompatibleChatAdapter,
    create_api_chat_adapter_from_env,
)
from rin.model.sanitizer import (
    SanitizedAssistantContent,
    has_unsafe_thinking_leak,
    sanitize_assistant_content,
    sanitize_assistant_content_details,
)

__all__ = [
    "API_CHAT_ADAPTER_ID",
    "OPENAI_COMPATIBLE_PROVIDER",
    "ModelError",
    "OpenAICompatibleChatAdapter",
    "SanitizedAssistantContent",
    "create_api_chat_adapter_from_env",
    "has_unsafe_thinking_leak",
    "sanitize_assistant_content",
    "sanitize_assistant_content_details",
]
