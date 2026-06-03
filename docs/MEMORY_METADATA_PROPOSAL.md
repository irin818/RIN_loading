# Owner-Reviewed Memory Metadata Proposal

Status: Metadata-aware retrieval implemented in Mega-Milestone 6

## Purpose

RIN's accepted memories are slow-variable data. Metadata that can later shape
memory retrieval must therefore be local, auditable, and owner-reviewed before it
becomes trusted. This proposal defines a minimal metadata foundation without
making metadata affect retrieval ranking in this milestone.

## Current Memory Lifecycle

1. The owner can create a proposal with `/remember ` in the local conversation
   flow.
2. `MemoryManager` stores the proposal in `memory_items` with status
   `proposal`.
3. The Console shows recent memory items and lets the owner accept or reject
   proposals.
4. Review changes status to `accepted`, `rejected`, or `archived`, updates
   `updatedAt`, and records an audit event.
5. Conversation runtime retrieves only `accepted` memories.
6. Retrieval uses deterministic normalized content overlap plus a small
   `memoryType` bonus. Pending, rejected, and archived memories are never
   injected.
7. Context assembly injects a bounded accepted-memory block into model context.
8. Safe `memoryContext` trace metadata is recorded for audit/reload visibility.
   It excludes full memory text, raw prompts, and model context snippets.
9. The Console can inspect persisted per-turn `memoryContext` traces without
   recomputing retrieval.
10. `npm run rin:memory-eval` verifies retrieval, context, privacy, budget, and
    provider isolation with in-memory fixtures.

## Current Schema Baseline

`memory_items` currently exposes:

- `id`
- `memory_type` / `memoryType`
- `content_json`, including human-readable `text`, `english`, or `chinese`
- `source_message_id`
- `status`
- `created_at`
- `updated_at`

Missing first-class memory metadata:

- tags
- owner-reviewed importance
- owner-reviewed confidence
- structured source kind/details beyond `source_message_id`
- `reviewedAt`
- `acceptedAt`
- `lastUsedAt`
- `useCount`
- category/type refinements beyond the existing `memoryType`

## Proposed Metadata Fields

