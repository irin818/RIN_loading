import json
from typing import Any, cast

import pytest
from pydantic import BaseModel, ValidationError

from rin.contracts import (
    ContextV2Report,
    ConversationErrorBody,
    ConversationMessageRecord,
    ConversationRecord,
    ConversationTurnRecord,
    MemoryV2SchemaReport,
    MemoryV2TraceAnalysis,
    ModelRequest,
    ModelResponse,
    ModelRuntimeConfig,
    OwnerProfile,
    ProfileReport,
    RinDataManifest,
    RinProfile,
    RinReadinessReport,
)


def round_trip(
    model_type: type[BaseModel],
    payload: dict[str, Any],
) -> dict[str, Any]:
    parsed = model_type.model_validate(payload)
    return cast(dict[str, Any], json.loads(parsed.model_dump_json()))


def test_manifest_contract_round_trips() -> None:
    payload = {
        "project": "RIN",
        "schemaVersion": 1,
        "ownerId": "local-owner",
        "deviceId": "test-device",
        "createdAt": "2026-06-05T00:00:00.000Z",
        "updatedAt": "2026-06-05T00:00:00.000Z",
        "directories": {
            "config": "config",
            "databases": "databases",
            "logs": "logs",
            "bundles": "bundles",
            "attachments": "attachments",
        },
    }

    assert round_trip(RinDataManifest, payload) == payload


def test_profile_contracts_round_trip() -> None:
    rin_profile = {
        "schemaVersion": 1,
        "kind": "rin_profile",
        "updatedAt": "2026-06-05T00:00:00.000Z",
        "displayName": "RIN",
        "role": "local-first personal AI companion",
        "communicationStyle": ["concise"],
        "behaviorBoundaries": ["Do not rewrite profiles automatically."],
        "contextNotes": ["Synthetic fixture only."],
    }
    owner_profile = {
        "schemaVersion": 1,
        "kind": "owner_profile",
        "ownerId": "local-owner",
        "updatedAt": "2026-06-05T00:00:00.000Z",
        "displayName": "Owner",
        "communicationPreferences": ["direct"],
        "stablePreferences": [],
        "activeProjects": ["RIN_loading"],
        "contextNotes": ["Synthetic fixture only."],
    }

    assert round_trip(RinProfile, rin_profile) == rin_profile
    assert round_trip(OwnerProfile, owner_profile) == owner_profile


def test_runtime_and_profile_report_contracts_round_trip() -> None:
    model_config = {
        "schemaVersion": 1,
        "kind": "model_config",
        "updatedAt": "2026-06-05T00:00:00.000Z",
        "activeAdapter": "rin-mock-local",
        "adapters": [
            {
                "id": "rin-mock-local",
                "displayName": "Mock local adapter",
                "provider": "mock",
                "enabled": True,
                "model": None,
                "baseUrl": None,
                "apiKeyEnv": None,
                "timeoutMs": 30000,
            }
        ],
        "apiKeysStoredHere": False,
        "note": {"english": "safe", "chinese": "safe"},
    }
    profile_report = {
        "mode": "profile-report",
        "status": "valid",
        "files": [
            {
                "file": "rin_profile.json",
                "exists": True,
                "valid": True,
                "issueCount": 0,
                "summaryCounts": {"communicationStyle": 1},
            }
        ],
        "issueCount": 0,
        "issues": [],
        "contextCharacterCount": 42,
        "providerCallCount": 0,
        "fullTextIncluded": False,
    }

    assert round_trip(ModelRuntimeConfig, model_config) == model_config
    assert round_trip(ProfileReport, profile_report) == profile_report


def test_conversation_contracts_round_trip_with_memory_trace() -> None:
    memory_trace = {
        "injectedMemoryCount": 1,
        "injectedMemoryIds": ["mem-1"],
        "deterministicInjectedMemoryIds": ["mem-1"],
        "semanticInjectedMemoryIds": [],
        "semanticCandidateIds": [],
        "semanticContextExpansionEnabled": False,
        "memoryContextCharacterCount": 24,
        "skippedByBudgetCount": 0,
        "skippedByRelevanceCount": 0,
        "skippedByMaxCountCount": 0,
        "items": [
            {
                "memoryId": "mem-1",
                "memoryType": "preference",
                "matchedKeywords": ["concise"],
                "overlapCount": 1,
                "latinTokenMatchCount": 1,
                "cjkBigramMatchCount": 0,
                "normalizedQueryTokenCount": 3,
                "typeMatchBonus": 0.2,
                "matchedTypeSignals": ["prefer"],
                "matchedTags": ["report"],
                "tagMatchBonus": 0.1,
                "importanceBonus": 0.0,
                "confidenceAdjustment": 0.0,
                "metadataBonus": 0.1,
                "metadataSignals": ["tag:report"],
                "contextSource": "deterministic",
                "wasInjected": True,
                "skippedReason": None,
                "snippetLength": 24,
            }
        ],
    }
    conversation = {
        "id": "conv-1",
        "title": "Synthetic chat",
        "createdAt": "2026-06-05T00:00:00.000Z",
        "updatedAt": "2026-06-05T00:01:00.000Z",
    }
    message = {
        "id": "msg-1",
        "conversationId": "conv-1",
        "role": "owner",
        "content": "Please be concise.",
        "modelAdapter": None,
        "createdAt": "2026-06-05T00:01:00.000Z",
        "memoryContext": memory_trace,
    }
    turn = {
        "id": "turn-1",
        "conversationId": "conv-1",
        "ownerMessageId": "msg-1",
        "rinMessageId": None,
        "status": "started",
        "attemptCount": 1,
        "errorCode": None,
        "createdAt": "2026-06-05T00:01:00.000Z",
        "updatedAt": "2026-06-05T00:01:00.000Z",
        "completedAt": None,
        "failedAt": None,
    }

    assert round_trip(ConversationRecord, conversation) == conversation
    assert round_trip(ConversationMessageRecord, message) == message
    assert round_trip(ConversationTurnRecord, turn) == turn