| Field | Purpose | Owner-reviewed | Shape | Ranking impact now | Trace impact now | Migration risk | UI implication | Evaluation implication |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tags` | Owner labels for future filtering/ranking and organization. | Required | `string[]`, normalized lowercase-ish tokens, bounded count and length. | None. | None by default. | Low in side-table JSON. | Comma-separated input in review flow. | Save/load and no-ranking cases. |
| `importance` | Owner-reviewed signal for future ranking or display priority. | Required | Bounded enum: `low`, `normal`, `high`. | None. | None by default. | Low. | Select control. | Bounded validation and no-ranking cases. |
| `confidence` | Owner-reviewed confidence in memory correctness. | Required | Bounded enum: `low`, `medium`, `high`. | None. | None by default. | Low. | Select control. | Bounded validation and no-ranking cases. |
| `source` | Safe owner-provided source note or local source kind. | Required if set | Short string, sanitized and bounded; existing `sourceMessageId` remains separate. | None. | None by default. | Low. | Optional compact text input. | Save/load and privacy cases. |
| `reviewedAt` | Timestamp for latest owner metadata/status review. | System-set during owner review/edit. | ISO timestamp. | None. | None by default. | Low. | Read-only if shown. | Review timestamp assertions. |
| `acceptedAt` | Timestamp when owner accepts a proposal. | System-set on accept. | ISO timestamp or `null`. | None. | None by default. | Low. | Read-only if shown. | Accept timestamp assertions. |
| `lastUsedAt` | Future usage visibility. | Automatic only if later designed. | ISO timestamp or `null`. | None in this milestone. | None. | Medium because retrieval would need writes. | Design-only. | Future anti-runaway cases. |
| `useCount` | Future usage visibility. | Automatic only if later designed. | Non-negative integer. | None in this milestone. | None. | Medium because retrieval would need writes. | Design-only. | Future anti-runaway cases. |
| category/type refinement | Future refinement of `memoryType`. | Required | Must stay consistent with existing `MemoryType` union or a future schema. | None. | None. | Medium. | Design-only. | Future compatibility cases. |

## Owner-Reviewed Requirement

- `tags`, `importance`, and `confidence` must not become trusted ranking signals
  unless the owner has reviewed them.
- Model-suggested metadata may be allowed later only as untrusted pending
  suggestions.
- Accepted metadata must be locally stored, auditable, editable or reviewable by
  the owner, and explainable.
- Automatic metadata must not silently alter long-term memory influence.
- Metadata edits must be treated as slow-variable changes and recorded in the
  audit log.

## Ranking Use Policy

- Metadata may affect retrieval ranking in Mega-Milestone 6 only through
  explicit deterministic score components.
- Metadata ranking must be protected by `npm run rin:memory-eval`.
- Token relevance remains primary unless a future ADR explicitly changes that.
- Usage statistics must not create runaway reinforcement loops where frequently
  used memories become increasingly dominant without owner intent.
- Metadata must not be injected into model context unless a future design
  explicitly authorizes that behavior.
- Metadata must not inject zero lexical-overlap memories.
- Metadata must not cause a weak lexical match to outrank a materially stronger
  lexical match.

Mega-Milestone 6 implemented policy:

- `tags`: owner-reviewed tags may add a small bonus only when normalized query
  tokens match normalized tags and memory content already has lexical overlap.
  Tag-only zero-overlap memories remain excluded.
- `importance`: owner-reviewed `high` importance may add a small bounded bonus
  when lexical overlap exists. `normal` and `low` are neutral for now.
- `confidence`: `low` confidence may dampen metadata bonus. `medium` and `high`
  are neutral for now so confidence does not silently amplify memory influence.
- `source`: source remains explanatory/trace-only and has no ranking effect.
- `reviewedAt` / `acceptedAt`: timestamps remain trace-only for now and do not
  affect primary score or recency.
- Total metadata bonus is capped and traceable.
- Trace may expose safe metadata score fields such as `matchedTags`,
  `tagMatchBonus`, `importanceBonus`, `confidenceAdjustment`, `metadataBonus`,
  and `metadataSignals`; it must not expose full memory text, raw prompts, model
  context snippets, or raw metadata JSON.

Implemented retrieval behavior:

- base token score remains the primary relevance dimension.
- `tags` can add a capped `tagMatchBonus` when normalized owner-query tokens
  match owner-reviewed tags.
- `high` importance can add `importanceBonus = 1`; `normal` and `low` are
  neutral.
- `low` confidence applies `confidenceAdjustment = -1` when metadata bonus would
  otherwise be positive; `medium` and `high` are neutral.
- total metadata contribution is capped as `metadataBonus`.
- source, `reviewedAt`, and `acceptedAt` are not ranking signals.
- metadata score fields are included in memory context trace only as safe
  explanation data.

## Migration Plan

### Side Table

Recommended approach:

```text
memory_metadata
- memory_id primary key references memory_items(id) on delete cascade
- metadata_json not null
- reviewed_at not null
- accepted_at nullable
- updated_at not null
```

Advantages:

- Keeps `memory_items` stable.
- Lets old memories load without metadata.
- Keeps optional metadata grouped and easy to sanitize.
- Avoids adding many nullable columns before the field set is mature.

Risks:

- Requires joins when listing memory items.
- JSON shape must be validated at the memory boundary.

### Columns

Alternative:

- Add `tags_json`, `importance`, `confidence`, `source`, `reviewed_at`,
  `accepted_at` directly to `memory_items`.

This is not recommended now because it expands the core memory table before the
metadata semantics are proven.

## Recommended Implementation

Mega-Milestone 5 implements the side-table foundation with this minimal metadata
subset:

- `tags`
- `importance`
- `confidence`
- `source`
- `reviewedAt`
- `acceptedAt`

Do not implement ranking or retrieval writes for `useCount` / `lastUsedAt` in
this milestone. Keep those design-only until usage tracking has an anti-runaway
policy.

Implemented storage:

- `memory_metadata` side table keyed by `memory_id`
- safe metadata JSON for `tags`, `importance`, `confidence`, and `source`
- `reviewed_at`, `accepted_at`, and `updated_at` columns
- optional metadata on loaded `MemoryRecord` values
- metadata audit events for review/edit actions

Implemented UI foundation:

- compact metadata controls in the existing Console memory review list
- comma-separated owner tag entry
- bounded `importance` and `confidence` selects
- optional owner source field
- explicit note that metadata is not used for ranking yet

Backward compatibility:

- Existing databases migrate with an empty `memory_metadata` table.
- Existing memories without metadata return safe default metadata.
- Old memory review behavior continues to work if no metadata is supplied.

## Evaluation Plan

Metadata-aware ranking should add fixtures for:

- tag match cases
- bounded importance influence cases
- confidence semantics cases
- non-accepted exclusion even with strong metadata
- privacy/no text leak
- token relevance dominance
- old memory backward compatibility
- no runaway `useCount` / `lastUsedAt` reinforcement

Mega-Milestone 5 added readiness coverage only:

- metadata can be saved and loaded
- metadata can be present without changing retrieval output
- metadata is not included in `memoryContext` trace as a ranking signal
- metadata validation rejects or normalizes invalid values
- metadata does not store full memory text

Mega-Milestone 6 adds ranking coverage for:

- tag match boosts a relevant memory
- tag-only zero lexical-overlap memory is excluded
- importance bonus remains bounded
- low confidence dampens metadata bonus
- strong lexical relevance beats weak metadata
- non-accepted metadata-rich memories remain excluded
- metadata trace fields are safe and explainable
- old memories with no metadata behave neutrally

The built-in evaluation suite now has 24 provider-free cases.

## Non-Goals

- No embeddings or vector database.
- No semantic retrieval service.
- No opaque or model-assisted metadata ranking.
- No trusted model-authored metadata.
- No unbounded usage reinforcement.
- No provider calls.
- No memory editor overhaul.