def test_memory_and_context_contracts_round_trip() -> None:
    schema_report = {
        "mode": "memory-v2-schema-report",
        "status": "ready",
        "migrationVersion": 6,
        "shadowOnly": False,
        "productionRetrievalChanged": True,
        "legacyMigrationSupported": True,
        "productionRetrievalPath": "memory-v2-legacy-traces-after-migration",
        "providerCallCount": 0,
        "fullTextIncluded": False,
        "tables": [
            {"name": "memory_v2_traces", "exists": True, "rowCount": 1},
        ],
    }
    trace_analysis = {
        "sourceMessageId": "msg-1",
        "sourceCreatedAt": "2026-06-05T00:00:00.000Z",
        "conversationId": "conv-1",
        "role": "owner",
        "contentCharacterCount": 20,
        "ageHours": 1.5,
        "baseScore": 0.6,
        "stabilityHours": 72,
        "retentionScore": 0.58,
        "decision": "promoted",
        "reasons": ["preference_signal"],
        "signals": [
            {
                "signalType": "preference",
                "signalKey": "prefer",
                "signalWeight": 0.4,
                "evidence": {
                    "rawTextIncluded": False,
                    "contentCharacterCount": 20,
                    "matchedPattern": "prefer",
                },
            }
        ],
    }
    context_report = {
        "mode": "context-v2-report",
        "status": "ready",
        "shadowOnly": True,
        "productionContextChanged": False,
        "providerCallCount": 0,
        "fullTextIncluded": False,
        "maxCharacters": 2400,
        "totalInputSegments": 1,
        "includedSegments": 1,
        "skippedSegments": 0,
        "characterCount": 10,
        "budgetExceeded": False,
        "latestOwnerMessagePreserved": True,
        "order": ["current_owner_message"],
        "segments": [
            {
                "id": "owner-latest",
                "type": "current_owner_message",
                "sourceId": "message:msg-1",
                "provenance": "message:msg-1",
                "included": True,
                "protected": True,
                "characterCount": 10,
                "skipReason": "included",
            }
        ],
    }

    assert round_trip(MemoryV2SchemaReport, schema_report) == schema_report
    assert round_trip(MemoryV2TraceAnalysis, trace_analysis) == trace_analysis
    assert round_trip(ContextV2Report, context_report) == context_report


def test_model_error_and_readiness_contracts_round_trip() -> None:
    model_request = {
        "messages": [{"role": "owner", "content": "Hello"}],
        "ownerId": "local-owner",
        "conversationId": "conv-1",
    }
    model_response = {
        "content": "Hello.",
        "adapterId": "rin-mock-local",
        "metadata": {
            "externalProvider": False,
            "memoryWriteRequested": False,
            "toolCallRequested": False,
        },
    }
    error_body = {
        "ok": False,
        "error": {
            "code": "MODEL_RESPONSE_INVALID",
            "message": "The model returned an invalid response.",
            "recovery": ["Use a shorter prompt."],
            "modelAdapter": "rin-ollama-local",
            "provider": "local",
            "retryable": True,
            "details": {
                "model": "qwen3:4b",
                "emptyContent": True,
                "possibleReasoningOnlyOutput": True,
                "responseFields": ["message.content", "message.thinking"],
            },
        },
    }
    readiness = {
        "ok": True,
        "readyForExternalModel": False,
        "readyForLocalModel": False,
        "readyForLiveModel": False,
        "missingEnvironment": [],
        "checks": [
            {
                "key": "manifest",
                "status": "pass",
                "english": "Local data manifest is present and valid.",
                "chinese": "本地数据 manifest 存在且有效。",
            }
        ],
    }

    assert round_trip(ModelRequest, model_request) == model_request
    assert round_trip(ModelResponse, model_response) == model_response
    parsed_error = ConversationErrorBody.model_validate(error_body)
    assert parsed_error.model_dump(mode="json", exclude_none=True) == error_body
    assert round_trip(RinReadinessReport, readiness) == readiness


def test_contracts_reject_wrong_literals_and_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        RinDataManifest.model_validate(
            {
                "project": "OTHER",
                "schemaVersion": 1,
                "ownerId": "local-owner",
                "deviceId": "test-device",
                "createdAt": "2026-06-05T00:00:00.000Z",
                "updatedAt": "2026-06-05T00:00:00.000Z",
                "directories": {"config": "config"},
            }
        )

    with pytest.raises(ValidationError):
        ModelResponse.model_validate(
            {
                "content": "Hello.",
                "adapterId": "rin-mock-local",
                "metadata": {
                    "externalProvider": False,
                    "memoryWriteRequested": False,
                    "toolCallRequested": False,
                },
                "unexpected": "not allowed",
            }
        )
